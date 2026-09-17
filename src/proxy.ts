// src/proxy.ts
//
// Gates every /dashboard route. Entry is a signed, expiring link minted by
// the Control Plane (see src/lib/dashboard-auth.ts); on the first hop we set
// a short-lived signed cookie so navigation inside the dashboard doesn't need
// signed URLs. Everything else is denied with the access-denied page.

import { NextResponse, type NextRequest } from "next/server";
import {
  COOKIE_TTL_SECONDS,
  DASHBOARD_COOKIE,
  dashboardCookieValue,
  verifyDashboardCookie,
  verifyDashboardLinkParams,
} from "@/lib/dashboard-auth";

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

  // First hop with a signed link: strip pid/exp/sig from the address bar so
  // the signature can't be copied or bookmarked as a long-lived bearer token.
  // The redirect must not be edge-cacheable either — it carries Set-Cookie.
  if (searchParams.has("sig")) {
    const response = NextResponse.redirect(new URL(pathname, request.url), {
      headers: { "cache-control": "no-store" },
    });
    response.cookies.set(DASHBOARD_COOKIE, await dashboardCookieValue(), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_TTL_SECONDS,
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*"],
};
