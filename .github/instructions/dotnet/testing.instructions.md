---
description: "Use when a change adds or modifies .NET tests. Enforces meaningful assertions with the project's existing stack (xUnit/NUnit, Moq/NSubstitute, WebApplicationFactory as configured)."
applyTo: "**/*Tests.cs,**/*Test.cs,**/Tests/**,**/Test/**"
---

# .NET Testing

## Scope

Applies to .NET test projects and the testability of changed production code.

## Review rules

1. **Changed behavior gets tests** using the project's existing stack (xUnit/NUnit, Moq/NSubstitute, `WebApplicationFactory`/`TestServer` as configured) — no second test framework in one PR.
2. **Tests are deterministic**: no real network/DB where the project uses fakes/containers, `TimeProvider`/injected clocks over `DateTime.Now`, no `Thread.Sleep` synchronization.
3. **Assert behavior**: returned values, state changes, `WebApplicationFactory` response status/body — not private members or log strings (unless logging is the contract).
4. **Async assertions awaited** (`await` on task-returning calls; xUnit doesn't allow async void tests) — fire-and-forget in tests is a flaky silent-pass finding.
5. **Fixtures isolate**: shared `IClassFixture`/collection fixtures per the project; mutable static state reset between tests; test data via builders/`ModelCreating`-style fixtures the project uses.
6. **Error and edge paths covered**: validation failures, empty results, auth denials — not only happy paths.

## Anti-patterns to flag

```csharp
// BAD — passes unconditionally
[Fact] public Task Works() { _svc.Handle(MakeOrder()); return Task.CompletedTask; }

// BAD — sleeps to wait
Thread.Sleep(3000); Assert.True(_signalFired);
```

## Preserve existing conventions

- Match the project's naming (`Method_Scenario_Expected` or BDD style as it exists) and test-project layout; do not demand coverage of trivial members.
