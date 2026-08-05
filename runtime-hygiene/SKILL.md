---
name: runtime-hygiene
description: Use before opening a pull request or claiming any frontend work is complete - requires a clean browser console, no React warnings, no hydration mismatches, no failed network requests, no unhandled promise rejections, and passing tests, type check, lint, and production build, with no silencing via any, unsafe casts, ignored errors, skipped tests, or unexplained suppressions. Ships a Playwright script that collects all runtime errors from a real page load.
---

# Runtime hygiene

A feature that works while the console is full of errors is not finished. The
errors are telling you about the paths you did not test.

Two gates: the browser must be quiet, and the toolchain must pass. Neither may be
satisfied by suppression.

## Gate 1: the browser is quiet

Run the flow and watch for all five:

| Signal | Why it is not cosmetic |
| --- | --- |
| Console errors | Something threw. There is a path where your UI is broken. |
| React warnings | Keys, invalid nesting, `act`, controlled-to-uncontrolled — each predicts a specific class of bug you have not hit yet. |
| Hydration mismatches | The server and client rendered different HTML. React discards and re-renders, and the state that was there is now gone. |
| Failed requests | 4xx and 5xx, and anything CORS-blocked. A silent failure is still a failure. |
| Unhandled promise rejections | An async path with no error handling. It will surface as a blank screen for someone. |

### Run the script

```bash
node scripts/runtime-watch.mjs http://localhost:3000/your-route
```

Playwright must be resolvable from the project root, since Node resolves it by
walking up from the script location. If the script exits 2 saying playwright is
not installed, run the install command above from your project root, not from
inside the skill directory.

Collects everything above from a real page load and prints a classified report,
exiting non-zero if anything fired. Options:

```bash
--reload          load twice, to catch hydration on a warm cache
--click SELECTOR  click something after load, repeatable
--wait MS         settle time before reporting (default 2000)
--allow REGEX     suppress a known-noisy message, repeatable — see below
```

### Hydration specifically

Hydration mismatches are the ones people rationalize. They come from:

- `Date`, `Math.random`, or `crypto` in render
- `typeof window !== 'undefined'` branches in render
- Reading `localStorage` or `matchMedia` during the first render
- Locale or timezone formatting that differs between server and client
- Invalid HTML nesting that the browser silently repairs, so the client tree no
  longer matches the server string

The fix is not `suppressHydrationWarning`. That attribute is for content that is
legitimately expected to differ, such as a rendered timestamp. Using it to quiet
a mismatch you do not understand hides the state loss, it does not prevent it.

### About `--allow`

Some third-party scripts are permanently noisy and you do not control them. You
may suppress those with `--allow`, on two conditions: the pattern is narrow
enough to match only that message, and you write down why. A broad `--allow`
pattern is the same defect as an unexplained lint suppression.

## Gate 2: the toolchain passes

```bash
npm test          # or the project's runner
npm run typecheck # tsc --noEmit
npm run lint
npm run build     # the production build, not dev
```

Run the **production build**. It catches what dev never will: bundler failures,
stricter type resolution, dead-code elimination changing behavior, environment
variables missing outside dev, and server-only code that leaked into a client
bundle.

## What you may not do to make these pass

These are the moves that convert a real failure into a hidden one:

- `any`, or a cast to `unknown` and back, to silence a type error
- `as` casts asserting something the compiler correctly doubts
- `@ts-ignore` or `@ts-expect-error` without a comment naming the reason
- `eslint-disable` without a comment naming the reason
- `.skip`, `.only`, or a deleted assertion to get a suite green
- `try { ... } catch {}` with an empty body
- `catch (e) { console.log(e) }` where the user is shown nothing and the flow
  continues as if it succeeded
- `?.` chained far enough that a missing value silently produces `undefined`
  instead of an error you would have seen

If a suppression is genuinely correct, the comment explaining why is what makes
it correct. No comment, no suppression.

## Error handling that is actually done

- Every `catch` either recovers, or surfaces the failure to the user, or
  rethrows. Doing none of the three is swallowing it.
- Every async user action has a visible failure state, not just a happy path.
- Network errors are distinguished from application errors — a 500 and a
  validation rejection do not deserve the same message.
- The user is always told what to do next. "Something went wrong" with no retry
  is an unfinished error state.

## Checklist

- [ ] Console clean through the whole flow, not just on load.
- [ ] No React warnings.
- [ ] No hydration mismatches.
- [ ] No failed requests, or failures are deliberate and handled.
- [ ] No unhandled rejections.
- [ ] Tests, typecheck, lint, and the production build all pass.
- [ ] No new suppression without a comment naming the reason.

## Related skills

- Drive the flow this watches: `e2e-flow-verification`
- Layout checks in the same pass: `responsive-layout-audit`
