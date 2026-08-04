---
name: responsive-layout-audit
description: Use when changing CSS or layout, or before calling any frontend work done - tests mobile, tablet, desktop, and wide desktop for horizontal overflow, clipping, bad wrapping, overlap, and undersized touch targets, and forbids masking layout bugs with arbitrary z-index, negative margins, absolute positioning, fixed pixel widths, or overflow hidden. Ships a Playwright script that checks all four breakpoints automatically. Use when something looks broken on mobile or you are tempted to add a z-index.
---

# Responsive layout audit

Two halves: test at four widths, and refuse to paper over what you find.

## Part 1: the four breakpoints

Minimum coverage, every time:

| Name | Width | Represents |
| --- | --- | --- |
| Mobile | 375 | iPhone SE through 13 mini |
| Tablet | 768 | iPad portrait |
| Desktop | 1280 | The laptop most people use |
| Wide | 1920 | External monitors, where max-widths fail |

Look for, at each:

- **Horizontal overflow** — the page scrolls sideways. Always a bug.
- **Clipping** — text or controls cut off by a fixed-height or hidden-overflow box.
- **Wrapping** — labels breaking mid-word, buttons wrapping to two lines, tables
  collapsing into unreadable columns.
- **Overlap** — elements painting on top of each other, usually a sticky header.
- **Touch targets** — anything tappable smaller than 44 by 44 CSS pixels.

Wide desktop is the one people skip, and it is where centered max-width layouts
strand content on one side and hero images stretch past their intended crop.

## Run the script

```bash
node scripts/responsive-audit.mjs http://localhost:3000/your-route
```

It loads the URL at all four widths and reports:

- horizontal overflow, with the specific elements wider than the viewport
- elements clipping their own content
- interactive elements under 44x44
- whether the header actually hit-tests above the hero
- left and right gutter values, and whether they match

It writes screenshots to `./responsive-audit/` and exits non-zero on any failure.
It is a starting point, not a substitute for looking at the screenshots — it
cannot tell you that the layout is ugly, only that it is broken.

## Part 2: do not hide the bug

When a layout misbehaves, there is a fast way to make the symptom disappear and a
slower way to fix the cause. The fast way is a defect.

Forbidden as fixes:

- Arbitrary `z-index` values — `z-index: 9999` is not a fix, it is an escalation
  in a war you will lose next sprint.
- Negative margins tuned by eye to pull something into place.
- Absolute positioning to escape a layout you did not want to understand.
- Fixed pixel widths on things that must adapt.
- `overflow: hidden` to make an overflow disappear rather than not happen.

Each of these is legitimate in its place. What is forbidden is reaching for one
because something looks wrong and you do not know why.

### Symptom to cause

| Symptom | Usual real cause | Actual fix |
| --- | --- | --- |
| Horizontal scrollbar | A fixed-width child, a `100vw` element inside a padded parent, or a long unbroken string | Make the child `max-width: 100%`; use `100%` not `100vw`; `overflow-wrap: anywhere` on user text |
| Text cut off | Fixed `height` where content is variable | `min-height`, let it grow |
| Flex child overflows | Flex items default to `min-width: auto` and refuse to shrink | `min-width: 0` on the flex child |
| Grid blowout | `1fr` resolves to `minmax(auto, 1fr)` | `minmax(0, 1fr)` |
| Header covered despite high `z-index` | An ancestor has `transform`, `filter`, `opacity < 1`, or `backdrop-filter`, creating a new stacking context | Remove the ancestor property, or move the header out of that context |
| Sticky element not sticking | An ancestor has `overflow: hidden` or `auto` | Remove the overflow, or restructure so the scroll container is the right one |
| Content under a fixed header | The header left the flow and nothing reserved its space | Reserve the height, or use `scroll-margin-top` for anchors |
| Element wider than parent | `box-sizing` is `content-box` somewhere | `box-sizing: border-box` |
| Modal behind the backdrop | Two stacking contexts, not one z-index problem | Portal the modal to the body |

### The question to ask

Before adding any of the forbidden five, answer this in one sentence: **why is
the element in the wrong place?** If you cannot, you are not fixing it, you are
hiding it. Delete the property and find out.

When you genuinely do need `z-index`, use named layer tokens, not magic numbers:

```css
:root { --z-header: 100; --z-dropdown: 200; --z-modal: 300; --z-toast: 400; }
```

If a new value has to slot between two existing ones, the stacking design is
wrong. Fix the design, do not add `--z-header-but-higher`.

## Checklist

- [ ] All four widths tested, screenshots reviewed by eye.
- [ ] No horizontal overflow at any width.
- [ ] Nothing clipped, overlapping, or wrapping badly.
- [ ] Every touch target at least 44x44.
- [ ] Header hit-tests above the hero.
- [ ] Gutters equal and consistent.
- [ ] No new arbitrary `z-index`, negative margin, or `overflow: hidden`, unless
      you can state in one sentence why it is correct.

## Related skills

- Shell rules these checks enforce: `page-shell-invariants`
- Console and network during the same pass: `runtime-hygiene`
- Full flows, not just layout: `e2e-flow-verification`
