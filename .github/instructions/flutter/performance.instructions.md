---
description: "Use when a Flutter change affects rendering cost: widget trees, lists, images, animations, or build efficiency. Enforces targeted performance review without premature optimization."
applyTo: "**/lib/**/*.dart"
---

# Performance (Flutter)

## Scope

Applies to rebuild efficiency, list/layout cost, image handling, and memory. Only flag issues with a realistic user-visible or measurable cost — avoid noisy micro-optimization findings.

## Review rules

1. **Unnecessary rebuilds** — a widget rebuilding on every frame/keystroke because it listens to broad state; fix by scoping state listeners to the smallest listening widget and adding `const` subtrees.
2. **Expensive work inside `build()`** — sorting/filtering large collections, JSON parsing, formatting dates in tight loops. Precompute in state holders or memoize.
3. **List performance** — unbounded `ListView(children:)`, missing `itemExtent`/`prototypeItem` where a uniform item height exists, missing `cacheExtent` tuning only when evidence shows jank.
4. **Image handling** — missing `cacheWidth`/`cacheHeight` (or `ResizeImage`) when displaying large images in small cells; no `Image` error/loading handling on network images; repeatedly decoding the same asset.
5. **Memory** — controllers, streams, and subscriptions never disposed; image caches of full-resolution media in galleries; ever-growing in-memory lists where pagination exists.
6. **Opacity cost** — a bare `Opacity` widget rebuilt every frame. For animation loops prefer `FadeTransition` (opacity applied at the render layer); `AnimatedOpacity` is fine for one-shot implicit fades but still animates an `Opacity` node. Deep `ClipRRect`/`ClipPath` nesting in scrolling lists has a similar cost profile.

## Anti-patterns to flag

```dart
// BAD — rebuilds whole page per keystroke
TextField(onChanged: (v) => store.setQuery(v)) // store listens page-wide

// BAD — work per build
Widget build(context) {
  final items = allItems.where((e) => e.active).toList()..sort(byName);
}

// BAD — full-res decode in a 48px avatar
Image.network(url) // no cacheWidth
```

## Positive recommendations

- Prefer platform-idiomatic primitives: `SliverList` for long scrolling sections, `AnimatedBuilder` scoped to the animating subtree, `RepaintBoundary` for independently-painting subtrees in scroll views.
- Flag only what the diff shows: a concrete expensive operation, a clearly avoidable cost (large N, per-frame execution, an obviously wrong widget choice). For subtle jank, describe the suspected mechanism and its trigger condition — do not claim profiling evidence you do not have.

## Preserve existing conventions

- **Avoid premature optimization.** Do not flag readable code as slow without a concrete cost (large N, per-frame execution, or measured jank). Optional micro-improvements are `low`/`info` severity at most.
- Do not require `const` everywhere mechanically — apply it where it matters (subtrees rebuilt frequently).
