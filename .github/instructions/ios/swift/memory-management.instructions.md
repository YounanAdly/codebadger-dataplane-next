---
description: "Use when Swift code manages object ownership: closures capturing self, delegates, notifications, timers, or caches. Enforces retain-cycle and leak prevention."
applyTo: "**/*.swift"
---

# Memory Management (iOS / Swift)

## Scope

Applies to reference semantics: retain cycles, closure captures, delegate ownership, observer/timer lifetime, and resource cleanup.

## Hard rules

1. **`[weak self]` in closures that outlive their owner** — escaping closures stored by singletons, managers, timers, or notification centers capturing `self` strongly create leaks. A closure retained by an object it captures is a retain cycle.
2. **Delegates are `weak`**: `weak var delegate:` protocol properties. Strong delegate references are a classic leak/retain-cycle.
3. **Observers are removed**: `NotificationCenter` observers (non-block-based) removed in `deinit`; block-based observation (`addObserver(forName:...)`) keeps its returned token and removes it; KVO observers unregistered.
4. **`Timer` retain cycles**: `Timer.scheduledTimer` retains its target — invalidate in `deinit`/appropriate lifecycle, or prefer `DispatchSourceTimer`/`Task`-based timers with weak capture.

## Review rules

- `guard let self` inside escaping closures: prefer capturing `[weak self]` and early-returning; `self` strengthening for the duration of one atomic operation is fine, retaining it forever is not.
- Long-lived caches use bounded eviction or `NSCache` where the project does; unbounded app-lifetime caches of view-sized data are a finding.
- `DispatchQueue`/`OperationQueue` retained by singletons must not capture view controllers strongly.
- Resources closed deterministically: file handles, database connections, sockets use `defer`/explicit close paths.
- `deinit` logging (where the project does it) helps verify deallocation of heavy screens; flag missing teardown of registered callbacks/observers.

## Positive recommendations

- Prefer value types and `@autoclosure`-free simple captures where ownership is obvious.
- Use `weak`/`unowned` deliberately: `unowned` only when the lifetime relationship is provably exclusive (crash on dangling otherwise); default to `weak` when unsure.

## Anti-patterns to flag

```swift
// BAD — self retained by a stored closure
final class VM {
  var onUpdate: (() -> Void)?
  init() { onUpdate = { self.render() } } // cycle
}

// BAD — strong delegate
protocol CellDelegate: AnyObject {}
class Cell { var delegate: CellDelegate? } // should be weak

// BAD — timer keeps self alive
Timer.scheduledTimer(timeInterval: 1, target: self, selector: #selector(tick), ...)

// BAD — block observer never removed
NotificationCenter.default.addObserver(forName: .authChanged, ...) // token dropped
```

## Preserve existing conventions

- Swift-only projects with value-type-heavy designs may legitimately have few `weak` keywords — flag only real ownership problems in the diff, not the absence of boilerplate.
