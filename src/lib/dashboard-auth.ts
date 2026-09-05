// src/lib/dashboard-auth.ts
//
// Access control for the Data Plane dashboard.
//
// The dashboard used to be reachable by anyone who knew (or guessed) the
// deployment URL. Entry is now a signed, expiring link minted by the Control
// Plane (GET /api/projects/[id]/dashboard) after it authenticated the user
// and authorized them on the project. The signature is an HMAC of the DB
// project id + expiry, keyed with the project's WEBHOOK_SECRET — the same
// secret already provisioned into this deployment's env — so a link minted
// for one project can never open another's dashboard.
//
// On the first hop we hand out our own short-lived signed cookie so
// in-dashboard navigation (tabs, PR pages) works without signing every URL.
//
// Implemented with Web Crypto only, so the same helpers run in the proxy
// (edge runtime) and in server components (node runtime).

export const DASHBOARD_COOKIE = "cb_dp_access";

// Signed links are minted on click and consumed immediately by the redirect;
// two minutes covers slow networks without making a leaked URL a credential.
export const LINK_TTL_SECONDS = 120;
// After the first open the browser session stays valid for half a day.
export const COOKIE_TTL_SECONDS = 12 * 60 * 60;

export function dashboardAuthConfigured(): boolean {
  return !!(process.env.PROJECT_ID && process.env.WEBHOOK_SECRET);
}

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  return Array.from(new Uint8Array(mac), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

/** Constant-time compare — Web Crypto has no timingSafeEqual. */
function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** `sig` must be the HMAC of `${pid}:${exp}` with the webhook secret. */
async function verifyLinkSignature(
  pid: string,
  exp: string,
  sig: string
): Promise<boolean> {
  const projectId = process.env.PROJECT_ID;
  const secret = process.env.WEBHOOK_SECRET;
  if (!projectId || !secret || !pid || !exp || !sig) return false;
  if (pid !== projectId) return false;
  const expSeconds = Number(exp);
  if (!Number.isInteger(expSeconds)) return false;
  if (expSeconds * 1000 < Date.now()) return false;
  const expected = await hmacHex(`${pid}:${exp}`, secret);
  return safeEqual(expected, sig.toLowerCase());
}

/** Mint the signed-link query params the Control Plane expects to receive. */
export interface DashboardLinkParams {
  pid?: string;
  exp?: string;
  sig?: string;
}

export async function verifyDashboardLinkParams(
  params: DashboardLinkParams
): Promise<boolean> {
  return verifyLinkSignature(params.pid ?? "", params.exp ?? "", params.sig ?? "");
}

/**
 * The session cookie is signed over a distinct payload (`cookie:${exp}`), so a
 * link signature can never be replayed as a cookie value or vice versa.
 */
export async function dashboardCookieValue(): Promise<string> {
  const exp = String(Math.floor(Date.now() / 1000) + COOKIE_TTL_SECONDS);
  const sig = await hmacHex(`cookie:${exp}`, process.env.WEBHOOK_SECRET || "");
  return `${exp}.${sig}`;
}

export async function verifyDashboardCookie(
  value: string | undefined
): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || !value) return false;
  const dot = value.indexOf(".");
  if (dot <= 0) return false;
  const exp = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expSeconds = Number(exp);
  if (!Number.isInteger(expSeconds) || expSeconds * 1000 < Date.now()) {
    return false;
  }
  const expected = await hmacHex(`cookie:${exp}`, secret);
  return safeEqual(expected, sig.toLowerCase());
}

/**
 * Single gate shared by the proxy and the pages themselves (defense in
 * depth): a request may proceed either with a fresh signed link or with a
 * still-valid session cookie. When the deployment has no PROJECT_ID /
 * WEBHOOK_SECRET (local dev only) access fails open outside production.
 */
export async function verifyDashboardAccess(
  params: DashboardLinkParams,
  cookieValue: string | undefined
): Promise<boolean> {
  if (!dashboardAuthConfigured()) {
    return process.env.NODE_ENV !== "production";
  }
  if (await verifyDashboardLinkParams(params)) return true;
  return verifyDashboardCookie(cookieValue);
}
