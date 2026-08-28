---
description: "Use when Compose code creates, reads, or updates state (remember, mutableStateOf, StateFlow, ViewModel). Enforces unidirectional data flow and correct state hoisting per the project's pattern."
applyTo: "**/*.kt"
---

# Compose State Management

## Scope

Applies to state holders and data flow in Compose code. Apply only to files using Compose APIs.

## Review rules

1. **State ownership matches scope**: view-private state via `remember`/`rememberSaveable`; shared/screen state in the project's state holder (ViewModel, presenter). Hoisting is consistent with how neighboring screens do it.
2. **Unidirectional data flow**: state flows down (parameters), events flow up (lambda callbacks) — composables mutating parent-owned state directly via hoisted setters is a finding where the project uses UDF.
3. **Observe the narrowest state**: collecting whole app state to render one chip is a finding — select/distinct the slice (`StateFlow` mapping, `collectAsStateWithLifecycle` on derived flows).
4. **Lifecycle-aware collection**: `collectAsStateWithLifecycle()` (or the project's established API) — `collectAsState` where the project deliberately chose it.
5. **`rememberSaveable` for user-expectation-persistent UI state** (scroll position, selections, text drafts) where the project preserves it; plain `remember` for everything else.
6. **ViewModel access pattern consistent**: `viewModel()` defaults vs. DI-provided factories — as the project does; no new parallel VM construction mechanism.
7. **No business logic in composables**: branching business rules belong in the state holder; composables render.

## Positive recommendations

- Prefer immutable state data classes with `copy` for complex screens (consistent with the project's state modeling).
- Use `derivedStateOf` for state computed from frequently-changing inputs where the project does.

## Anti-patterns to flag

```kotlin
// BAD — lifecycle-blind collection
val state by viewModel.uiState.collectAsState() // where project uses WithLifecycle

// BAD — composable mutating parent state directly
Parent {
  Child(onClick = { parentCount = parentCount + 1 }) // should emit event
}

// BAD — business decision in UI
if (cart.items.size > 10) discountLabel() // logic belongs in state holder
```

## Preserve existing conventions

- If the project mixes `StateFlow`-based VMs with plain `mutableStateOf`, review consistency within the file's local pattern; don't force a single approach mid-feature.
