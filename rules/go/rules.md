# Go Review Rules

Apply when the pull request touches Go code: `.go` files, `go.mod`.

1. Check every returned `error`; never discard with `_` unless explicitly justified.
2. Wrap errors with `%w` to preserve the chain; don't string-match error text.
3. No hardcoded secrets — use environment variables or a secret manager.
4. Use `context.Context` for cancellation and timeouts on all I/O; never store contexts in structs.
5. `defer` resource cleanup (files, rows, responses) immediately after acquisition.
6. Close response bodies (`resp.Body.Close()`) on every HTTP call.
7. Guard concurrent access to shared state with mutexes or channels; run `go vet` / race detector mentally on new goroutines.
8. Validate all external input before use; use parameterized SQL (database/sql placeholders).
9. Use `crypto/rand` for security values — never `math/rand`.
10. Follow Go naming conventions (MixedCaps, no underscores); keep package names short and lowercase.
11. Return early; avoid deep nesting — handle errors first.
12. Don't log secrets or PII; use structured logging where the project does.
13. Test: table-driven tests with `_test.go` files for new logic; test error paths.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, unchecked errors on security paths, data races on shared state.
- **high**: ignored errors, missing timeouts/cancellation, unclosed resources, goroutine leaks.
- **medium**: naming violations, missing tests, inconsistent error wrapping.
- **low**: readability, formatting, minor optimizations.
