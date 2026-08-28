---
description: "Use when a Flutter change makes HTTP/network requests, talks to backends, or consumes remote APIs. Enforces networking separation and consistent request/response handling."
applyTo: "**/lib/**/*.dart"
---

# API Calls (Flutter)

## Scope

Applies to HTTP clients (dio, http, retrofit, graphql, sockets) and any remote data access.

## Review rules

1. **Networking lives outside the UI.** Widgets call methods on the project's API clients/repositories/services; `dio`/`http` calls must not appear inside widget `build()` or event handlers directly (when the project keeps clients in a data layer).
2. **Endpoints are not inlined ad hoc.** If the project centralizes base URLs/paths (constants, environment config, generated clients), follow it. Never hardcode secrets, API keys, or tokens in Dart source.
3. **Every request path defines loading, success, and failure handling.** A call whose failure only shows a blank screen is a finding.
4. **Response parsing is typed.** `jsonDecode` results map through `fromJson`/model classes — not raw `Map<String, dynamic>` lookups sprinkled through UI code.
5. **Cancellation uses the mechanism the project's networking solution actually provides** — e.g. dio `CancelToken`, rxdart `switchMap`, or whatever cancellation API the project uses. Do not assume a specific library exists, and do not suggest cancellation mechanisms a client does not support.
6. **Timeouts are set** (or provided by the project's shared client config) — a request without a timeout can hang the UI state forever.
7. **No secrets in logs**: request/response interceptors must not log headers, tokens, or full bodies containing PII.

## Positive recommendations

- Follow the project's envelope/error-model conventions (e.g. mapping HTTP status → typed exceptions) rather than inventing per-call error shapes.
- Serialize writes safely: guard submit buttons with the in-flight state pattern the project uses (a flag, a state class, or stream-based).

## Anti-patterns to flag

```dart
// BAD — networking in a widget
ElevatedButton(
  onPressed: () async {
    final res = await http.get(Uri.parse('https://api.example.com/items?token=ABC123'));
  },
)

// BAD — untyped parsing in UI
final name = (data['user'] as Map)['name'] as String;

// BAD — no failure handling
final res = await client.get(url);
setState(() => items = parse(res.body)); // what if 500/offline?
```

## Preserve existing conventions

- If the project uses code generation (retrofit, openapi, ferry), do not suggest hand-written requests — and vice versa.
- Per-call one-off requests inside tiny utilities may be acceptable; flag only where the project's pattern clearly centralizes networking.
