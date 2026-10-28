# Rust Review Rules

Apply when the pull request touches Rust code: `.rs` files, `Cargo.toml`, `Cargo.lock`.

1. Propagate errors with `?` and project error types — `unwrap()`/`expect()` only in tests, prototypes, or provably infallible spots (and say why); never in library or request-handling paths.
2. `panic!`, array indexing, and integer arithmetic that can panic at service boundaries are findings unless the invariant is locally proven.
3. `unsafe` blocks need justification in the same change: what invariant upholds safety, why safe Rust cannot do it, and the smallest possible scope. New `unsafe` without a comment is a finding.
4. Do not report borrow-checker or lifetime errors as findings — if it would not compile, the diff is incomplete; say so once instead of itemizing compiler diagnostics.
5. Locks: keep critical sections small, never hold a lock across `await`, and document lock ordering where two locks can nest.
6. Shared mutable state across threads uses `Arc<Mutex<_>>`/channels — plain `static mut` or unsynchronized `Rc` across threads are findings.
7. Spawned threads and long-lived tasks have a shutdown/join path; detached unbounded spawns that outlive their data are findings.
8. `async` tasks are cancellation-safe: a `select!` arm that drops a future mid-operation must not lose data or skip cleanup.
9. Use `context`/`thiserror`-style error wrapping the way the project already does; do not introduce a second error framework in one change.
10. needless `clone()`/`to_string()` in hot loops and per-item allocations on large collections are findings only when the cost is real (large N or per-request paths).
11. FFI boundaries validate untrusted input before the call and convert raw pointers/results into safe types at the edge; no `mem::transmute` of foreign data without justification.
12. Follow the project's edition (2018/2021/2024) and existing crate layout; new modules follow the project's module conventions.
13. Dependencies: justified additions in `Cargo.toml`; flag unmaintained or duplicate-purpose crates (two HTTP stacks, two async runtimes).
14. Test: `#[cfg(test)]` unit tests or the project's integration tests for changed logic, including error paths.

Severity guide:
- **critical**: `unsafe` without justification, `unwrap`/`panic` on request or security paths, FFI accepting untrusted input unchecked, `static mut`.
- **high**: locks held across `await`, unbounded detached spawns, cancellation-unsafe async paths, missing error propagation.
- **medium**: needless allocations on hot paths, missing tests, inconsistent error wrapping.
- **low**: readability, formatting, minor optimizations.
