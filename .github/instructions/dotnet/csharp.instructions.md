---
description: "Use when a change touches C# code. Enforces async correctness, disposal ownership, nullability, and LINQ discipline."
applyTo: "**/*.cs"
---

# C# Language Rules

## Scope

Applies to every `.cs` file: language-level correctness. ASP.NET Core and EF concerns have their own instruction file.

## Hard rules

1. **No `async void`** (outside event handlers) — use `async Task`/`Task<T>`; an `async void` on a request path is a crash-on-throw finding.
2. **`IAsyncDisposable`/`IDisposable` types are disposed**: `using`/`await using` declarations or DI-managed lifetimes — a `HttpClient`/stream/connection created without disposal ownership is a finding; use `IHttpClientFactory` where the project does.
3. **`ConfigureAwait(false)` in library code** per the project's convention; sync-over-async (`.Result`, `.Wait()`, `.GetAwaiter().GetResult()`) on request paths is a deadlock/THREAD-POOL starvation finding.
4. **Cancellation flows**: `CancellationToken` passed down the chain where the project does it; a long-running async op that ignores its token is a finding.

## Review rules

- Nullability: nullable reference types respected — no `null!` suppressions without a comment; `?.`/`??` where the project uses them; guard clauses on external input.
- LINQ: multiple enumeration of `IEnumerable` (re-materializing a DB query twice) is a finding; `ToList()` where one pass suffices; `Single`/`First` vs `SingleOrDefault`/`FirstOrDefault` chosen for the actual cardinality.
- Exceptions: catch specific types; `throw;` (not `throw ex;`) preserves the stack; exceptions as control flow on hot paths flagged per project style.
- Records/structs: value semantics per the project; mutable structs in collections are findings; `readonly struct` where the project uses them.
- String/numbers: `CultureInfo`-aware parsing/formatting for data (`InvariantCulture` for machine formats), current culture only for UI; `DateTime.UtcNow` vs local consistent with the project.
- Events/handlers: unsubscribed (`-=`) where the publisher outlives the subscriber; lambdas capturing disposables across lifetimes flagged.
- Generics/casting: `as` + null-check over double-cast; pattern matching where the project uses it.

## Anti-patterns to flag

```csharp
// BAD — crash on throw, unobservable
public async void ProcessAsync(Order o) { await _svc.SaveAsync(o); }

// BAD — deadlock under load
var result = GetDataAsync().Result;

// BAD — enumerable enumerated twice (two queries)
if (query.Any()) { foreach (var x in query) { } }
```

## Preserve existing conventions

- Respect the project's nullable context setting and .NET version floor; do not demand C# 12 features on an older LangVersion.
