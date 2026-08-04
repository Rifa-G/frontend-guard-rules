---
name: react-state-discipline
description: Use when writing or reviewing React code that involves useEffect, useState, derived values, data transformation, or syncing state between components - enforces that useEffect is only for external system synchronization and never for derived state, transformations, event handling, or values computable during render. Use when debugging extra re-renders, stale values, infinite effect loops, or state that drifts out of sync.
---

# React state discipline

Two rules. Almost every React state bug is a violation of one of them.

1. `useEffect` is only for synchronizing with an **external system**.
2. State holds only what cannot be derived.

## Rule 1: what `useEffect` is for

An external system is something outside React that does not know when your
component renders:

- A subscription — WebSocket, event emitter, store outside React.
- A timer — `setInterval`, `setTimeout`.
- A browser API — `IntersectionObserver`, `matchMedia`, `localStorage`,
  `document.title`, focus, scroll position.
- A third-party library holding its own state — a map, a chart, an editor.

That is the whole list. If you are reaching for `useEffect` and cannot name the
external system, you do not need `useEffect`.

## The misuse table

| You are using an effect to... | Do this instead |
| --- | --- |
| Compute a value from props or state | Calculate it during render. It is just a variable. |
| Filter, sort, or map a list when data changes | Calculate during render. Wrap in `useMemo` only if profiling shows it is expensive. |
| Reset state when a prop changes | Give the component a `key`. React remounts it and the state resets for free. |
| Adjust some state when another state changes | Derive it, or compute both from one source of truth. |
| Respond to a click, submit, or change | Put the logic in the event handler. That is what handlers are for. |
| Fetch data on mount | Use the framework's data loading, or a query library. Hand-rolled fetch effects leak race conditions. |
| Notify a parent that something changed | Call the parent's callback in the event handler that caused the change. |
| Copy a prop into state so you can edit it | Lift the state, or key the component. Copied props go stale. |

## Worked example

Derived state in an effect. This renders twice, and `fullName` is stale for one
of them:

```jsx
const [fullName, setFullName] = useState('');
useEffect(() => {
  setFullName(`${first} ${last}`);
}, [first, last]);
```

It is a variable:

```jsx
const fullName = `${first} ${last}`;
```

Resetting on prop change. This is a race with whatever else renders:

```jsx
useEffect(() => { setDraft(''); }, [userId]);
```

Let React do it:

```jsx
<Editor key={userId} />
```

## Rule 2: keep state minimal

Before adding state, ask in order:

1. **Can it be calculated during render?** Then calculate it. Not state.
2. **Does it come from the server?** Then it belongs to your data layer, not a
   `useState`. Do not copy server data into local state — you have just created
   two sources of truth and a synchronization problem.
3. **Does anything render differently because of it?** If not, it is a ref, not
   state.
4. **Am I adding this only to make rendering happen in the right order?** Stop.
   Rendering order is not something you coordinate manually. Find the real
   dependency.

Signs you have violated rule 2: two `useState` calls that always change together,
a `useEffect` whose only job is to call a setter, or a state variable that is
always `someOtherState.length > 0`.

## Legitimate effects look like this

They subscribe, and they clean up:

```jsx
useEffect(() => {
  const mq = window.matchMedia('(min-width: 768px)');
  const onChange = (e) => setIsWide(e.matches);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}, []);
```

External system, named. Subscription, established. Cleanup, returned. If your
effect has no cleanup and no external system, look harder at it.

## Review checklist

- Every `useEffect` names the external system it synchronizes with.
- No effect body consists only of `setState` calls.
- No state variable is derivable from other state or props.
- No server data is copied into `useState`.
- Effects that subscribe also unsubscribe.

## Related skills

- Render performance and memoization: `vercel-labs/agent-skills@vercel-react-best-practices`
- Before you start: `frontend-change-recon`
