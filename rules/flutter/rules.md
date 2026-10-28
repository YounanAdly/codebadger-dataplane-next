# Flutter Review Rules

Platform detection signals: `pubspec.yaml`, `.dart` files, `lib/`, `test/`, Flutter widget/integration tests.

This file is the **loading index** for Flutter review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files — so a `lib/`-only PR loads the
widget/state/api rules but skips testing or dependency rules until relevant files change.
The baseline rules at the bottom always load, including for PRs (pubspec-only, manifest-only,
metadata) whose files fall outside every instruction-file scope.

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

These are the always-on safety net for Flutter pull requests. Where an indexed instruction
file covers the same concern, its detailed version — including its documented exceptions —
takes precedence over the one-line summary here; never report a baseline line as a blocking
defect when the matching instruction file carves out a legitimate exception.

### Correctness
- Preserve null safety: no `!` force-unwraps, bare `late`, or unchecked casts without local proof the value is present — follow `dart.instructions.md` for the full contract and exceptions.
- Every `Future`/`Stream` error path is handled: no empty catches, no silently dropped futures, no raw exception text shown to users.
- Every screen that loads data handles loading, error, empty, and success states with the project's existing patterns.
- Async continuations that touch `setState`, `context`, or widget state after an `await` are guarded with `mounted` / `context.mounted` when the widget may be gone.

### Lifecycle
- Resources created in a `StatefulWidget` are released in `dispose()`: controllers, focus nodes, animation controllers, timers, stream subscriptions, and listeners (see the widgets and async instruction files for Riverpod/`ref.onDispose` equivalents).

### Security — mirrors `common/security.md`, which always wins
- No secrets, API keys, tokens, or credentials in Dart source, assets, or manifests; sensitive data uses the project's secure storage and secret-injection mechanism.
- TLS only: no cleartext endpoints, no disabled certificate validation, and no sensitive data (tokens, PII) in logs or error reports.
- Client-side checks are UX, not authorization: flag only what the client genuinely owns.

### Quality
- Follow the project's analyzer config, state-management solution, architecture, navigation, localization, and theming conventions — review consistency with them; never mandate a different one.
- Behavior changes ship with tests at the level the project already uses.
- Report real defects with evidence in the diff, a concrete fix, and a severity proportional to impact; do not flag stylistic preferences, and do not repeat one underlying issue as multiple findings.
