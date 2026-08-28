---
description: "Use when SwiftUI views, view hierarchies, or view modifiers are created or modified. Enforces view composition, identity, and body() hygiene."
applyTo: "**/*.swift"
---

# SwiftUI Views

## Scope

Applies to `View` implementations, view composition, and modifier usage in SwiftUI code. Apply only to files that use SwiftUI APIs.

## Review rules

1. **`body` is cheap.** No heavy computation inside `body` (parsing, sorting, formatting in loops) — precompute in the view model/state layer. `body` runs on every dependency change.
2. **Decompose large views**: a single `body` spanning many screens-worth of code should split into named child views; `@ViewBuilder` functions/child views for repeated sections.
3. **Identity is deliberate**: explicit `.id()`/`.tag()` values where identity matters; avoid `id: \.self` on non-unique values; stable identities in `ForEach` to preserve state/animations.
4. **Modifiers are ordered correctly** — `.padding()` before `.background()` vs after changes visuals; flag order-dependent mistakes, not style preferences.
5. **Reusable styling via ViewModifiers** where the project extracts them; copy-pasted modifier chains repeated across views are a finding when the project has a modifier library.
6. **State ownership matches scope**: `@State` for view-private, external stores for shared.
7. **`AnyView` is rare** — prefer generics/`@ViewBuilder`; `AnyView` erases identity and costs performance.
8. **Adaptive layouts**: `ViewThatFits`, `GeometryReader` used sparingly and correctly (avoid unbounded `GeometryReader` growth in stacks).

## Positive recommendations

- Prefer built-in containers (`LazyVGrid`, `LazyVStack`, `Grid`) over nested `HStack`/`VStack` hacks for long content.
- Use `redacted(reason: .placeholder)` for loading states where the project does.

## Anti-patterns to flag

```swift
// BAD — heavy work in body
var body: some View {
  let sorted = allItems.sorted { ... } // re-runs per invalidation
  ...
}

// BAD — unstable ForEach identity
ForEach(items, id: \.self) // items have duplicate-equal values

// BAD — AnyView to work around typing
func make() -> AnyView { AnyView(Text("hi")) }
```

## Preserve existing conventions

- Match the project's existing view-organization style (extension-per-section, child-view files, ViewBuilder helpers).
- Do not require extraction of small, readable bodies — flag only composition that is genuinely hard to maintain.
