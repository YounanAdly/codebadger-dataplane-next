---
description: "Use when a Next.js change adds routes, components, or changes the server/client boundary. Enforces App/Pages Router correctness with the project's router version."
applyTo: "**/app/**,**/pages/**,**/src/app/**,**/src/pages/**"
---

# Next.js Rendering & Boundaries

## Scope

Applies to route files and components under `app/` or `pages/`. Data flow has its own instruction file.

## Hard rules

1. **Server-first boundary**: `"use client"` only on components that genuinely need interactivity — hooks, browser events, or browser-only APIs. A client component that only renders markup from props is a finding (it drags its subtree into the bundle and off the server).
2. **Server Components never import client-only modules**: `fs`, DB clients, secret env access, or server-only packages reachable from a `"use client"` module are critical findings — and vice versa, client components must not import server-only code.
3. **Secrets stay server-side**: only `NEXT_PUBLIC_*` variables may be read in client code; any other `process.env.*` read below a `"use client"` boundary is a critical finding.
4. **Dynamic route params are validated/typed** — malformed params degrade to `notFound()`/redirect, never crash rendering.

## Review rules

- New route segments have `loading`/Suspense and `error` boundaries consistent with the project's existing segments.
- Metadata: new pages export `metadata`/`generateMetadata` (or Pages-Router head management) — flag missing titles/descriptions where every sibling page sets them.
- `params`/`searchParams` are awaited in async server components (Next 15+); synchronous access on the old API is fine — follow the project's Next version, do not demand upgrade-specific APIs.
- Client components receive data as props from the server where the project does that — flag prop-shaped fetch waterfalls inside client components.
- `next/image` for raster images with `alt`; `priority` only on real LCP images; `next/link` instead of raw `<a>` for internal navigation.
- Route handlers/server actions enforce auth + validation themselves (see the data pack); layout/auth wrappers are the project's pattern — do not assume a wrapper secures a new route.
- Hydration mismatches: browser-only values (`window`, `Date.now()`, `Math.random()`) rendered in server-rendered markup without guards/suppression are findings.

## Anti-patterns to flag

```tsx
// BAD — whole tree becomes a bundle for one click handler
"use client";
export default function Page() { return <ServerDataList />; }

// BAD — secret reaches the client bundle
"use client";
const dbUrl = process.env.DATABASE_URL;

// BAD — browser value rendered on the server
export default function Page() { return <span>{window.innerWidth}</span>; }
```

## Preserve existing conventions

- Respect the project's router (App vs Pages) — do not suggest migrating routers in a feature PR.
- Mixed RSC-era patterns (older `getServerSideProps` next to `app/`) are reviewed as they are; flag only inconsistencies the change itself introduces.
