---
description: "Use when Kotlin code uses coroutines, Flow, or Java concurrency. Enforces structured concurrency, dispatcher correctness, cancellation, and race safety."
applyTo: "**/*.kt"
---

# Coroutines & Concurrency (Android)

## Scope

Applies to coroutines, `Flow`, `suspend` functions, dispatchers, and threading.

## Hard rules

1. **No main-thread I/O**: network, disk, and parsing happen on the dispatcher the project uses for work (`Dispatchers.IO`/`Default` via `withContext` or injected dispatchers) — never on `Dispatchers.Main`.
2. **No `GlobalScope`** — use `viewModelScope`/`lifecycleScope`/injected application scopes; unstructured long-lived work is a leak/cancellation bug.
3. **Cancellation is respected**: long-running loops check `isActive`/`ensureActive()` or use cancellable suspending calls; `finally` cleanup uses `withContext(NonCancellable)` where cleanup itself suspends.
4. **Shared mutable state is confined**: state crossed between coroutines is protected by a single-threaded dispatcher/confinement, `Mutex`, or atomic types — matching the project's idiom. Unsynchronized shared `var` across threads is a critical finding.

## Review rules

- Dispatchers are injectable or accessed via the project's wrapper (eases testing); hardcoded `Dispatchers.X` in classes where the project injects them is a finding.
- `Flow` collection is lifecycle-aware in UI: `repeatOnLifecycle`/`flowWithLifecycle` (or the project's established pattern) — `launchIn` from `onCreate` without lifecycle awareness collects in background and is a finding where the project handles it.
- Exceptions in coroutines are handled: `launch` failures surface via the scope's `CoroutineExceptionHandler` or `try/catch` inside; silently swallowed `CancellationException` (rethrown!) is a finding — never `catch (e: Exception)` without rethrowing `CancellationException`.
- `StateFlow`/`SharedFlow` used per the project's pattern for UI state/events; `Conflate`d/buffer choices deliberate.
- `runBlocking` only in non-Android production code where the project already uses it — never on the main thread, never in UI code.
- `async` results are awaited (`await`) — orphaned `async` loses exceptions.

## Positive recommendations

- Prefer `flow { }`/`channelFlow` conversions at the boundary over `runBlocking` bridges.
- Prefer `select`/`joinAll`/structured builders over manual `Job` bookkeeping.

## Anti-patterns to flag

```kotlin
// BAD — network on main
withContext(Dispatchers.Main) { api.fetch() }

// BAD — swallowed cancellation
try { work() } catch (e: Exception) { log(e) } // CancellationException not rethrown

// BAD — collecting without lifecycle
scope.launch { viewModel.state.collect { render(it) } } // onCreate, no repeatOnLifecycle

// BAD — orphaned async
async { upload() } // never awaited; exceptions lost
```

## Preserve existing conventions

- If the project uses RxJava instead of coroutines, review within Rx idioms; don't demand a coroutine rewrite in a feature PR.
