# Next.js Review Rules

Apply when the pull request touches Next.js code: `next.config.js`/`next.config.ts`, `app/` or `pages/` directories, `package.json` with `next`.

1. Prefer Server Components by default — add `"use client"` only when interactivity is genuinely needed.
2. No data fetching in `useEffect` on the client — use Server Components, route handlers, or a data layer (SWR/TanStack Query).
3. Data mutations must run through server actions or API route handlers; never expose service keys to the client.
4. Secrets: only `NEXT_PUBLIC_*` variables may reach the browser; everything else must stay server-side.
5. All images use `next/image` with `alt` text; raster images should set priority/size correctly.
6. Route handlers and server code must validate input and enforce auth — server routes are public endpoints.
7. Metadata: new pages export proper `metadata` / `generateMetadata` (title, description).
8. Handle loading (`loading.tsx` / Suspense) and error (`error.tsx`) boundaries for new route segments.
9. Client components must not import server-only modules; watch for `"use client"` files importing `fs`, secrets, or DB clients.
10. Dynamic routes: validate params; prefer type-safe params in the App Router.
11. Avoid `"use client"` waterfalls — pass server-fetched data down as props.
12. Test: unit tests for logic, integration tests for route handlers, E2E for critical flows.

Severity guide:
- **critical**: secrets exposed to client bundles, unauthenticated mutating route handlers, XSS via `dangerouslySetInnerHTML`.
- **high**: wrong server/client boundary, missing error/loading boundaries, `useEffect` data fetching, missing `alt`/image sizing.
- **medium**: missing metadata, missing tests, prop drilling, unnecessary client components.
- **low**: readability, formatting, minor optimizations.
