---
description: "Use when an iOS change adds or modifies tests, or changed behavior lacks coverage. Enforces useful XCTest/Testing with the project's existing tooling."
applyTo: "**/*Tests*.swift,**/Tests/**,**/*Spec*.swift"
---

# Testing (iOS)

## Scope

Applies to unit tests, integration tests, and UI test targets, plus testability of changed production code.

## Review rules

1. **Changed behavior gets tests** at the level the project uses: logic/services → unit tests (XCTest, or Swift Testing if the project adopted it); flows → UI tests where the project maintains them.
2. **Use the project's existing stack** (XCTest vs Swift Testing, OHHTTPStubs/URLProtocol stubs, mock generators) — no second test framework in one PR.
3. **Tests are deterministic**: injected clocks, stubbed network (URLProtocol/mock layer the project uses), no real sleep-based timing, no order dependence between test methods.
4. **Dependencies isolated at the seams the project already has** (protocols + injection, closure injection) — tests don't hit real endpoints.
5. **Error and edge paths covered**: failures, empty states, boundary values — not only the happy path.
6. **Assertions assert outcomes**: state after the action, returned values, rendered labels — not incidental internals.

## Positive recommendations

- Bug-fix PRs include a regression test that fails without the fix.
- Prefer a few meaningful assertions over many trivial ones; avoid snapshot tests for trivially-styled views unless the project invests in goldens already.

## Anti-patterns to flag

```swift
// BAD — real network in a unit test
func testFetch() async throws { let user = try await api.me() } // hits prod

// BAD — sleep-based sync
Thread.sleep(forTimeInterval: 2.0) // then assert

// BAD — order-dependent tests sharing mutable fixtures
```

## Preserve existing conventions

- **Do not require tests for trivial changes without justification** (renames, comments, formatting).
- Follow the project's naming (`test_<subject>_<condition>_<expected>` or the project's existing style) and target layout.
