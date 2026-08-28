---
description: "Use when Swift code throws, catches, maps, or presents errors. Enforces typed error handling without swallowing failures and without forcing new error frameworks."
applyTo: "**/*.swift"
---

# Error Handling (iOS / Swift)

## Scope

Applies to `Error`/`throw`, `do/catch`, `Result`, error mapping, and error presentation.

## Hard rules

1. **No swallowed errors**: empty `catch {}`, `try?` on operations whose failure the user must know about, or catches that only `return` hide real failures.
2. **No raw error text to users**: `error.localizedDescription` directly into UI is acceptable only where the project already does it; otherwise map through the project's message resources.
3. **No `try!` or `as!`** — both crash on failure; use `try?` with explicit handling or `as?` with a fallback.

## Review rules

- Typed errors: if the project defines error enums (e.g. `APIError: Error, LocalizedError`), new throwing code conforms/maps into them rather than introducing parallel string errors.
- `catch` blocks catch what they claim to handle: prefer `catch let error as APIError` / specific cases over blanket `catch` that masks programming errors.
- `Result`-based APIs keep error semantics consistent with the project's existing Result usage; async/await code throws typed errors instead of returning sentinel values (`nil` meaning "error" is a finding where the project distinguishes them).
- UI presents loading/success/error consistently with the project's pattern (alerts, banners, inline states) and offers recovery (retry) where the project does.
- Logging includes operation context (endpoint/action) without logging secrets or PII; use the project's logger, not bare `print`/`NSLog`.

## Positive recommendations

- Convert low-level errors (URLError, DecodingError) into domain errors at the boundary the project owns (client/service layer), so UI never patterns-matches on framework types.
- Include enough context when logging (operation, endpoint/user action) without logging secrets or full payloads.

## Anti-patterns to flag

```swift
// BAD — swallowed
try? await api.deleteAccount() // failure invisible

// BAD — blanket catch masking bugs
catch { print("failed") }

// BAD — nil-as-error sentinel
let user = try? fetchUser() // nil = error? not found? crash?
```

## Preserve existing conventions

- If the project uses a centralized error funnel (network layer → typed error → global presenter), new code plugs into it — don't duplicate handling per call site.
- Don't introduce a new Result/Either library alongside the project's existing error approach.
