---
description: "Use when iOS code makes network requests or consumes remote APIs. Enforces URLSession best practices, typed responses, error handling, and secret hygiene."
applyTo: "**/*.swift"
---

# Networking (iOS)

## Scope

Applies to URLSession, Alamofire/Moya/other networking stacks, and remote API access.

## Review rules

1. **Networking lives outside views/view controllers** — in the layer the project uses (services, repositories, clients). `URLSession` calls inside view controllers are a finding when the project routes them elsewhere.
2. **Secrets never in source**: API keys, tokens, basic-auth credentials belong in config/secrets plumbing the project uses. A hardcoded key in Swift source ships in the binary.
3. **Typed decoding**: `Decodable` models via `JSONDecoder` — not `JSONSerialization` dictionary-walking sprinkled in feature code (unless the project deliberately uses that everywhere).
4. **Every request path handles failure**: error mapping consistent with the project's error types; UI shows loading/success/error states.
5. **Timeouts and caching** come from the project's URLSession configuration — one-off sessions with default (60s) or no timeouts in feature code are a finding when a shared session exists.
6. **Cancellation**: requests tied to a disappearing screen cancel where the project cancels (`task.cancel()`, session task handles, Alamofire `request.cancel()`).
7. **No `ATS` weakening**: `NSAllowsArbitraryLoads` or per-domain exceptions need explicit justification; TLS only.
8. **No secrets in logs**: request/response loggers must redact `Authorization` headers and tokens.

## Positive recommendations

- Reuse the project's configured session/client (interceptors, auth headers, base URL) instead of constructing new ones per call.
- Retry/backoff, if any, lives in the shared layer the project already owns — not ad hoc per call.

## Anti-patterns to flag

```swift
// BAD — networking in a view controller (in a project that uses services)
URLSession.shared.dataTask(with: URL(string: "https://api.example.com/v1/items?token=SECRET")!)

// BAD — untyped parsing in feature code
let dict = try JSONSerialization.jsonObject(with: data) as! [String: Any]

// BAD — no error handling
let (data, _) = try await URLSession.shared.data(from: url) // response status ignored

// BAD — fresh session per call
let session = URLSession(configuration: .default) // bypasses shared config
```

## Preserve existing conventions

- If the project uses Alamofire/Moya consistently, review within that stack; do not suggest URLSession rewrites (or vice versa).
- Code-generated clients (OpenAPI) belong where the project keeps them; never flag their placement.
