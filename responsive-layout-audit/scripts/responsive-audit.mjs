#!/usr/bin/env node
/**
 * responsive-audit.mjs — check one URL at four breakpoints.
 *
 *   node responsive-audit.mjs <url> [--out DIR] [--widths 375,768,1280,1920]
 *                                   [--header SELECTOR] [--hero SELECTOR]
 *
 * Checks, at each width:
 *   1. no horizontal overflow
 *   2. nothing clipping its own content
 *   3. no interactive target under 44x44
 *   4. the header hit-tests above the hero
 *   5. left and right gutters match, and are consistent between sections
 *
 * Writes screenshots to --out and exits non-zero if anything failed.
 * Requires playwright: npm i -D playwright && npx playwright install chromium
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const MIN_TAP = 44;
const DEFAULT_WIDTHS = [375, 768, 1280, 1920];

function parseArgs(argv) {
  const args = { url: null, out: 'responsive-audit', widths: DEFAULT_WIDTHS, header: null, hero: null, container: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--widths') args.widths = argv[++i].split(',').map((w) => parseInt(w.trim(), 10));
    else if (a === '--header') args.header = argv[++i];
    else if (a === '--hero') args.hero = argv[++i];
    else if (a === '--container') args.container = argv[++i];
    else rest.push(a);
  }
  args.url = rest[0];
  return args;
}

/** Runs in the page. Returns plain data only. */
function collect({ MIN_TAP, headerSel, heroSel, containerSel }) {
  const label = (el) => {
    if (!el) return 'unknown';
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const text = (el.textContent || '').trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };

  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const all = Array.from(document.body.querySelectorAll('*'));

  // 1. horizontal overflow
  const overflow = {
    scrollWidth: doc.scrollWidth,
    clientWidth: vw,
    overflows: doc.scrollWidth > vw + 1,
    culprits: [],
  };
  if (overflow.overflows) {
    for (const el of all) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        overflow.culprits.push({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) });
      }
    }
    // keep the outermost offenders only
    overflow.culprits = overflow.culprits.slice(0, 10);
  }

  // 2. clipped content
  const clipped = [];
  for (const el of all) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const hidesX = s.overflowX === 'hidden' || s.overflowX === 'clip';
    const hidesY = s.overflowY === 'hidden' || s.overflowY === 'clip';
    if (!hidesX && !hidesY) continue;
    // a deliberate line clamp or ellipsis is not a bug
    if (s.textOverflow === 'ellipsis' || s.webkitLineClamp !== 'none') continue;
    const cutX = hidesX && el.scrollWidth > el.clientWidth + 1;
    const cutY = hidesY && el.scrollHeight > el.clientHeight + 1;
    if (cutX || cutY) {
      clipped.push({
        el: label(el),
        axis: cutX && cutY ? 'both' : cutX ? 'x' : 'y',
        overflowBy: cutX ? el.scrollWidth - el.clientWidth : el.scrollHeight - el.clientHeight,
      });
    }
  }

  // 3. touch targets
  const INTERACTIVE = 'a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"],[role="checkbox"],[role="switch"],[tabindex]:not([tabindex="-1"])';
  const smallTargets = [];
  for (const el of document.querySelectorAll(INTERACTIVE)) {
    if (!visible(el)) continue;
    if (el.disabled) continue;
    if (el.type === 'hidden') continue;
    const s = getComputedStyle(el);
    // WCAG 2.5.8 exempts links inline in a sentence
    if (el.tagName === 'A' && s.display.startsWith('inline') && el.parentElement) {
      const parentText = (el.parentElement.textContent || '').trim();
      const ownText = (el.textContent || '').trim();
      if (parentText.length > ownText.length + 10) continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < MIN_TAP || r.height < MIN_TAP) {
      smallTargets.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  // 4. header above hero, by hit test rather than by z-index
  const header =
    (headerSel && document.querySelector(headerSel)) ||
    document.querySelector('header, [role="banner"], [data-header]');
  const hero =
    (heroSel && document.querySelector(heroSel)) ||
    document.querySelector('[data-hero], .hero, main > section:first-of-type, main > div:first-child');

  let stacking = { checked: false, reason: 'no header or hero found' };
  if (header && hero && visible(header) && visible(hero)) {
    const h = header.getBoundingClientRect();
    const o = hero.getBoundingClientRect();
    const overlapTop = Math.max(h.top, o.top);
    const overlapBottom = Math.min(h.bottom, o.bottom);
    if (overlapBottom <= overlapTop) {
      stacking = { checked: true, pass: true, note: 'header and hero do not overlap', headerZ: getComputedStyle(header).zIndex };
    } else {
      const x = Math.round(Math.max(h.left, o.left) + Math.min(h.width, o.width) / 2);
      const y = Math.round((overlapTop + overlapBottom) / 2);
      const hit = document.elementFromPoint(x, y);
      const headerOnTop = !!hit && (header === hit || header.contains(hit));
      stacking = {
        checked: true,
        pass: headerOnTop,
        point: [x, y],
        hit: label(hit),
        headerZ: getComputedStyle(header).zIndex,
        // the usual real cause, surfaced so nobody wastes an afternoon on z-index
        stackingAncestors: (() => {
          const found = [];
          let p = header.parentElement;
          while (p && p !== document.documentElement) {
            const s = getComputedStyle(p);
            const why = [];
            if (s.transform !== 'none') why.push('transform');
            if (s.filter !== 'none') why.push('filter');
            if (parseFloat(s.opacity) < 1) why.push('opacity');
            if (s.willChange !== 'auto') why.push('will-change');
            if (s.backdropFilter && s.backdropFilter !== 'none') why.push('backdrop-filter');
            if (why.length) found.push({ el: label(p), why });
            p = p.parentElement;
          }
          return found;
        })(),
      };
    }
  }

  // 5. gutters
  const containers = Array.from(
    document.querySelectorAll(containerSel || 'main > *, body > section, [data-section]')
  ).filter(visible);
  const gutters = [];
  for (const el of containers) {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const padL = parseFloat(s.paddingLeft) || 0;
    const padR = parseFloat(s.paddingRight) || 0;
    gutters.push({
      el: label(el),
      left: Math.round(r.left + padL),
      right: Math.round(vw - r.right + padR),
    });
  }
  const asymmetric = gutters.filter((g) => Math.abs(g.left - g.right) > 1);
  const distinct = [...new Set(gutters.map((g) => g.left))].sort((a, b) => a - b);

  return { overflow, clipped, smallTargets, stacking, gutters: { measured: gutters, asymmetric, distinct } };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('usage: node responsive-audit.mjs <url> [--out DIR] [--widths 375,768,...] [--header SEL] [--hero SEL]');
    process.exit(2);
  }

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.error('playwright is not installed.\n  npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }

  await mkdir(args.out, { recursive: true });
  const browser = await chromium.launch();
  const results = [];

  for (const width of args.widths) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
      hasTouch: width < 1024,
    });
    const page = await context.newPage();
    let loadError = null;
    try {
      const res = await page.goto(args.url, { waitUntil: 'networkidle', timeout: 30_000 });
      // A 404 page has no overflow, no clipped text, and no small targets.
      // Auditing one and reporting "all checks passed" is worse than not running.
      if (res && res.status() >= 400) {
        loadError = `HTTP ${res.status()} — audited nothing`;
      } else {
        const bodyText = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
        if (bodyText === 0) loadError = 'page body is empty — audited nothing';
      }
    } catch (e) {
      loadError = e.message;
    }

    let data = null;
    if (!loadError) {
      // let fonts settle so gutter and clip measurements are real
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
      await page.waitForTimeout(300);
      data = await page.evaluate(collect, { MIN_TAP, headerSel: args.header, heroSel: args.hero, containerSel: args.container });
      await page.screenshot({ path: path.join(args.out, `${width}.png`), fullPage: true });
    }

    results.push({ width, loadError, data });
    await context.close();
  }

  await browser.close();
  report(results, args);
}

function report(results, args) {
  let failed = 0;
  const fail = (msg) => { failed++; console.log(`  FAIL  ${msg}`); };
  const pass = (msg) => console.log(`  pass  ${msg}`);

  console.log(`\nresponsive-audit — ${args.url}\n`);

  for (const { width, loadError, data } of results) {
    console.log(`${width}px`);
    if (loadError) { fail(`page did not load: ${loadError}`); console.log(''); continue; }

    const { overflow, clipped, smallTargets, stacking, gutters } = data;

    if (overflow.overflows) {
      fail(`horizontal overflow: scrollWidth ${overflow.scrollWidth} > viewport ${overflow.clientWidth}`);
      for (const c of overflow.culprits.slice(0, 5)) console.log(`          ${c.el}  (right: ${c.right})`);
    } else pass('no horizontal overflow');

    if (clipped.length) {
      fail(`${clipped.length} element(s) clipping content`);
      for (const c of clipped.slice(0, 5)) console.log(`          ${c.el}  cut ${c.axis} by ${c.overflowBy}px`);
    } else pass('nothing clipped');

    if (smallTargets.length) {
      fail(`${smallTargets.length} touch target(s) under ${MIN_TAP}x${MIN_TAP}`);
      for (const t of smallTargets.slice(0, 5)) console.log(`          ${t.el}  ${t.w}x${t.h}`);
    } else pass(`all touch targets >= ${MIN_TAP}x${MIN_TAP}`);

    if (!stacking.checked) console.log(`  skip  header/hero stacking: ${stacking.reason}`);
    else if (stacking.pass) pass(`header above hero${stacking.note ? ` (${stacking.note})` : ''}`);
    else {
      fail(`hero paints over header at ${stacking.point} — hit ${stacking.hit}, header z-index ${stacking.headerZ}`);
      for (const a of stacking.stackingAncestors) {
        console.log(`          new stacking context from ${a.why.join(', ')} on ${a.el}`);
      }
    }

    // Left-vs-right asymmetry within one element is unambiguous, so it fails.
    // Comparing gutters *between* sections needs to know which elements are the
    // content column; guessing produces false alarms, so it only fails when the
    // caller names them with --container.
    if (gutters.asymmetric.length) {
      fail(`${gutters.asymmetric.length} element(s) with unequal left/right gutter`);
      for (const g of gutters.asymmetric.slice(0, 5)) console.log(`          ${g.el}  L${g.left} R${g.right}`);
    } else if (args.container && gutters.distinct.length > 1) {
      fail(`containers matching "${args.container}" do not share a gutter: ${gutters.distinct.join(', ')}px`);
    } else {
      pass('gutters symmetric');
      if (!args.container && gutters.distinct.length > 1) {
        console.log(`          content starts at ${gutters.distinct.join(', ')}px — pass --container SEL to enforce one value`);
      }
    }

    console.log('');
  }

  console.log(failed === 0
    ? `all checks passed. screenshots in ${args.out}/\n`
    : `${failed} check(s) failed. screenshots in ${args.out}/ — look at them too.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
