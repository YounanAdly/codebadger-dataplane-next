# Android Review Rules

Platform detection signals: `AndroidManifest.xml`, `settings.gradle`, `android/`, `.kt`/`.kts` files.

This file is the **loading index** for Android review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. Kotlin-language rules apply to
every Kotlin change; Compose and XML rule packages are scoped in-file ("apply only to
files using those APIs"), so mixed-technology projects are handled without assumptions.
The baseline rules at the bottom always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/android/`:

- .github/instructions/android/kotlin/kotlin.instructions.md — Kotlin language best practices: null safety, platform types, idioms
- .github/instructions/android/kotlin/architecture.instructions.md — consistency with the project's existing architecture; no pattern mandates
- .github/instructions/android/kotlin/coroutines.instructions.md — structured concurrency, dispatchers, cancellation, Flow collection
- .github/instructions/android/kotlin/networking.instructions.md — Retrofit/OkHttp separation, typed responses, secret hygiene
- .github/instructions/android/kotlin/error-handling.instructions.md — typed errors, CancellationException rethrow, no swallowed failures
- .github/instructions/android/kotlin/performance.instructions.md — main-thread discipline, ANR risk, memory leaks, startup
- .github/instructions/android/kotlin/testing.instructions.md — JUnit/Robolectric/instrumented tests with the project's stack
- .github/instructions/android/kotlin/dependencies.instructions.md — gradle/version-catalog justification, KSP/kapt, duplicate purpose
- .github/instructions/android/compose/ui.instructions.md — composable hygiene: side-effect-free composition, modifiers, effect keys
- .github/instructions/android/compose/state-management.instructions.md — state ownership, unidirectional flow, lifecycle-aware collection
- .github/instructions/android/compose/navigation.instructions.md — navigation-compose routes, back-stack semantics, deep links
- .github/instructions/android/compose/accessibility.instructions.md — contentDescription, semantics roles, 48dp targets
- .github/instructions/android/compose/styling-themes.instructions.md — MaterialTheme tokens over hardcoded values
- .github/instructions/android/compose/performance.instructions.md — stability, recomposition costs, list keys; recomposition itself is never a defect
- .github/instructions/android/xml/layouts.instructions.md — XML layout quality, tools: attributes, include/merge reuse
- .github/instructions/android/xml/views.instructions.md — custom views, attrs.xml contracts, onDraw hygiene
- .github/instructions/android/xml/navigation.instructions.md — nav graphs, deep links, exported components
- .github/instructions/android/xml/accessibility.instructions.md — contentDescription, labelFor, sp text, live regions
- .github/instructions/android/xml/styling-themes.instructions.md — colors/dimens tokens, styles, dark theme parity
- .github/instructions/android/localization.instructions.md — strings.xml, plurals, formatted args, RTL, stringResource()
- .github/instructions/android/security.instructions.md — Keystore/encrypted storage, permissions, network security, PendingIntents

## Baseline rules (always loaded)

1. Manifest: no exported components without intent filters need `android:exported="false"`; exported components must validate incoming intents.
2. Permissions: request only what the feature uses; flag new permissions without code that justifies them.
3. No main-thread network or disk I/O — coroutines/workers only.
4. No hardcoded secrets in committed gradle files or code.
5. Store sensitive data in encrypted storage — never plain SharedPreferences or unencrypted SQLite.
6. WebView: disable JavaScript unless needed; never load untrusted URLs; block file access from URLs.
7. Lifecycle: release resources (receivers, listeners, cameras, sensors) in the matching lifecycle callback.
8. Use `ViewModel` + `LiveData`/`StateFlow`; never hold UI state in Activities.
9. Deep links must validate and sanitize parameters.
10. ProGuard/R8: keep rules for reflection-accessed classes; don't ship debuggable `true` in release.
11. TLS only — no cleartext traffic (`usesCleartextTraffic`).
12. Test: unit tests for ViewModels/repositories, instrumented tests for critical flows.

Severity guide:
- **critical**: exported components without protection, cleartext traffic for sensitive data, hardcoded secrets, unencrypted sensitive storage.
- **high**: over-broad permissions, leaked lifecycle resources, main-thread I/O.
- **medium**: missing tests, lifecycle misuse, missing ProGuard rules.
- **low**: readability, formatting, minor optimizations.
