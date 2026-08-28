---
description: "Use when a Flutter change adds or modifies tests, or when changed behavior lacks test coverage. Enforces useful unit/widget/integration tests with the project's existing tooling."
applyTo: "**/test/**/*.dart,**/*_test.dart,**/integration_test/**"
---

# Testing (Flutter)

## Scope

Applies to unit tests, widget tests, and integration tests, plus the testability of changed production code.

## Review rules

1. **Changed behavior gets tests** at the level the project uses: pure logic → unit tests; screens/widgets → widget tests (`WidgetTester`); end-to-end flows → integration tests where the project maintains them.
2. **Use the project's existing stack**: `flutter_test`, `mocktail`/`mockito`, `bloc_test`, `mocktail_image_network`, `golden_toolkit` — whatever `pubspec.yaml` already contains. Do not introduce a second mocking framework in a PR.
3. **Tests assert outcomes, not implementation details**: assert rendered text/state/emitted events — not private methods called or widget counts unless that IS the contract.
4. **Tests are deterministic**: no real network, no `DateTime.now()` without injection, no reliance on test execution order. Pump fake time/futures (`pump`, `pumpAndSettle`, fake async) per project convention.
5. **Dependency isolation**: dependencies cross the boundary via injection/overrides the project already uses (provider overrides, constructors) — tests never reach real APIs, files, or platform channels without mocks.
6. **Error and edge paths covered**, not only happy paths: empty results, failures (assert the error UI renders), boundary values.
7. **Pumps and settles are correct**: missing `await tester.pumpAndSettle()` after async UI work is a classic flaky-test source; conversely, `pumpAndSettle` with infinite animations hangs — use explicit `pump(durations)` there.

## Positive recommendations

- A regression test that fails without the fix is the ideal shape for bug-fix PRs.
- Prefer a few meaningful assertions over many trivial ones; avoid snapshot/golden tests for trivially-styled widgets unless the project invests in goldens already.

## Anti-patterns to flag

```dart
// BAD — implementation-detail assertion
expect(bloc.calls, 1); // when the user-visible contract is the rendered state

// BAD — real network in a widget test
testWidgets(... (tester) async { await tester.pump(); await api.fetch(); });

// BAD — order-dependent tests relying on shared mutable fixtures

// BAD — pumpAndSettle with an infinite spinner → test hangs
```

## Preserve existing conventions

- **Do not require tests for trivial changes without justification** (pure renames, comments, generated code, formatting).
- Match the project's describe/group naming and file mirroring layout (`test/feature/x_test.dart` for `lib/feature/x.dart`).
