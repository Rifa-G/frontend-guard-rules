---
name: frontend-change-recon
description: Use before writing any frontend code for a ticket, issue, PR, or feature request - covers reading the full ticket, inspecting routes and API contracts and the design system, searching for existing components and hooks and tokens to reuse instead of duplicating, and enumerating every UI state the feature needs. Use when starting a frontend task, adding a component, implementing a design, or when tempted to create a new abstraction.
---

# Frontend change recon

Most bad frontend work is decided before the first line is written. You build a
component that already exists, you miss the error state, or you implement a flow
you never traced end to end. Recon is the fix.

Do not write code until you have finished this skill.

## 1. Read the whole ticket

The whole thing, including comments, linked designs, and linked issues. Ticket
bodies routinely contradict their own titles, and the constraint that breaks your
approach is usually in a comment.

Write down, for yourself:

- What the user is trying to accomplish, in one sentence.
- Where the flow starts and where it ends.
- What is explicitly out of scope.

If the ticket is ambiguous in a way that would change what you build, ask now.
Asking after you have built the wrong thing costs both of you.

## 2. Trace the complete user flow

Open the actual routes. Follow the path a real user takes, from entry point to
completion, including how they got there and where they go next.

Inspect before you touch:

- **Routes** — the pages this change appears on, and how they are reached.
- **Components** — what renders today, and which of it you can reuse.
- **API contracts** — request and response shapes, error shapes, status codes,
  pagination, and what the server does when things go wrong. Read the actual
  types, not the happy-path example.
- **Design system** — the tokens, primitives, and layout components available.
- **Tests** — what is already covered, and what the existing tests assume.
- **Nearby implementations** — how the codebase already solved this problem
  somewhere else. Match it.

## 3. Search before you create

Before writing any new component, hook, utility, constant, or token, search the
codebase for it. Search by concept, not just by name, because the thing you want
is often named something you would not have guessed.

```bash
# names
rg -i "modal|dialog|drawer" --files
# usage
rg "useDebounce|useMediaQuery|formatCurrency" -l
# tokens
rg -i "spacing|--space|colors\." --glob "*token*"
```

Then decide honestly:

| Situation | Do this |
| --- | --- |
| Something does exactly this | Use it. |
| Something does most of this | Extend it, or add a prop. Do not fork it. |
| Two things already do this | Say so. Duplicated abstractions are a bug you found, worth reporting even if you do not fix it now. |
| Nothing does this | Build it, in the established pattern, in the place the codebase would expect. |

A second component that does what an existing one already does is a defect, even
when the ticket did not mention it.

## 4. Enumerate every state before building any

Feature work is judged on the states nobody asked for. List them explicitly, then
build all of them:

- **Loading** — initial, and refetching, which look different.
- **Empty** — no results yet, versus no results possible.
- **Success** — including the partial case where some data arrived and some did not.
- **Error** — and distinguish recoverable from terminal.
- **Retry** — how the user gets out of the error state.
- **Disabled** — and why, communicated to the user.
- **Validation** — per-field and form-level.
- **Permission** — the user is allowed to see this but not do it.

If a state cannot occur, write down why. "It cannot happen" is a claim about the
API contract, and you just read the API contract, so you can check it.

## 5. Focus management for dialogs

Delegated broadly to `addyosmani/web-quality-skills@accessibility`, with one rule
kept here because it is missed constantly:

Any dialog, modal, drawer, or popover must trap focus while open and return focus
to the element that opened it when closed. Test it with the keyboard alone,
before you consider the component finished.

## Related skills

- Design fidelity: `anthropics/skills@frontend-design`
- Accessibility: `addyosmani/web-quality-skills@accessibility`
- Render performance: `vercel-labs/agent-skills@vercel-react-best-practices`
- State decisions you are about to make: `react-state-discipline`
- Page shell you are about to build inside: `page-shell-invariants`
