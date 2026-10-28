---
description: "Use when a change touches HTTP request handling in Node.js services: routes, controllers, middleware. Enforces validated, authenticated, bounded endpoints with safe error responses."
applyTo: "**/routes/**,**/controllers/**,**/middleware/**,**/api/**,**/server/**,**/handlers/**"
---

# Node.js API Layer

## Scope

Applies to HTTP-facing backend code: route definitions, controllers, middleware. Runtime/async mechanics belong to the Node pack.

## Hard rules

1. **Every mutating endpoint authenticates and authorizes** (middleware or explicit check) before touching state — deny by default; a new POST/PUT/PATCH/DELETE with no auth in the chain is a critical finding.
2. **All external input is validated** (schema or explicit guards per the project): params, query, body, headers, files — before it reaches business logic or a query.
3. **Parameterized queries only** — string interpolation/concatenation of any variable into SQL/NoSQL is a critical finding.
4. **Error responses never leak internals**: stack traces, driver errors, or config go to logs, not clients; error mapping follows the project's middleware/handler.

## Review rules

- Middleware ordering matches intent: auth before handlers, body parsers before routes that need them, rate limiting on public surfaces — flag new routes registered before the auth/correlation middleware.
- Bound the expensive: pagination/limits on list endpoints, upload size/type checks, timeouts on outbound calls the handler awaits — unbounded work on a public route is a finding.
- Transactions for multi-step writes per the common API & data integrity pack; partial writes on error paths are findings.
- Idempotency on retryable operations (webhooks, payment endpoints) per the project's mechanism.
- CORS: explicit allow-lists, no `origin: true` with credentials; `Access-Control-Allow-Origin: *` on credentialed endpoints is critical.
- Cookies: `httpOnly`/`secure`/`sameSite` consistent with the project's auth design; new cookie without flags where siblings set them is a finding.
- Webhooks verify signatures before processing and respond fast, deferring work to queues where the project uses them.

## Anti-patterns to flag

```js
// BAD — mutation without auth, injection-shaped query
router.post("/transfer", async (req, res) => {
  await db.query(`UPDATE accounts SET balance = balance - ${req.body.amount} WHERE id = '${req.body.to}'`);
});

// BAD — leaks internals
res.status(500).json({ error: err.stack });

// BAD — unbounded scan
const users = await User.findAll(); // returned to a public route
```

## Preserve existing conventions

- Follow the project's router structure, validation library, and error middleware; do not introduce a parallel validation or logging mechanism.
