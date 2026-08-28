---
description: "Use when Swift code uses async/await, Task, Actors, GCD, Combine, or any concurrency. Enforces structured concurrency, main-actor correctness, and data-race safety."
applyTo: "**/*.swift"
---

# Concurrency (iOS / Swift)

## Scope

Applies to async/await, `Task`, `@Actor`/actors, DispatchQueues, Combine, and threading.

## Hard rules

1. **No main-thread blocking**: synchronous network/disk/heavy CPU work on the main thread is a critical finding (UI freezes → watchdog kills).
2. **UI updates on the main actor**: results arriving off-main must hop back (`@MainActor` boundary, `await MainActor.run`, or the project's established dispatch pattern) before touching views.
3. **Cancellable async work is cancelled**: `Task {}` started in a view/view model is stored and cancelled on disappear/deinit where the project's lifecycle expects it (esp. SwiftUI `.task` handles it automatically; manual `Task` in UIKit VMs usually does not).
4. **Shared mutable state is protected**: state accessed from multiple queues/tasks needs an actor, a serial queue, or a lock — matching the project's idiom. Unsynchronized shared `var` across threads is a critical finding.

## Review rules

- Prefer structured concurrency (`async let`, `TaskGroup`) over detached tasks; `Task.detached` needs justification (it loses actor context and priority).
- Long-running loops check `Task.isCancelled` / `try Task.checkCancellation()`.
- Prefer `async/await` for new code where the project uses it; bridge callback APIs with `withCheckedThrowingContinuation` rather than stacking completion handlers.
- GCD: `DispatchQueue.global` for one-off background work; dedicated serial queues per resource where the project does; no `sync` from a queue onto itself (deadlock).
- Combine: subscriptions are stored and cancelled (`AnyCancellable` set) on owners' deinit.
- Timeouts exist on network-bound work (usually via the shared URLSession config the project owns).

## Positive recommendations

- Mark single-owner UI view models `@MainActor` wholesale instead of sprinkling per-method hops, where the project supports it (iOS 15+/Swift 5.5+).
- Prefer `AsyncSequence`/`for await` over retained callbacks for streams of values.

## Anti-patterns to flag

```swift
// BAD — blocking main thread
let data = try Data(contentsOf: url) // on main actor, large file

// BAD — UI update off main
Task.detached { self.label.text = "done" }

// BAD — fire-and-forget that outlives its owner
func load() { Task { self.items = try await api.items() } } // not cancelled, not MainActor

// BAD — unsynchronized shared state
class Store { var items: [Item] = [] } // mutated from multiple Tasks
```

## Preserve existing conventions

- If the project is pre-async/await (completion-handler based), review within that idiom; suggest async only where the project has already adopted it.
- Do not demand migration of working GCD code to actors in an unrelated PR.
