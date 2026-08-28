---
description: "Use when a Flutter change handles secrets, tokens, sensitive user data, storage, TLS, WebViews, or credentials. Enforces secure handling without forcing a specific security package."
applyTo: "**/*.dart,**/AndroidManifest.xml,**/Info.plist"
---

# Flutter Security

## Scope

Applies to any change that stores, transmits, logs, or displays sensitive data (credentials, tokens, PII), or configures network/WebView behavior. Apply to Dart code plus the platform manifests the app ships.

## Hard rules

1. **No secrets in source**: API keys, tokens, passwords, signing material in Dart strings ship in the binary and are trivially extractable. Secrets belong in build-time injection (`--dart-define`/env plumbing), backend-proxied calls, or the platform secret stores — never committed source.
2. **Tokens and PII are not persisted in plaintext storage**: plain `SharedPreferences`/`shared_preferences`/file caches for tokens or sensitive user data is a finding. Use the secure storage mechanism the project already uses (flutter_secure_storage, platform Keychain/Keystore bridges, or an equivalent) — do not mandate a specific package.
3. **TLS only**: `http://` endpoints or clients configured to accept bad certificates (`badCertificateCallback` returning true without validation) are critical findings.
4. **No sensitive data in logs**: `debugPrint`/`print`/log interceptors printing tokens, headers, full bodies containing PII, or crypto material are findings.

## Review rules

- **Certificate pinning is justified, not universal**: flag *missing* pinning only where the project clearly pins everywhere else or the feature handles high-value data; flag *incorrect* pinning (pinning that will brick certificate rotation) always.
- **WebView security**: `javascriptMode: JavascriptMode.unrestricted` only where the page needs it; loading untrusted URLs in a privileged WebView; file/origin access grants without validation.
- **Clipboard**: sensitive values copied to the clipboard without the app's usual masking/clearing pattern where the project handles it.
- **Deeplinks and app links** that carry tokens/identifiers validate parameters before use (injected apps can spoof deep links).
- **Screen capture** of sensitive screens follows the project's existing approach where it has one; do not demand new capture-blocking without a project precedent.
- **Data lifecycle**: logout/session-invalidate paths clear cached tokens and sensitive caches (consistent with the platform-security rules for the underlying OS stores).

## Positive recommendations

- Keep secret plumbing where the project already centralizes it (flavors, env config, CI injection) rather than new ad-hoc paths.
- Prefer the platform's secure enclaves via the project's existing storage abstraction over adding new storage packages.

## Anti-patterns to flag

```dart
// BAD — secret in source
const apiKey = 'AIzaSy...';

// BAD — token in plaintext storage
prefs.setString('accessToken', token);

// BAD — TLS disabled
client.badCertificateCallback = (cert, host, port) => true;
```

## Preserve existing conventions

- If the project deliberately uses a specific storage package or proxy for secrets, review consistency with it — do not suggest replacing it without a concrete deficiency.
- Debug-only utilities (mock tokens, test endpoints) must be gated to debug builds — flag ungated ones.
