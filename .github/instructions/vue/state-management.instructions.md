---
description: "Use when a Vue change stores, derives, or shares application state. Enforces consistency with the project's store solution — no library mandates."
applyTo: "**/*.vue,**/stores/**,**/store/**,**/composables/**"
---

# Vue State & Data

## Scope

Applies to state ownership in components, stores (Pinia/Vuex), and shared composables.

## Review rules

1. **Follow the project's store solution** (Pinia, Vuex, or composables) — no second state library or parallel global store in one PR.
2. **Store state is replaced, not mutated outside actions** (Vuex strictness, Pinia `$patch`/action style) — components mutating store objects directly (except through the established action API) are findings.
3. **`storeToRefs()` for Pinia destructuring** in components — plain destructuring breaks reactivity.
4. **Server data vs client state**: fetched lists/objects live in the project's data layer or store — do not mirror them into component state where the project keeps them shared; do not cache API responses in module-level `ref`s without the project's invalidation pattern.
5. **Composables are singletons only when intended**: module-scoped `ref`s in a composable share state across every consumer — intentional for auth/session, a bug for per-component state; flag composables whose scope contradicts their use.
6. **Derived store state is a getter/computed**, not a second stored copy.
7. **Race conditions**: overlapping fetches in stores (search, tab switches) follow the project's cancellation/stale-guard pattern — unguarded `await` then assign is a finding.

## Anti-patterns to flag

```ts
// BAD — module-scoped ref shared by every consumer of a per-page composable
const page = ref(1);
export function usePagination() { return { page }; }

// BAD — component mutates store state directly
store.user.name = form.name; // instead of an action
```

## Preserve existing conventions

- Local `ref` state in leaf components is idiomatic — flag only when shared state is routed around the established solution.
