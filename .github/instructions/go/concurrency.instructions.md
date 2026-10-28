---
description: "Use when a Go change spawns goroutines, uses channels, or shares state across them. Enforces leak-free, race-free concurrency."
applyTo: "**/*.go"
---

# Go Concurrency Rules

## Scope

Applies to goroutine, channel, and shared-state code in every `.go` file.

## Hard rules

1. **Every goroutine has an exit path**: spawned goroutines terminate on cancellation (context done), completion, or shutdown — fire-and-forget goroutines in request handlers are leak findings; use `errgroup`/worker pools per the project's pattern.
2. **Channel ownership is clear**: the sending goroutine owns closing; receiving from a channel that another sender may close later, double-closes, and send-on-closed are findings; range-loops over channels exit when the sender closes.
3. **Shared mutable state is synchronized**: mutex/RWMutex around non-atomic access, `atomic` types for counters/flags, or channel-based ownership — an unsynchronized map/field written by >1 goroutine is a data-race critical finding.

## Review rules

- Locks: defer Unlock (or unlock on every path), no lock held across channel sends/long calls where avoidable; copylocks (passing mutex by value) is a finding; lock ordering documented where two locks can nest.
- `select`: `default` branches used deliberately (non-blocking semantics); `time.Tick`/`time.After` leaks in loops; nil-channel tricks only where the codebase uses them.
- Context cancellation respected in spawned work (`ctx.Done()` checked in loops; operations take ctx) — a goroutine that keeps working after its request's context is cancelled is a finding.
- Buffered channels sized deliberately; unbounded `go` per input item without a limiter (unbounded memory under load) is a finding with the input-shape evidence.
- `sync.WaitGroup` Add/Done pairing (Add before `go`); `errgroup.Group` error propagation instead of ignored goroutine errors.
- `sync.Once` for one-time init; `singleflight`-style dedup only where the project already uses it.

## Anti-patterns to flag

```go
// BAD — leaks one goroutine per request
go func() { <-ch; doWork() }()

// BAD — write to shared map from concurrent handlers
cache[key] = value // no mutex; map writes race

// BAD — double close by two owners
close(ch) // ...and the other handler closes it too
```

## Preserve existing conventions

- Follow the project's concurrency idioms (errgroup vs manual WaitGroup, worker pools); do not demand a paradigm switch for small, correct code.
