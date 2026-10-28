---
description: "Use when a Go change adds or modifies tests. Enforces table-driven, deterministic tests with the project's existing helpers."
applyTo: "**/*_test.go"
---

# Go Testing

## Scope

Applies to `_test.go` files and the testability of changed production code.

## Review rules

1. **Changed behavior gets tests** in the project's style: table-driven with named cases where the codebase uses tables; plain tests for simple behavior.
2. **Tests are deterministic**: `t.TempDir()`, injected clocks/`httptest`, fake interfaces — no real network, no `time.Sleep` waiting (poll with the project's helper or use channels).
3. **Error paths asserted**: `err != nil` expectations, sentinel/typed error checks with `errors.Is`, not just "no error".
4. **`t.Helper()`/`t.Errorf` vs `t.Fatalf`** used correctly (Fatalf only when the rest of the test cannot proceed); goroutine leaks in tests cleaned up (`t.Cleanup`).
5. **Parallel tests** (`t.Parallel()`) capture loop variables correctly (Go <1.22 `tc := tc`); shared fixtures not mutated by parallel cases.
6. **No weakened assertions**: deleting or loosening existing checks to make a change pass is a finding.

## Anti-patterns to flag

```go
// BAD — passes even when broken
func TestParse(t *testing.T) { parse(input) }

// BAD — sleeps to wait for a goroutine
go worker(); time.Sleep(time.Second); check()
```

## Preserve existing conventions

- Match the project's test-package choice (`foo` vs `foo_test`), fixtures, and assertion helper library; do not demand a new assertion framework.
