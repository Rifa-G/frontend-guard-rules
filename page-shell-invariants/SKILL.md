---
name: page-shell-invariants
description: Use when building or modifying a page shell, header, navigation, hero section, or top-level layout - enforces consistent tokenized page margins and gutters, the header always stacking above the hero including when it mounts late or is initially hidden, stable page height with no layout shift, and prefetching navigation links on hover or keyboard focus. Use when a page jumps as it loads, a hero paints over the header, gutters differ between sections, or navigation feels slow.
---

# Page shell invariants

Four things must be true of every page, on every route, at every breakpoint.
They are invariants, not preferences: if one is false, the page is broken, even
if it looks fine on your machine.

1. Margins are consistent and come from tokens.
2. The header stacks above the hero. Always.
3. Page height is stable. Nothing jumps.
4. Navigation prefetches on hover or focus.

## 1. Margins and gutters

One horizontal rhythm for the whole page. Sections do not each invent their own.

- Gutters come from design tokens or a container primitive, never from a number
  typed into a component.
- Left and right gutters are equal, at every breakpoint.
- Every section on a page shares the same content width and gutter. A section
  that is 24px inset while its neighbor is 32px is a defect, and it is visible —
  users read the misalignment as sloppiness even when they cannot name it.

```css
/* one container, everything uses it */
.container {
  width: 100%;
  max-width: var(--content-max);
  margin-inline: auto;
  padding-inline: var(--gutter);
}
```

If you need an element to break the gutter — a full-bleed image, an edge-to-edge
banner — do it with an explicit, named full-bleed utility. Do not do it with a
negative margin you tuned by eye. See `responsive-layout-audit`.

## 2. The header stacks above the hero

The easy case works by accident. These are the cases that break, and they are the
ones to build for:

**The header mounts late.** It waits on auth, a feature flag, or a client-only
render. The hero paints first, then the header appears and shoves everything
down. Reserve the header's space from the first paint — a wrapper with the
header's height, or a layout that allocates the row whether or not the header has
rendered.

**The header is hidden, then revealed.** A scroll-aware or auto-hiding header
still occupies a stacking context while hidden. Reveal must not reflow the page:
animate `transform`, never `height` or `display`.

**A new stacking context ate your `z-index`.** This is the one that wastes an
afternoon. Any ancestor with a `transform`, `filter`, `opacity` below 1,
`will-change`, `backdrop-filter`, or `position: fixed` creates a new stacking
context. Inside it, your header's `z-index: 50` cannot compete with anything
outside it, at any value.

So: **verify by hit-testing, not by reading `z-index`.** At the point where the
header and hero overlap, ask the document what is actually on top:

```js
const el = document.elementFromPoint(x, y);
// must be the header or a descendant of it
```

Reading `z-index` off the header tells you what you asked for. Hit-testing tells
you what you got. `responsive-audit.mjs` in `responsive-layout-audit` does this
check at all four breakpoints.

**Documentation-style pages** that intentionally render no header are an accepted
exception to this invariant. The other three still apply — no exemption on
margins, height stability, or prefetch.

## 3. Stable page height

The page does not jump. Not on load, not as fonts swap, not as images decode, not
as async content lands.

- Give images explicit `width` and `height`, or an `aspect-ratio`, so their box
  exists before the bytes do.
- Reserve space for anything loaded asynchronously — banners, ads, embeds,
  client-only widgets. A skeleton of the wrong height is worse than no skeleton.
- Use `font-display: optional` or size-adjusted fallbacks so the font swap does
  not reflow text.
- Set a `min-height` on the main content region so short pages do not collapse
  and leave the footer floating mid-viewport.
- Avoid `100vh` on mobile — it excludes the dynamic browser chrome and causes a
  jump on scroll. Use `100dvh`.

The check: load the page on a throttled connection and watch the layout. If
anything moves after first paint that the user did not cause, it is a defect.

## 4. Prefetch on hover or focus

Navigation should already be loading by the time the click lands.

Prefetch when a link is hovered **or** focused. Focus means the link received
keyboard focus — `focusin`, matching `:focus-visible`. A keyboard user tabbing
through the nav must get the same head start as a mouse user pointing at it.
Hover-only prefetch quietly makes the site slower for people navigating by
keyboard, which makes it an accessibility gap and not merely a missed
optimization.

```jsx
<Link
  href={href}
  onMouseEnter={() => router.prefetch(href)}
  onFocus={() => router.prefetch(href)}
/>
```

Notes:

- In Next.js, `<Link>` prefetches in the viewport by default; the hover and focus
  handlers matter for links that are off-screen, in dropdowns, or behind a menu.
- Prefetch is idempotent in practice, but do not attach it to `mousemove`.
- Do not prefetch destinations that mutate, cost money, or are paginated deeply.
- Respect `navigator.connection.saveData` and slow effective connection types.

## Checklist

- [ ] Gutters come from tokens; left equals right at 375, 768, 1280, 1920.
- [ ] Every section shares one content width.
- [ ] Header hit-tests above the hero at all four widths.
- [ ] Header space is reserved before the header renders.
- [ ] Hide and reveal animate `transform`, not layout.
- [ ] Images and async regions have reserved space.
- [ ] No `100vh` on mobile.
- [ ] Nav links prefetch on both hover and focus.

## Related skills

- Verify these mechanically: `responsive-layout-audit`
- Render performance and bundle cost: `vercel-labs/agent-skills@vercel-react-best-practices`
- Visual fidelity against the design: `anthropics/skills@frontend-design`
