---
description: "Use when an Android change handles secrets, Keystore/encrypted storage, tokens, sensitive data, permissions, exported components, WebViews, or network security. Enforces secure handling without forcing a specific storage mechanism."
applyTo: "**/AndroidManifest.xml,**/*.kt,**/*.java,**/res/xml/*.xml"
---

# Android Security

## Scope

Applies to any change that stores, transmits, logs, or displays sensitive data (credentials, tokens, PII), or configures the manifest, permissions, network security, or WebViews. The Kotlin/Java glob is intentionally broad — apply the code rules only when the change touches sensitive data or security-relevant configuration.

## Hard rules

1. **No secrets in source, gradle files, or committed config**: API keys/tokens in Kotlin strings, `build.gradle`, or `local.properties`-adjacent committed files ship in the APK. Secrets belong in `local.properties`-fed build injection, NDK, or backend-proxied calls — never committed source.
2. **Tokens and PII are not persisted in plaintext storage**: plain `SharedPreferences`/files for tokens or sensitive user data is a finding. Use the encrypted mechanism the project already uses (EncryptedSharedPreferences, Keystore-backed stores, or a newer equivalent) — do not mandate a specific one.
3. **Cleartext traffic is blocked**: `android:usesCleartextTraffic="true"` or missing Network Security Config for sensitive domains is a critical finding; TLS only.
4. **No sensitive data in logs**: `Log.d/Log.v`/ Timber of tokens, headers, or PII; in release builds the HTTP logging interceptor must not be at body level.
5. **`PendingIntent`s are immutable**: missing `FLAG_IMMUTABLE` (or unjustified `FLAG_MUTABLE`) is a finding on Android 12+.

## Review rules

- **Exported components**: `android:exported="true"` must be justified by an intent filter; exported activities/receivers/services validate incoming intents before acting on them. Exported without a filter is always a finding.
- **Permissions are least-privilege**: new manifest permissions must be exercised by the change; runtime permissions requested at the moment of use per the project's pattern.
- **Intent handling**: intents from untrusted sources (deep links, broadcasts) validate extras before use; `getSerializableExtra`/`getParcelableExtra` results null-checked.
- **WebView security**: `javaScriptEnabled` only where the page needs it; `allowFileAccess`/file-URL access restricted; untrusted URLs in privileged WebViews; Safe Browsing left enabled where the project keeps it.
- **Network Security Config**: new domains added to `res/xml` trust anchors/cleartext exceptions need justification; user-added CAs only where the project allows them.
- **Certificate pinning is justified, not universal**: flag missing pinning only where the project pins elsewhere or the feature is high-value; flag incorrect pinning (that will break certificate rotation) always.
- **Data lifecycle**: logout/session-invalidate clears encrypted storage, cached tokens, and WebView data where the project clears them.

## Positive recommendations

- Prefer AndroidX security / Jetpack primitives the project already adopted over new third-party security libraries.
- Keep secret plumbing where the project already centralizes it (gradle injection, CI secrets).

## Anti-patterns to flag

```kotlin
// BAD — secret in source
const val API_KEY = "AIzaSy..."

// BAD — token in plaintext storage
prefs.edit().putString("accessToken", token).apply()

// BAD — mutable PendingIntent on API 31+
PendingIntent.getActivity(ctx, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT)
```

## Preserve existing conventions

- If the project deliberately uses a specific encrypted-storage mechanism, review consistency with it — do not suggest replacing it without a concrete deficiency.
- Debug-only secrets/mock credentials must be excluded from release builds — flag ungated ones.
