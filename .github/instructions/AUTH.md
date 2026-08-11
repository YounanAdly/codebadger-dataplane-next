# Auth Flow

> **Status**: Dual-token cookie auth — **shipped**.
> Re-read this file before touching anything under `src/app/shared/services/auth/`,
> `src/app/shared/interceptors/auth.interceptor.ts`, or the OTP / login / create-account screens.

---

## 1. What the backend does today (verified)

Probed end-to-end against `https://app-api-marafiq-we-dev-001.azurewebsites.net` on 2026-06-23 with `x-source: portal`:

| Endpoint | Auth-relevant behavior |
|---|---|
| `POST /api/v1/auth/login/request-otp` | Body: `{ correlationId, expiresAtUtc, maskedPhone, devCode }`. No auth cookies. |
| `POST /api/v1/auth/otp/verify` | Body: `{ result: { accessToken, accessTokenExpiresAtUtc } }`. **Sets `Set-Cookie: refresh_token=<opaque>; expires=<+30d>; path=/; samesite=strict; httponly`**. |
| `POST /api/v1/auth/token/refresh` | Cookie-driven (browser auto-attaches `refresh_token`). Body: `{ result: { accessToken, accessTokenExpiresAtUtc } }`. Rotates the cookie via fresh `Set-Cookie` — **single-use**: replaying the previous cookie returns `400 {"errorMessageEn":"Refresh token has already been used or revoked.","code":4012}`. Without the cookie returns `400 {"errorMessageEn":"Refresh token is required.","code":0}`. |
| `POST /api/v1/auth/logout` | Body: `{ result: true }`. **Clears the cookie** via `Set-Cookie: refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`. |
| `POST /api/v1/auth/register/verify` | Body: `{ result: { contactId, accountType, maskedPhone } }`. Does **not** set a `refresh_token` cookie and does **not** return an `accessToken` — the user must complete a login OTP cycle after registering. |
| `GET /api/v1/cases/complaints` (protected) | `200` with `Authorization: Bearer <jwt>`. **`401` with the refresh cookie only — the backend does NOT auth protected endpoints via cookie.** The refresh cookie is exclusively for `/token/refresh`. |

**Dual-delivery design**: the access JWT is in the **response body** so mobile clients can read it directly. The web client also reads it (once) and holds it in an in-memory signal — never in `sessionStorage` / `localStorage` — so XSS cannot exfiltrate it. The HttpOnly `refresh_token` cookie is the only piece of long-lived auth state, and JS never sees it.

Re-run the probe with:

```bash
curl -s -i -c jar.txt -X POST \
  'https://app-api-marafiq-we-dev-001.azurewebsites.net/api/v1/auth/login/request-otp' \
  -H 'Content-Type: application/json' \
  -H 'X-Api-Subscription-Key: <key>' \
  -H 'x-source: portal' \
  -d '{"phone":"50000000"}'
```

Then use the returned `correlationId` + `devCode` on `/api/v1/auth/otp/verify` (re-using `-b/-c jar.txt`).

---

## 2. How the Angular app handles auth

```
┌──────────────────┐    1. request-otp        ┌──────────────────┐
│ LoginComponent   │ ────────────────────────►│  Backend (Azure) │
│                  │ ◄──────────────────────  │                  │
│                  │    correlationId + devCode                  │
│                  │                          │                  │
│                  │    2. verify-otp         │                  │
│                  │ ────────────────────────►│                  │
│                  │ ◄──────────────────────  │                  │
│                  │    { accessToken, accessTokenExpiresAtUtc } │
│                  │    Set-Cookie: refresh_token (HttpOnly, 30d)│
└────────┬─────────┘                          └─────────▲────────┘
         │                                              │
         │ setSession({ accessToken, expiresAtUtc })    │
         ▼                                              │
┌──────────────────┐                                    │
│   AuthService    │                                    │
│ ┌──────────────┐ │                                    │
│ │ accessToken  │ │  in-memory signal (XSS-proof)      │
│ │   signal     │ │                                    │
│ └──────────────┘ │                                    │
│ sessionStorage:  │                                    │
│   auth_token_exp                                      │
│   auth_contact_id     (decoded from JWT claims)       │
│   auth_account_type   (decoded from JWT claims)       │
└────────┬─────────┘                                    │
         │ getAccessToken()                             │
         ▼                                              │
┌──────────────────┐  Authorization: Bearer <jwt>       │
│ authInterceptor  │ ───────────────────────────────────┘
└──────────────────┘  + X-Api-Subscription-Key + x-source
                      + withCredentials: true (browser auto-sends refresh_token cookie)
```

**Touchpoints:**

| File | Responsibility |
|---|---|
| [`auth-api.service.ts`](../../src/app/shared/services/auth/auth-api.service.ts) | HTTP surface for `/api/v1/auth/*`. Returns `ApiEnvelope<T>`. |
| [`auth.types.ts`](../../src/app/shared/services/auth/auth.types.ts) | `VerifyOtpResult` / `RefreshTokenResult` — `{ accessToken, accessTokenExpiresAtUtc }`. Plus `JwtClaims` for the decoded JWT payload (`contact_id`, `account_type`, `phone`, `sub`, …). |
| [`auth.service.ts`](../../src/app/shared/services/auth.service.ts) | Holds JWT in in-memory `accessToken` signal (never persisted). Persists only non-secret metadata (`auth_token_exp`, `auth_contact_id`, `auth_account_type`) to `sessionStorage`; the latter two are decoded from JWT claims on `setSession`. `isAuthenticated` is a `computed()` over the expiry. `refresh()` is single-flight via `shareReplay`. `logout()` calls the backend so the cookie is cleared, then wipes local state via `finalize`. |
| [`auth.interceptor.ts`](../../src/app/shared/interceptors/auth.interceptor.ts) | Attaches `Authorization: Bearer <token>` from `AuthService.getAccessToken()` on every `/api/*` call; also `X-Api-Subscription-Key` and `x-source: portal`. Sets `withCredentials: true` so the `refresh_token` cookie rides along on `/token/refresh` and `/logout`. |
| [`error.interceptor.ts`](../../src/app/shared/interceptors/error.interceptor.ts) | On `401`: single-flight `AuthService.refresh()`, retry once on success; on failure clear session and route to `/:lang/login`. **This is also how page reloads recover** — the in-memory JWT is empty after reload, the first protected call 401s, the existing refresh flow repopulates the signal via the cookie. |
| [`auth.guard.ts`](../../src/app/shared/guards/auth.guard.ts) / [`login-prompt.guard.ts`](../../src/app/shared/guards/login-prompt.guard.ts) | Route protection — both check `isAuthenticated()`, which stays truthy across reloads because the expiry is in `sessionStorage`. |

---

## 3. XSS posture

| Concern | This setup |
|---|---|
| Can XSS read the access JWT? | **No** — held in a closure-scoped signal, never written to `localStorage` / `sessionStorage`. |
| Can XSS read the refresh token? | **No** — `HttpOnly` cookie, invisible to JS. |
| Can XSS make authenticated requests *while the page is open*? | Yes (same as any in-memory-token SPA). The fix is preventing XSS at the source — CSP, output escaping, dependency audits. |
| Can XSS persist authenticated access *after the user closes the tab*? | **No** — refresh cookie is `HttpOnly`, JS can neither read nor copy it. |

That last property is the win: even if XSS happens, the attacker can't carry the session away.

---

## 4. Cross-origin (production) checklist

Dev runs same-origin via the Angular dev-server proxy ([proxy.conf.json](../../proxy.conf.json)), so cookies just work. Cross-origin production requires the backend to send:

- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Origin: <exact-origin>` (NOT `*`)
- `Set-Cookie: refresh_token=...; SameSite=None; Secure; ...` (current `SameSite=Strict` blocks cross-site)

The frontend is already configured — `withCredentials: true` is set by [`auth.interceptor.ts`](../../src/app/shared/interceptors/auth.interceptor.ts), and the dev-server proxy is in [proxy.conf.json](../../proxy.conf.json).

---

## 5. Defense-in-depth (recommended, not blocking)

- **Add a Content-Security-Policy** meta or HTTP header to [src/index.html](../../src/index.html). Example: `default-src 'self'; script-src 'self'; connect-src 'self' https://app-api-marafiq-we-dev-001.azurewebsites.net; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-ancestors 'none';` — the single biggest XSS mitigation.
- **CSRF**: the project already wires `withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })` in [`app.config.ts`](../../src/app/app.config.ts) — harmless if unused, automatic protection if the backend ever issues the cookie.
