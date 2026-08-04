#!/usr/bin/env node
/**
 * runtime-watch.mjs — load a page, drive it, and report everything that went wrong.
 *
 *   node runtime-watch.mjs <url> [--reload] [--click SELECTOR]... [--wait MS]
 *                                [--allow REGEX]... [--json FILE]
 *
 * Collects and classifies:
 *   console errors and warnings, uncaught exceptions, React warnings,
 *   hydration mismatches, failed requests, unhandled promise rejections
 *
 * Exits non-zero if anything fired.
 * Requires playwright: npm i -D playwright && npx playwright install chromium
 */

import { writeFile } from 'node:fs/promises';

function parseArgs(argv) {
  const args = { url: null, reload: false, clicks: [], wait: 2000, allow: [], json: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--reload') args.reload = true;
    else if (a === '--click') args.clicks.push(argv[++i]);
    else if (a === '--wait') args.wait = parseInt(argv[++i], 10);
    else if (a === '--allow') args.allow.push(new RegExp(argv[++i], 'i'));
    else if (a === '--json') args.json = argv[++i];
    else rest.push(a);
  }
  args.url = rest[0];
  return args;
}

/**
 * React and Next put hydration failures behind several different strings
 * depending on version, so match on the family rather than one message.
 */
const HYDRATION = /hydrat|did not match|text content does not match|server rendered html|server-rendered/i;
const REACT_WARNING = /^warning:|unique "key"|validatedom|cannot appear as a descendant|controlled input|uncontrolled|act\(\)|componentwill|findDOMNode|useLayoutEffect does nothing on the server/i;

function classify(text) {
  if (HYDRATION.test(text)) return 'hydration';
  if (REACT_WARNING.test(text)) return 'react';
  return 'console';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('usage: node runtime-watch.mjs <url> [--reload] [--click SEL] [--wait MS] [--allow REGEX] [--json FILE]');
    process.exit(2);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('playwright is not installed.\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }

  const found = { hydration: [], react: [], console: [], exception: [], request: [], rejection: [] };
  const allowed = [];
  const record = (bucket, entry) => {
    const text = entry.text || '';
    if (args.allow.some((re) => re.test(text))) { allowed.push({ bucket, ...entry }); return; }
    found[bucket].push(entry);
  };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Unhandled rejections do not reach page.on('pageerror') in every case,
  // so listen in the page as well and forward through a binding.
  await context.exposeBinding('__runtimeWatch', (_source, payload) => {
    record('rejection', { text: payload.text, stack: payload.stack, phase: currentPhase });
  });
  await context.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => {
      const r = e.reason;
      window.__runtimeWatch?.({
        text: r?.message ? `${r.name || 'Error'}: ${r.message}` : String(r),
        stack: r?.stack || null,
      });
    });
  });

  let currentPhase = 'load';

  page.on('console', (msg) => {
    const type = msg.type();
    if (type !== 'error' && type !== 'warning') return;
    const text = msg.text();
    const loc = msg.location();
    record(classify(text), {
      text,
      level: type,
      where: loc?.url ? `${loc.url}:${loc.lineNumber}` : null,
      phase: currentPhase,
    });
  });

  page.on('pageerror', (err) => {
    record('exception', { text: `${err.name}: ${err.message}`, stack: err.stack, phase: currentPhase });
  });

  page.on('requestfailed', (req) => {
    const f = req.failure();
    // a navigation the test itself aborted is not the page's fault
    if (f?.errorText === 'net::ERR_ABORTED') return;
    record('request', { text: `${req.method()} ${req.url()} — ${f?.errorText || 'failed'}`, phase: currentPhase });
  });

  page.on('response', (res) => {
    if (res.status() >= 400) {
      record('request', { text: `${res.status()} ${res.request().method()} ${res.url()}`, phase: currentPhase });
    }
  });

  try {
    const res = await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30_000 });
    // An error page is quiet. Reporting it as "clean" would be a false pass.
    if (res && res.status() >= 400) {
      console.error(`page returned HTTP ${res.status()} — nothing was watched`);
      await browser.close();
      process.exit(2);
    }
  } catch (e) {
    console.error(`page did not load: ${e.message}`);
    await browser.close();
    process.exit(2);
  }

  await page.waitForTimeout(args.wait);

  if (args.reload) {
    currentPhase = 'reload';
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(args.wait);
  }

  for (const sel of args.clicks) {
    currentPhase = `click ${sel}`;
    try {
      await page.click(sel, { timeout: 5000 });
      await page.waitForTimeout(args.wait);
    } catch (e) {
      console.log(`  note  could not click ${sel}: ${e.message.split('\n')[0]}`);
    }
  }

  await browser.close();
  report(found, allowed, args);
}

function report(found, allowed, args) {
  const sections = [
    ['hydration', 'Hydration mismatches', 'server and client rendered different HTML — state is being discarded'],
    ['exception', 'Uncaught exceptions', null],
    ['rejection', 'Unhandled promise rejections', 'an async path with no error handling'],
    ['react', 'React warnings', 'each predicts a class of bug not yet triggered'],
    ['console', 'Console errors and warnings', null],
    ['request', 'Failed requests', null],
  ];

  console.log(`\nruntime-watch — ${args.url}\n`);

  // Playwright raises 'pageerror' for unhandled rejections too, so the same
  // failure arrives twice. Keep the rejection — it is the more specific label.
  const rejectionKeys = new Set(found.rejection.map((r) => `${r.phase}|${r.text}`));
  found.exception = found.exception.filter((e) => !rejectionKeys.has(`${e.phase}|${e.text}`));

  let total = 0;
  for (const [key, title, note] of sections) {
    const items = dedupe(found[key]);
    if (!items.length) continue;
    total += items.length;
    console.log(`${title} (${items.length})${note ? ` — ${note}` : ''}`);
    for (const item of items.slice(0, 15)) {
      console.log(`  · [${item.phase}] ${item.text}`);
      if (item.where) console.log(`        ${item.where}`);
      if (item.count > 1) console.log(`        seen ${item.count} times`);
    }
    console.log('');
  }

  if (allowed.length) {
    console.log(`suppressed by --allow (${allowed.length}) — make sure each is still justified`);
    for (const a of dedupe(allowed).slice(0, 10)) console.log(`  · ${a.text}`);
    console.log('');
  }

  if (args.json) writeFile(args.json, JSON.stringify({ found, allowed }, null, 2));

  if (total === 0) {
    console.log('clean — no console errors, React warnings, hydration mismatches, failed requests, or unhandled rejections.\n');
    process.exit(0);
  }
  console.log(`${total} runtime problem(s). The work is not complete.\n`);
  process.exit(1);
}

function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    const key = `${item.phase}|${item.text}`;
    if (map.has(key)) map.get(key).count++;
    else map.set(key, { ...item, count: 1 });
  }
  return [...map.values()];
}

main().catch((e) => { console.error(e); process.exit(2); });
