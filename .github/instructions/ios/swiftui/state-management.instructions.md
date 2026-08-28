---
description: "Use when SwiftUI code creates, reads, or updates state (@State, @Binding, @ObservableObject, @EnvironmentObject, @Observable). Enforces correct property-wrapper ownership and minimal invalidation."
applyTo: "**/*.swift"
---

# SwiftUI State Management

## Scope

Applies to state property wrappers and data flow in SwiftUI code. Apply only to files that use SwiftUI APIs.

## Review rules

1. **Correct wrapper, correct owner**:
   - `@State` — view-private, value semantics, owned by that view. Never expose it (make `private`); never route large models through it.
   - `@Binding` — derived from an owned source; don't create bindings to externally-owned lifecycle.
   - `@ObservedObject`/`@StateObject`/`@Observable` — `@StateObject` creates, `@ObservedObject` receives. Creating an observed object in `init` per render (`@ObservedObject var vm = VM()`) is a finding.
   - `@EnvironmentObject`/`@Environment` — for genuinely cross-cutting values.
2. **Invalidation scope**: views should observe the smallest state they need — split observable objects so a ticker doesn't re-render every screen (project-idiomatic granularity).
3. **Side effects out of `body`**: no writes to state during view update (`body` writing to `@State`/observed objects causes loops). Use `.onAppear`/`.task`/`.onChange` for effects.
4. **App/storage layering follows the project**: view models/stores exist where the project uses them; two-way bindings only where two-way is true.
5. **`onChange`/`task` keys are correct**: `.onChange(of:)` observing the right value; `.task(id:)` used for restart-on-change semantics instead of manual cancellation.

## Positive recommendations

- Prefer `@Observable` (Observation framework) where the project's minimum iOS allows and existing code uses it — otherwise stick to `ObservableObject` idioms.
- Keep model mutations through the store methods the project defines, not by reaching into nested mutable state from views.

## Anti-patterns to flag

```swift
// BAD — recreated every render
struct Screen: View {
  @ObservedObject var vm = ViewModel() // should be @StateObject

// BAD — state write during view update
var body: some View {
  if needsSetup { isPresented = true } // writes @State in body
}

// BAD — non-private @State leaked to parent
@State var selection = 0 // callers will mutate it — should be @Binding
```

## Preserve existing conventions

- Projects on older SwiftUI may use `ObservableObject` everywhere — review within that idiom; don't demand `@Observable` migration in a feature PR.
