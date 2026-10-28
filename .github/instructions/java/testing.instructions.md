---
description: "Use when a change adds or modifies Java tests. Enforces meaningful assertions with the project's existing stack (JUnit/Mockito/Testcontainers as configured)."
applyTo: "**/src/test/**/*.java,**/*Test.java,**/*Tests.java,**/*IT.java"
---

# Java Testing

## Scope

Applies to Java test sources and the testability of changed production code.

## Review rules

1. **Changed behavior gets tests** using the project's existing stack (JUnit 5, Mockito, AssertJ, Testcontainers where configured) — no second assertion or mocking framework in one PR.
2. **Tests are deterministic**: no real network/DB where the project uses containers/mocks, no `Thread.sleep` synchronization (awaitility or the project's mechanism), no wall-clock assertions without injection.
3. **Assert behavior**: return values, state transitions, interactions with named collaborators — one meaningful arrange-act-assert per behavior; `assertTrue(result != null)`-style non-assertions are findings.
4. **Mock boundaries**: mock ports/edges the project mocks; mocking the unit under test's internals hides real bugs — over-mocked tests that pass regardless of implementation correctness are findings.
5. **Error paths covered**: exceptions mapped, empty results, boundary values — not only the happy path.
6. **Test data built through the project's builders/factories**; tests isolated from each other (no shared mutable statics).

## Anti-patterns to flag

```java
// BAD — passes unconditionally
@Test void works() { service.handle(makeOrder()); } // no assertion

// BAD — sleeps to wait
Thread.sleep(3000); verify(listener).fired();
```

## Preserve existing conventions

- Match the project's naming (`method_condition_expectation` or BDD style as it exists) and test layout; do not demand coverage of trivial getters.
