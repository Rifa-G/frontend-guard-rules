# Frontend Guard Rules

A skills pack for agents doing frontend work in React and Next.js codebases.

It encodes one team's doctrine: how to approach a ticket, what never to build,
what the page shell must always guarantee, and what counts as proof that the work
is done. The through-line is that **an agent may not declare work complete on the
strength of having read the code.**

## Skills

| Skill | Owns |
| --- | --- |
| `frontend-change-recon` | Read the ticket, trace the flow, reuse before building, enumerate every state |
| `react-state-discipline` | `useEffect` only for external systems; state holds only what cannot be derived |
| `page-shell-invariants` | Consistent gutters, header above hero, stable height, prefetch on hover or focus |
| `responsive-layout-audit` | Four breakpoints, and no masking layout bugs with CSS |
| `runtime-hygiene` | Clean console, clean network, clean build — with no suppressions |
| `e2e-flow-verification` | Drive the real UI, edge matrix, regression sweep, escalate when blocked |
| `design-preference-ledger` | Record stated preferences; repetition promotes them to constraints |

## What this pack deliberately does not cover

Three widely used skills already own these domains, and this pack delegates to
them by name rather than restating them:

- Render performance — `vercel-labs/agent-skills@vercel-react-best-practices`
- Design fidelity — `anthropics/skills@frontend-design`
- Accessibility — `addyosmani/web-quality-skills@accessibility`

## Scripts

Two skills ship runnable checks. Both need Playwright:

```bash
npm i -D playwright && npx playwright install chromium
```

```bash
# four breakpoints: overflow, clipping, touch targets, header stacking, gutters
node responsive-layout-audit/scripts/responsive-audit.mjs http://localhost:3000

# console errors, React warnings, hydration mismatches, failed requests, rejections
node runtime-hygiene/scripts/runtime-watch.mjs http://localhost:3000 --reload
```

Both exit non-zero on failure, so they drop straight into CI.

## Install

```bash
npx skills add https://skills.sh/p/<pack-id>
```
