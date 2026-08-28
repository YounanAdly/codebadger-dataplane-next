---
description: "Use when a Flutter change builds, composes, or refactors widgets. Enforces widget composition quality, const usage, lifecycle correctness, and build-method hygiene."
applyTo: "**/lib/**/*.dart"
---

# Widgets & Composition (Flutter)

## Scope

Applies to widget classes, `build()` methods, and widget composition.

## Hard rules

1. **Dispose everything created.** `TextEditingController`, `ScrollController`, `AnimationController`, `FocusNode`, `PageController`, `StreamSubscription`, `Timer` — dispose/close/cancel in `dispose()` (or `ref.onDispose` / `autoDispose` in Riverpod).
2. **No `setState()` after `dispose()`** — guard async callbacks with `mounted` (or `context.mounted`) before calling `setState`/using context.
3. **No `setState()` inside `build()` or `initState()`** (directly or synchronously chained).
4. **`const` constructors where possible.** A widget tree (or subtree) constructible at compile time should be `const` — this is the single cheapest rebuild optimization.

## Review rules

- `ListView.builder` (or `.separated`) for long/scrollable lists — never `ListView(children: [...])` with unbounded data, and never a `Column` inside a `SingleChildScrollView` for long lists.
- `key` on list items where identity matters (reordering, stateful tiles) — `ValueKey(item.id)`, not index keys.
- Decompose `build()` methods that mix unrelated responsibilities (layout + business decisions + long inline subtrees) into focused private widgets. Line count alone is not a defect — a long but single-responsibility `build` is not a finding.
- Avoid deep nesting: `SizedBox`/`Padding`/`Container` chains 5+ levels deep usually hide a missing helper widget or layout primitive (`Row/Column/Flex`, `Wrap`, `Stack`, theme spacing).
- Prefer reusable widgets over copy-pasted subtree blocks that appear in multiple files.
- Use `Text.rich`/`RichText` for mixed styles instead of stacking `Text` widgets when semantics matter.
- Keep `build()` free of expensive work: no JSON parsing, sorting large lists, regex compilation, or file I/O — precompute in constructors/state holders.
- `Image.network`/`cached_network_image` needs `errorBuilder`/`errorWidget` and placeholder handling where the app shows network images.

## Positive recommendations

- Extract repeated styled elements (chips, badges, stat cards) into named widgets consistent with the project's widget organization.
- Prefer `Theme.of(context)`/`MediaQuery` lookups over constructing one-off text styles and paddings.

## Anti-patterns to flag

```dart
// BAD — controller without dispose
final controller = TextEditingController();

// BAD — async gap then setState
http.get(...).then((r) => setState(() => data = r)); // no mounted check

// BAD — index keys on a reorderable list
items.map((e) => Tile(key: Key('$index')))

// BAD — work in build
Widget build(context) {
  final sorted = expensiveSort(allItems); // runs every rebuild
}
```

## Preserve existing conventions

- The project's existing widget granularity is the baseline — do not require every tiny subtree to be extracted, and do not require merging small widgets that the project deliberately keeps separate.
