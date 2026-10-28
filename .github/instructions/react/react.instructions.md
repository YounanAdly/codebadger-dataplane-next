---
description: "Use when a React change builds, composes, or refactors components and hooks. Enforces hook correctness, effect hygiene, and rendering safety without mandating a pattern."
applyTo: "**/*.tsx,**/*.jsx"
---

# React Components & Hooks

## Scope

Applies to component files (`.tsx`/`.jsx`): hook correctness, effect ownership, rendering safety. State architecture and performance have their own instruction files.

## Hard rules

1. **Hooks follow the Rules of Hooks**: top-level calls only, same order every render — no hooks inside conditions, loops, or early returns.
2. **Every effect cleans up what it sets up**: subscriptions, timers, `AbortController`s, observers get a cleanup return. An effect with an async fetch and no cleanup/abort is a finding when the component can unmount or `postId`-style deps can change mid-flight.
3. **Effect dependencies are complete**: every reactive value the effect reads is in the dependency array (or the code explains why it is intentionally excluded). A `[]`-deps effect that reads props/state is a stale-closure finding.
4. **`key` on mapped elements is a stable identity** (`item.id`), not the array index — index keys break state and reconciliation on reorder/filter.

## Review rules

- `useEffect` is for synchronizing with the outside world (network, subscriptions, DOM), not for deriving render data — derived values belong in render or `useMemo`. Effects that mirror state into other state cause extra render passes.
- Avoid stale-closure reads in timers/listeners: capture with a ref or include the dep — `setInterval(() => setCount(count + 1), …)` overwrites instead of incrementing.
- `dangerouslySetInnerHTML` only with sanitized content (e.g. DOMPurify) and a comment saying who sanitized it; never with user-provided strings.
- Do not manipulate the DOM directly (`document.querySelector`) — use refs and React's model; portals for overlays.
- Error boundaries exist for fetch/render failures the project already handles — a new data-bound subtree without the project's loading/error pattern is a finding.
- Context: passing down frequently-changing values through context re-renders every consumer — split contexts or pass nodes; follow the project's existing provider structure.
- `useRef` for mutable instance-like values (timer ids, previous values); do not store render-relevant data in refs.

## Positive recommendations

- Prefer conditional rendering over `display:none` toggles for semantics; `role="alert"` on error text.
- Controlled inputs follow the project's form solution (react-hook-form, Formik, native state) — do not introduce a second one in a PR.

## Anti-patterns to flag

```jsx
// BAD — effect reads postId but ignores it (stale results on prop change)
useEffect(() => { fetch(`/api/posts/${postId}`).then(r => r.json()).then(setData); }, []);

// BAD — no cleanup: the response can land after unmount or after postId changed
useEffect(() => { getData().then(setData); }, [postId]);

// BAD — index key on a filterable list
items.map((item, i) => <Row key={i} item={item} />)

// BAD — state mirror in an effect (extra render loop)
useEffect(() => { setFullName(first + " " + last); }, [first, last]);
```

## Preserve existing conventions

- Class components in untouched legacy code are not findings — only flag new code, or class code the change already touches, where the project uses function components.
- Do not demand `memo`/`useMemo` mechanically — that belongs to the performance pack.
