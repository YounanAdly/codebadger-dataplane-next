---
description: "Use when a Jetpack Compose change affects rendering cost: recomposition behavior, stability, state reads, lists, or images. Enforces targeted performance review — recomposition itself is never a defect. Apply only to files using Compose APIs."
applyTo: "**/*.kt"
---

# Compose Performance

## Scope

Applies to recomposition efficiency and rendering cost in Compose code. Apply only to files using Compose APIs. **Recomposition is Compose's normal operation — recomposing is never itself a finding.** Flag only changes with a meaningful, diff-visible performance consequence (per-frame work, wide invalidation cascades, unbounded lists, avoidable heavy allocations).

## Review rules

1. **Unstable parameters causing avoidable recomposition**: composables receiving `List`/`Map`/unannotated data classes in wide-recomposition positions where the project marks models `@Immutable`/`@Stable` — flag the missing stability annotation or the wrapper the project uses. Never demand annotations on trivially-stable types.
2. **Expensive work inside composition** — allocation, parsing, sorting, formatting in `@Composable` bodies; precompute in state holders or `remember` the result with correct keys.
3. **`remember` correctness is a performance issue too**: a keyed value that changes every recomposition (`remember(x) { ... }` with an unstable or wrongly-chosen key) defeats caching; conversely `remember` without keys over changing inputs is a stale-value bug, not a performance one.
4. **`derivedStateOf` for state computed from frequently-changing inputs** (e.g. booleans derived from scroll offsets) where the project uses it — reading the raw state in composition invalidates far more than needed.
5. **Deferred state reads** in hot paths: lambda-based modifiers (`Modifier.offset { }`, `graphicsLayer { }`, `drawBehind { }`) instead of recomposing state reads where the project uses them for scroll-driven effects.
6. **List rendering**: `items(..., key = { it.id })` for dynamic lists; `contentType` where the project uses it; no per-item heavy work in the item lambda (parsing, bitmap decode); `LazyColumn` over `Column` + scroll modifier for long content.
7. **Image loading**: Coil/AsyncImage (or the project's loader) sizes requests to the composable's measured size; no full-resolution decodes in small cells.
8. **Effect hygiene**: `LaunchedEffect`/`DisposableEffect` keys chosen so effects restart only when needed — `LaunchedEffect(Unit)` re-launching on every keyed change, or effects without keys capturing changing values, are correctness-and-cost findings.

## Positive recommendations

- Scope state reads to the smallest composable that needs them; hoist infrequently-changing state up and pass down values, not whole state holders, where the project does.
- Prefer `immutable` collections or `persistentList` where the project already uses them for stability.

## Anti-patterns to flag

```kotlin
// BAD — list recomputed and unstable on every recomposition
@Composable fun Feed(vm: FeedViewModel) {
  Column { vm.items.filter { it.active }.map { FeedCard(it) } } // unkeyed, unstable
}

// BAD — graphics-invalidating state read
Modifier.offset(scrollState.value.dp) // offset { } reads without recomposition

// BAD — full-res image in a 40dp cell
AsyncImage(model = url) // no size resolution
```

## Preserve existing conventions

- **Avoid premature optimization.** Recomposition of a small subtree is normal — do not flag it without a concrete cost visible in the diff. Optional improvements are `low`/`info` severity at most.
- Match the project's existing stability approach (`@Immutable` annotations, immutable collections, or none) rather than introducing a new one.
