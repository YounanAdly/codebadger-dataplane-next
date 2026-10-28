---
description: "Use when a React change affects rendering cost: lists, memoization, images, or render volume. Enforces evidence-based performance review — no speculative optimization."
applyTo: "**/*.tsx,**/*.jsx"
---

# React Performance

## Scope

Applies to rendering cost in component files. Flag only issues with a realistic user-visible cost (large N, per-frame work, jank, measurable re-render storms) — micro-optimizations are `low`/`info` at most.

## Review rules

1. **Expensive work in render**: filtering/sorting large collections, heavy computation, or building large object literals inside a component body that runs on every render — precompute in `useMemo` (with real deps) or upstream.
2. **Long lists**: hundreds/thousands of rows rendered without virtualization (`react-window`/`react-virtuoso`/project's list solution) or without the project's pagination — flag with the row-count evidence.
3. **Memoization is evidence-based**: `React.memo`/`useMemo`/`useCallback` pay rent only when the wrapped subtree is expensive AND the props are stable — flag both "expensive subtree re-renders on every keystroke" and reflexive memo-everything. Do not recommend adding memo where props change anyway.
4. **Unstable props defeat memoization**: inline object/array/function literals passed to memoized children — either stabilize or drop the memo; explain which.
5. **Effects that render-loop**: setState in an effect whose dep the same effect changes — infinite or repeated fetch cycles.
6. **Context value churn**: a context provider whose `value` is a fresh object every render re-renders all consumers — memoize the value or split contexts when consumers are heavy.
7. **Images**: `loading="lazy"` + explicit dimensions (or the project's image component) for below-fold raster images; no layout shift from unsized media.

## Anti-patterns to flag

```jsx
// BAD — filter+sort on every render for a big list
const visible = allItems.filter(...).sort(byName); // in component body

// BAD — memoized child fed fresh objects
<MemoRow key={id} style={{ margin: 8 }} onSelect={() => pick(id)} item={item} />

// BAD — fetch loop
useEffect(() => { setData(derive(data)); }, [data]); // dep changes every run
```

## Positive recommendations

- Prefer code-splitting heavy routes/components (`React.lazy`) where the project already splits.
- Profile-first language: describe the mechanism and trigger condition; never claim measured numbers you do not have.

## Preserve existing conventions

- The project's existing render pattern (CSS frameworks, inline styles) is not a perf finding unless this diff demonstrably adds cost.
