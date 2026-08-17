# Frontend Guard Rules
![Uploading Screenshot 2026-08-17 at 7.31.55 PM.png…]()

Seven skills for agents doing frontend work in React and Next.js.

I wrote these because I kept typing the same corrections to the same agents. Hope it can be useful to somebody :).

One idea runs under all seven, which is that an agent does not get to call the work finished because it read its own code and the code looked right. It has to open the page and drive it.

## Install

```bash
npx skills add Rifa-G/frontend-guard-rules
```

This works with Claude Code, Codex, Cursor, Amp, Antigravity, and about a dozen more, because the skills land in `.agents/skills` and get linked into whatever layout your agent expects.

## What is in it

| Skill | What it holds the agent to |
| --- | --- |
| `frontend-change-recon` | Read the whole ticket, trace the real user flow, search for the component that already exists before building a second one, and enumerate every state the feature needs, so loading, empty, error, retry, disabled, validation, permission, and partial data all get built |
| `react-state-discipline` | `useEffect` is for syncing with something outside React, meaning a subscription, a timer, a browser API, or a third party library. Never for derived values, transformations, event handling, or anything you could calculate while rendering |
| `page-shell-invariants` | Gutters come from tokens and stay equal. The header stacks above the hero even when it mounts late or starts hidden. The page height does not jump. Navigation links prefetch on hover and on keyboard focus, so someone tabbing through gets the same speed as someone pointing |
| `responsive-layout-audit` | Mobile, tablet, desktop, and wide desktop, every time. And no hiding a layout bug behind an arbitrary `z-index`, a negative margin, a fixed pixel width, or `overflow: hidden` |
| `runtime-hygiene` | A clean console counts as part of the work. No React warnings, no hydration mismatches, no failed requests, no unhandled rejections, and no quieting any of it with `any`, a skipped test, or an unexplained lint suppression |
| `e2e-flow-verification` | Drive the whole flow through the interface the way a person would, with slow requests, failed requests, empty data, long names, huge result sets, repeated clicks, refreshes, and back navigation. Then check the features next door still work |
| `design-preference-ledger` | Write down the choices you state, and count how often you restate them. Something said once is a preference, twice is a strong one, and three times becomes a rule the agent treats as a constraint |

## Two of them ship code

`responsive-layout-audit` and `runtime-hygiene` come with Playwright scripts, because an agent will tell you it checked the console far more readily than it will actually check the console. A script produces output it has to answer for.

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
node .claude/skills/responsive-layout-audit/scripts/responsive-audit.mjs http://localhost:3000
node .claude/skills/runtime-hygiene/scripts/runtime-watch.mjs http://localhost:3000 --reload
```

`responsive-audit.mjs` loads your page at 375, 768, 1280, and 1920, then checks for horizontal overflow, clipped text, touch targets under 44 by 44, and whether the header really does sit above the hero. That last one it settles by hit testing the point where the two overlap, not by reading `z-index`, because any ancestor with a `transform` or a `filter` on it quietly opens a new stacking context and your `z-index: 9999` stops meaning anything. When it fails, it names that ancestor.

`runtime-watch.mjs` drives the page while listening for console errors, React warnings, hydration mismatches, failed requests, and unhandled promise rejections, and it sorts them by kind so you can see which one you have. It refuses to report on a page that returned a 404, because an error page is quiet and would otherwise pass everything.

Both exit non-zero when they find something, so you can put them in CI.

## What these skills leave alone

Three skills already cover their areas better than I would by rewriting them, so these seven point at them by name instead.

1. `vercel-labs/agent-skills@vercel-react-best-practices` for render performance
2. `anthropics/skills@frontend-design` for visual fidelity
3. `addyosmani/web-quality-skills@accessibility` for WCAG, axe, and Lighthouse

## One thing to know about installing any skills pack

The `skills` CLI follows symlinks when it installs, so a symlink inside a skill arrives as a real file holding whatever it pointed at. Since `.claude/skills/` usually gets committed, a pack shipping a symlink to something like `.env` would drop those contents straight into your working tree for your next commit to carry off. This pack has no symlinks in it, which you can check yourself in about a second, and it is worth checking on anything else you install too.
