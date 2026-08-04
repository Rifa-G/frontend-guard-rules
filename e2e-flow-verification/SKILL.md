---
name: e2e-flow-verification
description: Use when finishing a frontend ticket or pull request, or when asked to verify that a change works - requires driving the complete user flow through the real interface with Playwright or a computer-use agent, testing the happy path plus slow and failed requests, retries, invalid input, empty data, long text, missing assets, large datasets, repeated clicks, refreshes, back navigation, and direct URL entry, sweeping nearby features for regressions, and never declaring work complete from reading code alone.
---

# End-to-end flow verification

Reading the code tells you what you wrote. It does not tell you what the user
gets. The work is not complete until you have driven it.

## The rule

**Never declare work complete based on reading code.** Completion requires
direct verification of the rendered interface and the full user journey. Unit
tests and implementation-level assertions are evidence about units, not about the
feature.

Drive the real interface with Playwright or a computer-use agent, as a user
would: click the things a user clicks, type what a user types, wait how long a
user waits.

## 1. The happy path, as a user

Start where the user starts, not where the component mounts. If the feature is
reached through a menu, go through the menu. Complete the flow to its actual
end — the confirmation, the persisted record, the updated list — not to the
moment your component stopped rendering.

Then reload and confirm the result survived.

## 2. The edge matrix

Every ticket, all of it:

| Case | What it catches |
| --- | --- |
| Slow request | Missing loading state, layout shift, a button that stays clickable |
| Failed request | Missing error state, an error that gives the user nowhere to go |
| Retry after failure | Retry that does not actually re-run, or that duplicates |
| Invalid input | Validation that fires too early, too late, or not at all |
| Empty data | Empty state that looks like a broken loading state |
| Long text | Overflow, clipping, a layout built for the sample data |
| Missing assets | Broken image icons, collapsed layout, no alt text |
| Large dataset | Freezes, unkeyed lists, pagination that loses position |
| Repeated clicks | Duplicate submissions, double-charged actions, race conditions |
| Refresh mid-flow | State that only existed in memory |
| Back navigation | Stale views, lost scroll, a form that resubmits |
| Direct URL entry | Routes that assume you arrived from somewhere else |

## 3. Realistic data, not sample data

Sample data is chosen to make the design look good. Test with data chosen to make
it fail:

- Names long enough to wrap twice, and names one character long
- Missing images, and images with the wrong aspect ratio
- Zero results, one result, and ten thousand results
- Special characters, emoji, right-to-left text, and HTML in user strings
- Responses that take eight seconds
- Malformed API responses: a null where an object was promised, a missing field,
  an unexpected enum value

That last one matters most. Frontends routinely assume the API contract is
honored. Break it deliberately once and see whether the page shows an error or a
blank screen.

## 4. Async correctness

Verify by driving, not by reading:

- **Duplicate submissions** — click submit five times fast. One request.
- **Stale responses** — start a slow request, change the input, let the first
  return. The old response must not overwrite the new state.
- **Race conditions** — trigger two overlapping actions and confirm the last one
  wins consistently.
- **Pending controls** — every control that initiates the action is disabled or
  guarded while it is in flight.
- **Unhandled errors** — every await has a path for its rejection.

## 5. Regression sweep

The requested path working is not enough if another path broke. Before calling it
done, exercise:

- The feature immediately adjacent in the UI
- Anything sharing a component, hook, or store you touched
- The route you changed, entered from a different direction
- The most-used flow in the area, even if unrelated

`git diff --name-only` gives you the blast radius. Anything importing a file you
changed is in scope.

## 6. When something fails

Do not patch the symptom and move on. In order:

1. Find the actual cause. Not a plausible cause — the real one, confirmed.
2. Fix it.
3. **Restart the flow from a clean state.** Fresh context, cleared storage,
   reloaded page. A fix verified on top of a dirty session is not verified.
4. Test it again, fully.

Repeat until the implementation and every related flow pass. A flow that passed
before your fix must be re-run after it.

## 7. Alert the human immediately

Stop and say so, right away, when you hit:

- Credentials, secrets, or an authentication wall you cannot pass
- A destructive or irreversible action
- A product decision the ticket does not answer
- An environment that will not run, after one honest attempt to fix it
- A defect that is out of scope but blocks verification

Do not guess, do not work around it silently, do not carry on and report success
for the part that worked. Say what is blocked, what you tried, and what you need.
An early interruption costs a minute; a silent guess costs the ticket.

## Checklist

- [ ] Happy path driven through the real UI, end to end.
- [ ] Every row of the edge matrix exercised.
- [ ] Realistic and hostile data used.
- [ ] Repeated clicks, stale responses, and pending states verified.
- [ ] Nearby features swept for regressions.
- [ ] Every failure re-tested from a clean state after its fix.
- [ ] Console clean throughout — see `runtime-hygiene`.
- [ ] All four breakpoints checked — see `responsive-layout-audit`.
- [ ] Nothing claimed complete on the strength of reading code.

## Related skills

- `runtime-hygiene` — run alongside, the console must be clean during these flows
- `responsive-layout-audit` — the same flows at four widths
- `frontend-change-recon` — the flow you traced there is the flow you verify here
