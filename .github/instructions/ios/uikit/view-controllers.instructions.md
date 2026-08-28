---
description: "Use when UIViewController subclasses are created or modified. Enforces lifecycle correctness, separation of concerns, and cleanup."
applyTo: "**/*.swift"
---

# UIKit View Controllers

## Scope

Applies to `UIViewController` (and `UITableVIewController` etc.) subclasses. Apply only to UIKit-based code.

## Review rules

1. **Lifecycle symmetry**: resources acquired in `viewDidLoad`/`viewWillAppear` (observers, notifications, timers, data sources) are released in the matching `deinit`/`viewDidDisappear` — per the project's existing pattern.
2. **`viewDidLoad` stays light**: no synchronous network, heavy I/O, or long parsing at load — delegate to the layer the project uses (view models, services).
3. **Business logic out of VCs where the project separates it**: a view controller orchestrating parsing + persistence + routing is a finding when the project's pattern routes that through view models/presenters/coordinators.
4. **Data source/delegate hygiene**: `dataSource`/`delegate` weak or properly owned per UIKit contract; nil-guarded reloads after async updates on the main queue.
5. **Memory warnings**: caches cleared where the project clears them (`didReceiveMemoryWarning`); heavy subviews released on demand where the project does.
6. **Dismissal ownership**: a VC dismisses what it presents (or routes through the project's coordinator); cross-tree dismissal hacks are findings.
7. **Rotation/sizing hooks**: deprecated `willRotate(to:...)` replaced with the sizing APIs the project uses.

## Positive recommendations

- Prefer `UIHostingController` bridging for embedding SwiftUI pieces where the project already mixes.
- Keep `prepare(for:sender:)` minimal and typed (dependency injection into destination consistent with the project).

## Anti-patterns to flag

```swift
// BAD — network at load
override func viewDidLoad() {
  super.viewDidLoad()
  let data = try! Data(contentsOf: hugeFile) // main thread, at launch of screen
}

// BAD — notification observer never removed
NotificationCenter.default.addObserver(self, selector: ..., name: .x, object: nil) // no removal

// BAD — async UI update off main
URLSession.shared.dataTask { self.reload() } // no DispatchQueue.main
```

## Preserve existing conventions

- Giant legacy view controllers in untouched files are not findings; new/modified code follows the separation the project actually enforces.
