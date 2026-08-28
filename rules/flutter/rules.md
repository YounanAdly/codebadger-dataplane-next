# Flutter Review Rules

Platform detection signals: `pubspec.yaml`, `.dart` files, `lib/`, `test/`, Flutter widget/integration tests.

This file is the **loading index** for Flutter review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files — so a `lib/`-only PR loads the
widget/state/api rules but skips testing or dependency rules until relevant files change.
The baseline rules at the bottom of this file always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/flutter/`:

- .github/instructions/flutter/dart.instructions.md — Dart language best practices: null safety, typing, naming, no dynamic
- .github/instructions/flutter/architecture.instructions.md — consistency with the project's existing architecture; no pattern mandates
- .github/instructions/flutter/state-management.instructions.md — follow the project's state solution (Riverpod/Bloc/Provider/…); separation of state and UI; rebuild scoping
- .github/instructions/flutter/widgets.instructions.md — widget composition, const usage, dispose/mounted correctness, build() hygiene
- .github/instructions/flutter/navigation.instructions.md — consistency with the existing router (Navigator/go_router/auto_route); validated deep links
- .github/instructions/flutter/api-calls.instructions.md — networking separation, typed responses, loading/error handling, cancellation
- .github/instructions/flutter/error-handling.instructions.md — no swallowed exceptions, meaningful localized error states
- .github/instructions/flutter/async.instructions.md — Futures/Streams, mounted checks, race conditions, cancellation/disposal
- .github/instructions/flutter/performance.instructions.md — rebuilds, list/image cost, memory; only diff-visible costs
- .github/instructions/flutter/testing.instructions.md — unit/widget/integration tests matching the project's stack
- .github/instructions/flutter/accessibility.instructions.md — Semantics labels, touch targets, text scaling, contrast
- .github/instructions/flutter/localization.instructions.md — no hardcoded strings, key parity, RTL, plurals
- .github/instructions/flutter/styling-themes.instructions.md — theme tokens over hardcoded values, dark/light consistency
- .github/instructions/flutter/dependencies.instructions.md — justified pubspec changes, no duplicate-purpose packages
- .github/instructions/flutter/platform-integration.instructions.md — MethodChannel/EventChannel contracts, error propagation, plugin boundaries
- .github/instructions/flutter/security.instructions.md — no secrets in source, secure storage, TLS, WebView/clipboard safety

## Baseline rules (always loaded)

## Language & analyzer
- Follow the project's configured Dart analyzer rules and `dart format` expectations.
- Follow Effective Dart naming conventions (lowerCamelCase members, PascalCase types).
- Check null-safety correctness: no unsafe `!` force unwraps without a preceding null check; prefer `?.`, `??`, and pattern matching.
- No `dynamic` types — use proper type annotations.

## Widgets & performance
- Prefer `const` constructors and widgets when values are compile-time constants.
- Avoid expensive work inside `build()`; never call `setState()` inside `build()` or `initState()`.
- Use `ListView.builder` for long lists — never materialize all children at once.
- Use `Keys` on items in `ListView`, `Column`, etc. for proper widget identity.
- Decompose the widget tree into small, focused widgets.
- Prefer targeted rebuilds (`Consumer`/`Selector`, Riverpod/Bloc) over full-widget `setState`; follow the project's existing state-management pattern.

## Resources & async
- Dispose controllers, focus nodes, animation controllers, and stream subscriptions in `dispose()`.
- Handle all `Future`/`Stream` errors with `try/catch` or `.catchError()`; check null safety on async results.
- Handle loading, error, empty, and success states in every screen.

## App quality
- Business logic must not live directly inside widgets — separate it from UI.
- No `print()`/`debugPrint()` in production code.
- All user-visible strings must use `intl`/localization — no hardcoded text.
- Review accessibility semantics, labels, text scaling, and touch-target sizes.
- Check responsive behavior across screen sizes and orientations; keep navigation consistent with the app's router.
- Do not expose API keys, tokens, or credentials in Dart source; use secure storage for sensitive data.
- Review Android/iOS platform-channel integration for lifecycle correctness on both platforms.
- Add or update unit, widget, or integration tests for changed behavior.
- Flag unnecessary new dependencies.
