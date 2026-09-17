// src/proxy.ts
//
// Gates every /dashboard route. Entry is a signed, expiring link minted by
// the Control Plane (see src/lib/dashboard-auth.ts); the first request with
// a valid link renders directly (rewrite in place) and also sets a signed
// cookie so navigation inside the dashboard doesn't need signed URLs.
// Everything else is denied with the access-denied page.

import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_TTL_SECONDS,
  DASHBOARD_COOKIE,
  dashboardCookieValue,
  verifyDashboardCookie,
  verifyDashboardLinkParams,
} from "@/lib/dashboard-auth";

// Marks the in-place rewrite of a valid signed link so the middleware re-run
// on the rewrite target lets it through instead of handling "sig" again
// (which would loop). Header names with a leading x- stay request-private.
const ENTRY_MARKER = "x-cb-dashboard-link-entry";

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Rewrite target for denials — must stay reachable through this proxy.
  if (pathname.startsWith("/dashboard/access-denied")) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(DASHBOARD_COOKIE)?.value;
  const linkOk = await verifyDashboardLinkParams({
    pid: searchParams.get("pid") ?? undefined,
    exp: searchParams.get("exp") ?? undefined,
    sig: searchParams.get("sig") ?? undefined,
  });
  const cookieOk = await verifyDashboardCookie(cookieValue);
  if (!linkOk && !cookieOk) {
    // no-store is essential: a cacheable 401 here poisons the edge cache for
    // /dashboard itself (the rewrite's URL), locking out every future visit —
    // including valid signed-link entries — until the next redeploy.
    return NextResponse.rewrite(
      new URL("/dashboard/access-denied", request.url),
      { status: 401, headers: { "cache-control": "no-store" } }
    );
  }

  // Valid signed link: render the dashboard in THIS request (rewrite to the
  // same URL) instead of redirecting. A 307 here forced a second browser
  // round-trip that had to carry the freshly-set cookie — environments that
  // don't replay it (some browsers/configurations) landed on access-denied
  // even though the link was perfectly valid. Rewriting keeps one request,
  // one response; the cookie is still attached for in-dashboard navigation.
  // The link params stay in the address bar for the 2-minute link TTL — the
  // page itself re-verifies them, and they expire too fast to be bookmarked
  // as a credential.
  if (linkOk && searchParams.has("sig") && !request.headers.get(ENTRY_MARKER)) {
    const headers = new Headers(request.headers);
    headers.set(ENTRY_MARKER, "1");
    const response = NextResponse.rewrite(request.nextUrl, {
      request: { headers },
    });
    response.cookies.set(DASHBOARD_COOKIE, await dashboardCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_TTL_SECONDS,
    });
    // The rendered dashboard is per-user (signed link / cookie) — never let
    // the edge or the browser cache it.
    response.headers.set("cache-control", "private, no-store");
    return response;
  }

  const passThrough = NextResponse.next();
  passThrough.headers.set("cache-control", "private, no-store");
  return passThrough;
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
