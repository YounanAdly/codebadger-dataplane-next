---
description: "Use when a change touches Go code. Enforces error handling, context discipline, interface hygiene, and resource ownership."
applyTo: "**/*.go"
---

# Go Language Rules

## Scope

Applies to every `.go` file: language correctness. Concurrency has its own instruction file; `_test.go` files the testing file.

## Hard rules

1. **Every error is handled or deliberately ignored with `_ =` and a comment where it matters** — silent `_` on security/data paths is a finding; never panic in library/request code (`panic` belongs to `init` bugs or truly impossible states).
2. **Errors are wrapped with `%w`** and compared with `errors.Is`/`errors.As` — string-matching error text (`strings.Contains(err.Error(), ...)`) is a finding.
3. **`context.Context` is the first parameter** of request-scoped functions and flows down — stored in structs only where the project does it for long-lived clients; `context.Background()` in request paths instead of the incoming ctx is a finding.
4. **`defer` closes what opens**: files, response bodies, rows, mutex-unlock placement correct (defer after the error check, not before).

## Review rules

- Nil-map/nil-pointer writes: maps used before `make`, pointer receivers dereferenced without nil-guards where the type allows nil.
- Time: `time.After` in `select` loops leaks timers (use `time.NewTimer`), `time.Now()` comparisons without the project's clock abstraction in tests; durations as `time.Duration` not magic ints.
- Interfaces: accept interfaces, return concrete types, per project usage; interfaces defined at the consumer, not speculative abstractions.
- Slices: `append` aliasing on shared backing arrays when handing slices across owners; capacity assumptions on `reslice`.
- `init()` kept trivial per project norms; global mutable state guarded where the project guards it.
- JSON/struct tags: `json` tags on API structs match the wire contract; `omitempty` semantics considered; unexported fields silently dropped is a classic bug — check the struct's tags when the diff changes its fields.
- `go vet`-class issues are not findings to re-report (the compiler/vet owns them); review judgment the tools can't: error-choice consistency, log hygiene (no PII/secrets).

## Anti-patterns to flag

```go
// BAD — ignored error on a data path
json.NewDecoder(r.Body).Decode(&req)

// BAD — leaks a timer every loop iteration
for { select { case <-time.After(time.Second): ... } }

// BAD — string-matching errors
if strings.Contains(err.Error(), "not found") { ... }
```

## Preserve existing conventions

- Follow the project's Go version (generics only where the toolchain supports them), module layout, and error-type package — do not introduce a parallel error framework.
