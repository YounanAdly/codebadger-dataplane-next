---
description: "Use when an iOS change handles secrets, Keychain storage, tokens, sensitive data, ATS/TLS, WebViews, pasteboard data, or credentials. Enforces secure handling without forcing a specific security library."
applyTo: "**/*.swift,**/Info.plist,**/*.entitlements"
---

# iOS Security

## Scope

Applies to any change that stores, transmits, logs, or displays sensitive data (credentials, tokens, PII), or configures App Transport Security, entitlements, or WebViews.

## Hard rules

1. **No secrets in source or Info.plist**: API keys, tokens, passwords in Swift source or plist entries ship inside the binary. Secrets belong in build-time injection or backend-proxied calls.
2. **Sensitive credentials go to the Keychain**, not `UserDefaults`, files, or CoreData defaults. Keychain accessibility classes are chosen deliberately (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for tokens the app must not migrate/back up casually). Do not mandate a specific Keychain wrapper — use the project's existing one.
3. **ATS is not weakened without justification**: `NSAllowsArbitraryLoads` (or per-domain `NSExceptionAllowsInsecureHTTPLoads` for non-loopback hosts) in Info.plist is a critical finding unless the change documents why.
4. **No sensitive data in logs**: `print`/`NSLog`/`os_log` of tokens, Authorization headers, or PII — use the project's logger with redaction (`os_log` `%{private}` where the project does).

## Review rules

- **Token lifecycle**: logout/session-invalidate clears Keychain items and caches; refresh tokens are single-use-aware; expired-token paths don't retry forever.
- **Pasteboard**: sensitive values copied via `UIPasteboard` are flagged where the project protects them (expiration/masking) — copying raw tokens/PII to the pasteboard unguarded is a finding.
- **Biometric-gated storage**: where the project gates data behind `LAContext`, new sensitive items follow the same pattern (and evaluate `canEvaluatePolicy` before assuming biometrics).
- **Certificate pinning is justified, not universal**: flag missing pinning only where the project pins everywhere else or the feature handles high-value data; flag incorrect pinning (that will break certificate rotation) always.
- **WKWebView**: `javaScriptEnabled` only where the page needs it; untrusted URLs in privileged WebViews; navigation delegates validating destinations where the project validates them; no universal file access from web content.
- **Entitlements**: new entitlements (associated domains, keychain-access-groups, app groups) must match features actually implemented — over-broad entitlements are a finding.
- **URL schemes / universal links** carrying tokens or identifiers validate inputs before use.

## Positive recommendations

- Keep secret plumbing where the project already centralizes it (build configurations, xcconfig files, CI injection).
- Prefer `URLSession`'s TLS stack and the project's networking layer over custom trust evaluation.

## Anti-patterns to flag

```swift
// BAD — secret in source
let apiKey = "AIzaSy..."

// BAD — token in UserDefaults
UserDefaults.standard.set(token, forKey: "accessToken")

// BAD — keychain item backed up and migratable by default
// (kSecAttrAccessibleAlways instead of a WhenUnlocked* class for sensitive data)
```

## Preserve existing conventions

- If the project uses a specific Keychain wrapper or security layer, review consistency with it — do not suggest replacing it without a concrete deficiency.
- Debug-only secrets/mock credentials must be excluded from release builds (`#if DEBUG`) — flag ungated ones.
