---
description: "Use when a React change stores, derives, or shares state. Enforces correct state ownership and consistency with the project's existing state solution — no library mandates."
applyTo: "**/*.tsx,**/*.jsx,**/*.ts"
---

# React State & Data

## Scope

Applies to state ownership and data-fetching architecture in frontend code. Hook mechanics belong to the component pack.

## Review rules

1. **Follow the project's state solution** (Redux Toolkit, Zustand, Jotai, Context+useReducer, React Query/SWR for server state) — review consistency with it; never introduce a second global-state solution in one PR.
2. **Server state and UI state are different things**: do not copy fetched data into local/global state when the project's query layer already caches it — duplicated server state goes stale and desynchronizes.
3. **State lives at the lowest common owner**: state used by one subtree should not sit in a global store; props/args passing beats context for single-subtree data.
4. **Derive, don't duplicate**: total counts, filtered lists, and formatted values are computed (in render, `useMemo`, or selectors) — storing a second copy of derivable data invites inconsistency.
5. **Reducers/state updates are pure and replace-by-value**: no mutation of nested state (`state.items.push(...)`) — spread or structured updates; immer only where the project already uses it.
6. **Race conditions on user-driven fetches**: search-as-you-type, tab switches, and pagination must ignore or cancel stale responses (AbortController, query-library keys, or a request-id guard) — last-write-wins on responses that can arrive out of order is a finding.
7. **Optimistic updates have a rollback path** where the project's pattern includes one (or the query library's built-in rollback is used).

## Positive recommendations

- Colocate fetch + cache + invalidation in the project's query layer; components consume hooks, not raw endpoints.
- Keep store slices normalized the way the existing store is; do not reshape existing slices in a feature PR.

## Anti-patterns to flag

```tsx
// BAD — duplicating server cache into global state
const { data } = useQuery(["posts"], getPosts);
useEffect(() => { store.posts = data; }, [data]);

// BAD — mutation defeats change detection
function addItem(item) { cart.items.push(item); setCart(cart); }

// BAD — stale-response overwrite
onChange={(q) => { search(q).then(setResults); }} // uncancelled, overlapping
```

## Preserve existing conventions

- `useState` for local ephemeral UI state is idiomatic — flag it only where shared state is being routed around the project's established solution.
- Do not recommend migrating stores because one is more popular.
