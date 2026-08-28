---
description: "Use when SwiftUI code navigates: NavigationStack/NavigationView, sheets, tabs, deep links. Enforces consistency with the navigation approach the project already uses."
applyTo: "**/*.swift"
---

# SwiftUI Navigation

## Scope

Applies to navigation containers, programmatic navigation, modal presentation, and deep links in SwiftUI code.

## Review rules

1. **Follow the navigation approach the project already uses** (`NavigationStack` + `navigationDestination`, `NavigationView` legacy, programmatic path arrays, coordinator/router objects). Don't force migration between them in a feature PR.
2. **Navigation state is state**: path/selection driven by typed values (`NavigationPath`, enum destinations) consistent with the project; string-based navigation where the project uses typed values is a finding.
3. **Destination registration is type-safe and centralized** where the project centralizes it (one `navigationDestination` per stack, not scattered per-row destinations duplicated across views).
4. **Modals**: `.sheet`/`.fullScreenCover` item-based presentation (`sheet(item:)`) over boolean-plus-separate-data when the presented content depends on a value; dismissal respects the presentation context.
5. **Deep links**: navigating directly to a deep route without prior state must resolve or redirect gracefully; URL parsing is validated (no force-unwrapped components).
6. **Pop/replace semantics correct**: replacing flows (login → home) vs stacking detail views — flag wrong-direction navigation that breaks back expectations.

## Positive recommendations

- Keep route value types small and explicit (enum `Route`/destination structs) when the project models them that way.
- Restore scroll/selection state across navigation where the project preserves it.

## Anti-patterns to flag

```swift
// BAD — boolean sheet with separately-tracked data
@State var showDetail = false
@State var selected: Item? // two sources of truth — sheet(item:) instead

// BAD — destination registered per-row inside loops (duplicated)

// BAD — force-unwrapped deep link
NavigationLink(value: Route(id: Int(urlParts[2])!))
```

## Preserve existing conventions

- Legacy `NavigationView` in untouched code is not a finding — only new code breaking the established pattern.
