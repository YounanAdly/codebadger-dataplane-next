---
description: "Use when a Next.js change fetches, mutates, or caches data: route handlers, server actions, or client fetching. Enforces validated, authenticated, cache-aware data flow."
applyTo: "**/app/**,**/pages/**,**/src/app/**,**/src/pages/**,**/lib/**,**/server/**"
---

# Next.js Data, Actions & Caching

## Scope

Applies to route handlers (`app/api/**`, `pages/api/**`), server actions, and data access used by routes.

## Hard rules

1. **Route handlers are public endpoints**: every mutating handler authenticates and authorizes (or is explicitly documented as public) — a POST/PATCH/DELETE handler with no auth check before state changes is a critical finding.
2. **Request input is validated** (zod/valibot/manual guards per the project) before use — params, query, and body; malformed input returns a 4xx, never a 500 or a DB error.
3. **Client fetches never call services that require server secrets**; data mutations run through server actions or route handlers, never by constructing internal API URLs in client components.

## Review rules

- Mutations use server actions or `POST` route handlers with CSRF-consistent semantics per the project; server actions that change state validate auth *inside* the action (an auth check in the page is not enforcement).
- Caching: `fetch` cache options / `revalidate` choices match the data's freshness needs — user-specific or mutable data fetched with long/implicit caching (or cached at the CDN) is a finding; `cookies()`/`headers()` reads make routes dynamic intentionally.
- Server actions revalidate affected paths (`revalidatePath`/`revalidateTag`) so the UI does not serve stale data after a mutation — where the project uses cache primitives.
- Errors: handlers return safe, consistent error bodies — no stack traces or driver messages to clients; unexpected errors are logged server-side.
- Non-idempotent mutations (orders, payments) guard duplicate submits (idempotency key or the project's mechanism) — see the common API & data integrity pack.
- Pagination/limits: list handlers bound query size; unbounded `findMany()`-style handlers are findings.

## Anti-patterns to flag

```ts
// BAD — mutating handler with zero auth
export async function POST(req: Request) {
  await db.order.delete({ where: { id: (await req.json()).id } });
  return Response.json({ ok: true });
}

// BAD — user-specific data cached forever
fetch(`${API}/me`, { cache: "force-cache" });

// BAD — internal error leaks
catch (e) { return Response.json({ error: (e as Error).stack }); }
```

## Preserve existing conventions

- Follow the project's data layer (ORM, fetch wrapper, action library) — do not introduce a parallel mechanism; respect its existing cache defaults before flagging caching choices.
