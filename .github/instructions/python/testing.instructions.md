---
description: "Use when a Python change adds or modifies tests. Enforces meaningful pytest-style tests with the project's existing stack and fixtures."
applyTo: "**/tests/**,**/test_*.py,**/*_test.py,**/conftest.py"
---

# Python Testing

## Scope

Applies to Python test files and fixtures.

## Review rules

1. **Changed behavior gets tests** at the project's level (unit, API/integration via the framework's test client) — no new test-runner or plugin stack in one PR.
2. **Tests are deterministic**: frozen time (freezegun/injected clock), no real network (responses/respx/mocks), no test-order dependence, no `sleep`-based synchronization.
3. **Assert behavior**: response status/body, returned values, state changes via public APIs — not private attributes or log lines (unless logging is the contract).
4. **Fixtures isolate**: autouse fixtures don't leak mutable globals between tests; factories over shared module-level mutable data; DB tests use the project's transaction/rollback or cleanup pattern.
5. **Error and edge paths covered**: validation failures, empty results, permission denials — not only happy paths.
6. **Async tests** use the project's async plugin (`pytest-asyncio`/`anyio`) with the configured mode; bare `async def` tests that never run are a silent-pass finding.

## Anti-patterns to flag

```python
# BAD — passes even when the code is broken
def test_search():
    client.get("/search?q=x")  # no assertion

# BAD — order dependence via module state
cache.clear()  # only in the first test; others rely on it being warm
```

## Preserve existing conventions

- Match the project's fixture/factory style (conftest, factories) and marker usage; do not demand 100% coverage — test the risk the change adds.
