---
description: "Use when Android code makes network requests or consumes remote APIs. Enforces networking separation, typed responses, and secret hygiene."
applyTo: "**/*.kt,**/*.java"
---

# Networking (Android)

## Scope

Applies to Retrofit/OkHttp/Ktor or any HTTP access in Android code.

## Review rules

1. **Networking lives outside UI classes** — in the layer the project uses (repositories, data sources, API services). Direct `OkHttpClient`/`Retrofit` usage inside Activities/Fragments/Composables is a finding when the project routes it elsewhere.
2. **Secrets never in source or BuildConfig-public fields committed to VCS**: API keys/tokens belong in `local.properties`-fed secrets, NDK, or server-proxied — a hardcoded key in Kotlin source ships in the APK.
3. **Typed responses**: Retrofit interfaces with model classes / Ktor serialization — not raw `String` response parsing in feature code (unless the project deliberately does that).
4. **Every call path handles loading/success/error** consistent with the project's state pattern; errors map into the project's error types.
5. **Timeouts and interceptors** (auth headers, logging, retry) are configured once in the shared client the project owns — per-call one-off clients bypassing them are a finding.
6. **Cleartext traffic is blocked**: no `usesCleartextTraffic="true"` or `http://` endpoints without explicit justification; network security config respected.
7. **No secrets in logs**: OkHttp logging interceptor at `BODY` level in release builds, or logging headers/tokens, is a finding.

## Positive recommendations

- Follow the project's envelope/error model (mapping HTTP status → sealed error types) rather than per-call ad hoc handling.
- Cancellation flows through the project's mechanism (coroutine cancellation propagating to Retrofit/Ktor calls).

## Anti-patterns to flag

```kotlin
// BAD — networking in an Activity (in a repository project)
OkHttpClient().newCall(Request.Builder().url("https://api.example.com?token=SECRET").build())

// BAD — release build with full-body logging
HttpLoggingInterceptor().apply { level = BODY } // unconditional

// BAD — ignoring response status
val body = response.body?.string() // no response.isSuccessful check
```

## Preserve existing conventions

- If the project uses Retrofit consistently, review within Retrofit; don't suggest Ktor/OkHttp rewrites (or vice versa).
