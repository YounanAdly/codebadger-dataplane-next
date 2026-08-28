---
description: "Use when a Flutter change uses Futures, Streams, async/await, timers, or any asynchronous logic. Enforces race-condition safety and correct cancellation/disposal."
applyTo: "**/lib/**/*.dart"
---

# Async & Concurrency (Flutter)

## Scope

Applies to `Future`, `Stream`, `async`/`await`, `Timer`, `Isolate`, and orchestration of asynchronous work.

## Review rules

1. **Check `mounted` / `context.mounted` after every `await` before touching `setState`, context, or widget state.** This is the most common Flutter crash source.
2. **No unawaited futures silently dropped**: `doWork();` without `await` or `unawaited(...)` loses errors. Either await, mark intentionally-fire-and-forget with `unawaited()`, or handle `.then(..., onError: ...)`.
3. **Prefer `async`/`await` over `.then()` chains** for readability; avoid nested promise-style pyramids.
4. **Race conditions**: sequential requests triggered by user input that can overlap (search-as-you-type, tab switches, pagination) must cancel or ignore stale results — via the state solution's built-in mechanism (e.g. Bloc event transformers, Riverpod autoDispose, rxdart `switchMap`) or explicit cancellation tokens.
5. **Streams are subscriptions, and subscriptions are cancelled**: `StreamSubscription` stored and cancelled in `dispose()`. Never `stream.listen(...)` in a widget without keeping/cancelling the subscription.
6. **Timers/periodic tasks are cancelled** in `dispose()`; periodic UI work that must survive the widget belongs to a scoped controller, not the widget.
7. **Heavy CPU work moves off the UI isolate** (`compute`, `Isolate.run`) only for demonstrably large payloads (large JSON parse, image processing) — not for trivial lists (premature optimization).

## Positive recommendations

- Use `Future.wait` for independent parallel work instead of sequential awaits where order doesn't matter.
- Use `Completer` only when adapting callback APIs; prefer async functions directly.
- Debounce user-input-driven async work the way the project already does (timers, rxdart `debounceTime`, or state-solution facilities).

## Anti-patterns to flag

```dart
// BAD — async gap then setState without mounted check
await repo.refresh();
setState(() => loading = false);

// BAD — dropped future (errors vanish)
repo.upload(file);

// BAD — stale response overwrites newer one
onQueryChanged(q) async { final r = await api.search(q); results = r; }

// BAD — leaked subscription
stream.listen((v) => update(v)); // subscription never cancelled
```

## Preserve existing conventions

- If the project uses rxdart/stream-based patterns consistently, review within that idiom; if it uses plain async/await, don't demand reactive libraries.
