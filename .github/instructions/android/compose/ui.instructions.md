---
description: "Use when Jetpack Compose UI is created or modified: composables, modifiers, layout, recomposition hygiene. Apply only to Compose code."
applyTo: "**/*.kt"
---

# Jetpack Compose UI

## Scope

Applies to `@Composable` functions, `Modifier` chains, and layout code. Apply only to files using Compose APIs.

## Review rules

1. **Composables are side-effect free**: no writes to state, no network, no logging of business state directly in composition. Side effects use the effect APIs the project uses (`LaunchedEffect`, `DisposableEffect`, `SideEffect`) with correct keys.
2. **Modifier parameter convention**: public composables accept `modifier: Modifier = Modifier` as the first optional parameter and apply it to the root layout — internal one-off composables following the project's style.
3. **`remember` expensive objects**: allocations, formatters, painters, object creation inside composition that survives recomposition — `remember`/`rememberSaveable` (or moved to the state holder) where the project does.
4. **Recomposition hygiene**: stable parameters (immutable data classes / `@Immutable`/`@Stable` where the project annotates); lambdas remembered where stable identity matters (`rememberUpdatedState` for long-lived effect references); list keys in `LazyColumn`/`LazyRow` (`key = { it.id }`), not positional defaults on mutable data.
5. **Deferred reads for state-driven layouts**: lambda-based modifiers (`Modifier.offset { }`, `graphicsLayer { }`) where the project uses them for scroll-linked effects, to avoid recomposition cascades.
6. **No deep modifier soup**: repeated identical chains extracted into project `Modifier` extensions.
7. **Effect keys are correct**: `LaunchedEffect(Unit)` with captures that change is a stale-closure bug — key by the changing value; `DisposableEffect` disposes symmetrically.

## Positive recommendations

- Prefer built-in Material components over custom re-implementations, consistent with the project's theming.
- Use `Preview` annotations for new UI where the project maintains previews.

## Anti-patterns to flag

```kotlin
// BAD — side effect in composition
@Composable fun Timer() {
  val t = Timer() // started every recomposition
}

// BAD — stale lambda
LaunchedEffect(Unit) { update(query) } // query changes ignored

// BAD — positional keys on reorderable data
LazyColumn { items(messages) { ... } } // no key

// BAD — recomposition-cascade offset
Modifier.offset(x = scrollState.value.dp) // offset { } instead
```

## Preserve existing conventions

- Mixed View/Compose codebases: new code follows the pattern of the files it touches; don't demand migration of XML screens to Compose (or back) in a feature PR.
