# Flutter Review Fixture — Expected Findings

Evaluation dataset for the Codrevia Flutter ruleset. Kept separate from the rules so
future rule changes can be regression-tested against the same expectations.

- `positive.diff` — a Flutter pull request full of realistic defects. Genuine defects
  must be detected; expected detections are listed below.
- `negative.diff` — a clean, idiomatic Flutter pull request. It must produce **no
  deterministic scanner findings**, and the AI layer must not flag the listed
  valid implementations as defects.

## Positive cases (`positive.diff`) — must be flagged

| # | Location | Defect | Expected rule source | Expected severity | Evidence | Remediation |
|---|----------|--------|----------------------|-------------------|----------|-------------|
| P1 | `lib/api_client.dart:9` | TLS certificate validation disabled | Scanner `dart-tls-bypass` + `flutter/security.instructions.md` ("TLS only") | critical | `badCertificateCallback = (cert, host, port) => true` on an added line | Validate/pin certificates; at most gate a debug-only exception to debug builds |
| P2 | `android/app/src/main/AndroidManifest.xml:5` | Cleartext traffic enabled app-wide in a shipped manifest | Scanner `android-cleartext-traffic` + `flutter/security.instructions.md` ("TLS only") | critical | `android:usesCleartextTraffic="true"` added outside `src/debug/` | Use `android:networkSecurityConfig` with per-domain exceptions, or remove the attribute |
| P3 | `lib/api_client.dart:5` | Hardcoded API key in Dart source | `common/security.md` + `flutter/security.instructions.md` hard rule 1 | critical | Literal secret string assigned to `static const apiKey` | Move to `--dart-define`/env plumbing or backend proxying |
| P4 | `lib/api_client.dart:10` | Cleartext `http://` endpoint | `flutter/security.instructions.md` ("TLS only") | critical/high | `Uri.parse('http://api.example.com/profile')` | Use `Uri.https` |
| P5 | `lib/api_client.dart:8` | `HttpClient` created per call and never closed | `flutter/api-calls.instructions.md` rule 8 ("HTTP clients are reused or closed") | medium | Per-call `HttpClient()` with no `close()` anywhere in the diff | Shared client or scoped `close()` |
| P6 | `lib/profile_screen.dart:32` | `setState` after an `await` without a `mounted` check | `flutter/async.instructions.md` rule 1 + `flutter/widgets.instructions.md` hard rule 3 | high | `await ApiClient().fetchProfile(...)` then `setState(...)` with no `mounted` guard | `if (!mounted) return;` before `setState` |
| P7 | `lib/profile_screen.dart:33` | Swallowed exception (`catch (_) {}`) | `common/code-quality.md` + `flutter/error-handling.instructions.md` hard rule 1 | high/medium | Empty catch around a network call | Handle, log through the project logger, or propagate |
| P8 | `lib/profile_screen.dart:29` | Session token persisted in plaintext `SharedPreferences` | `flutter/security.instructions.md` hard rule 2 | high/critical | `prefs.setString('accessToken', ...)` | Use the project's secure storage mechanism |
| P9 | `lib/profile_screen.dart:22` | `Theme.of(context)` (inherited-widget lookup) in `initState` | `flutter/widgets.instructions.md` hard rule 5 | high | Inherited lookup before the state is fully initialized | Move to `build()`/`didChangeDependencies()` |
| P10 | `lib/profile_screen.dart:16,23` | `TextEditingController` and `StreamSubscription` never released (no `dispose()` at all) | `flutter/widgets.instructions.md` hard rules 1–2 | high | Controller field + `.listen(...)` with no matching dispose/cancel | Add `dispose()` cancelling/closing both |
| P11 | `lib/profile_screen.dart:24` | Dropped future: `_loadProfile();` fire-and-forget without `unawaited` or error handling | `flutter/async.instructions.md` rule 2 | medium | Unawaited async call whose errors vanish | `await`, `unawaited(...)`, or `..onError(...)` |

Context-dependent (must **not** be blocking in a single-locale project, `low`/`info` at most):
`lib/profile_screen.dart:39` hardcoded `'Profile'` string — `flutter/localization.instructions.md`
"Preserve existing conventions" applies.

## Negative cases (`negative.diff`) — must NOT be flagged

| # | Location | Valid implementation | Rule that must stay silent |
|---|----------|----------------------|----------------------------|
| N1 | `lib/profile_screen.dart:59-65` (`dispose`) | Observer removed, subscription cancelled, controller disposed, `super.dispose()` last | `widgets.instructions.md` hard rules 1–2 (lifecycle) |
| N2 | `lib/profile_screen.dart:41-43` | `if (!mounted) return;` before `setState` after `await` | `async.instructions.md` rule 1 (mounted checks) |
| N3 | `lib/profile_screen.dart:51-53` | `PopScope` + `onPopInvokedWithResult` for pop interception | `navigation.instructions.md` rule 6 (PopScope over deprecated WillPopScope) |
| N4 | `lib/profile_screen.dart:26-30` | Subscription callback guarded with `mounted` before `setState` | `async.instructions.md` rule 1 |
| N5 | `lib/profile_repository.dart:16-18` | Single shared `HttpClient` with a 10s `connectionTimeout` | `api-calls.instructions.md` rules 6 and 8 (timeouts, client lifecycle) |
| N6 | `lib/profile_repository.dart:29-31` | Non-OK status checked and mapped to a thrown failure | `api-calls.instructions.md` rule 3 (failure handling) |
| N7 | `lib/profile_repository.dart:33` | Typed parsing through `Profile.fromJson` with a null-safe fallback | `api-calls.instructions.md` rule 4 (typed response parsing) |
| N8 | `lib/profile_repository.dart:43-46` | Token read from secure storage; no secrets in source | `security.instructions.md` hard rules 1–2 |
| N9 | `pubspec.yaml` | New dependency (`flutter_secure_storage`) directly motivated by the token-storage code in the same PR | `dependencies.instructions.md` rule 1 (justified dependency) |
| N10 | `lib/profile_screen.dart:25` | `addListener`-equivalent periodic stream kept in a cancellable subscription | `widgets.instructions.md` hard rule 2 (listener symmetry) |

## Deterministic layer expectations

`scanDiff(parseUnifiedDiffFiles(positive.diff))` returns exactly 2 findings:
`dart-tls-bypass` (P1) and `android-cleartext-traffic` (P2), both severity
`critical`, category `security`. `scanDiff` on `negative.diff` returns 0 findings.
