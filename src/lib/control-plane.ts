// src/lib/control-plane.ts

/**
 * الإبلاغ عن نتائج الـ review runs إلى الـ Control Plane.
 *
 * المتغيرات المطلوبة (توفرها المنصة تلقائياً عند الـ provisioning):
 * - PLATFORM_URL: رابط الـ control plane
 * - PROJECT_ID: معرف المشروع
 * - WEBHOOK_SECRET: سر المشروع — يُستخدم أيضاً لمصادقة البلاغ
 *
 * الفشل في الإبلاغ لا يعطل عملية الـ review نفسها أبداً.
 */

export interface ControlPlaneRunReport {
  eventType: string;
  prNumber?: number | null;
  verdict?: string | null;
  findings?: number;
  durationMs?: number | null;
  status: "success" | "failed" | "skipped";
  errorMsg?: string | null;
}

export function isControlPlaneReportingEnabled(): boolean {
  return !!(
    process.env.PLATFORM_URL &&
    process.env.PROJECT_ID &&
    process.env.WEBHOOK_SECRET
  );
}

/**
 * Check with the Control Plane whether this project is active.
 * Returns true if active, false if inactive, and true (fail-open) if the
 * check fails so we don't block reviews due to a transient network error.
 */
export async function checkProjectActive(): Promise<boolean> {
  const platformUrl = process.env.PLATFORM_URL;
  const projectId = process.env.PROJECT_ID;
  const secret = process.env.WEBHOOK_SECRET;

  if (!platformUrl || !projectId || !secret) return true; // fail-open if not configured

  try {
    const res = await fetch(
      `${platformUrl.replace(/\/$/, "")}/api/ingest/runs`,
      {
        method: "GET",
        headers: {
          "x-project-id": projectId,
          authorization: `Bearer ${secret}`,
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      return data.active !== false;
    }
    // If the check fails, fail-open so we don't block reviews
    return true;
  } catch {
    return true; // fail-open on network error
  }
}

export async function reportRun(report: ControlPlaneRunReport): Promise<void> {
  const platformUrl = process.env.PLATFORM_URL;
  const projectId = process.env.PROJECT_ID;
  const secret = process.env.WEBHOOK_SECRET;

  if (!platformUrl || !projectId || !secret) return;

  try {
    const res = await fetch(`${platformUrl.replace(/\/$/, "")}/api/ingest/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-project-id": projectId,
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        eventType: report.eventType,
        prNumber: report.prNumber ?? null,
        verdict: report.verdict ?? null,
        findings: report.findings ?? 0,
        durationMs: report.durationMs ?? null,
        status: report.status,
        errorMsg: report.errorMsg ?? null,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.error(
        `[control-plane] reportRun failed: ${res.status} ${await res.text().catch(() => "")}`
      );
    }
  } catch (error) {
    // لا نكسر مسار الـ review أبداً بسبب فشل الإبلاغ
    console.error("[control-plane] reportRun error:", error);
  }
}

// ── Fresh GitHub token from the Control Plane ──
//
// GitHub App user-to-server tokens expire (~8h). A snapshot stored in the
// GITHUB_TOKEN env var at webhook-creation time goes stale and every GitHub
// API call starts failing with 401 "Bad credentials" a day later. The
// Control Plane exposes POST /api/data-plane/credentials so a Data Plane can
// exchange PROJECT_ID + WEBHOOK_SECRET for a freshly-refreshed token.

const GITHUB_TOKEN_CACHE_TTL_MS = 10 * 60 * 1000; // tokens live ~8h; cache briefly
let cachedGithubToken: { token: string; fetchedAt: number } | null = null;
let inflightGithubToken: Promise<string | null> | null = null;

async function fetchGithubTokenFromControlPlane(): Promise<string | null> {
  const platformUrl = process.env.PLATFORM_URL;
  const projectId = process.env.PROJECT_ID;
  const secret = process.env.WEBHOOK_SECRET;
  if (!platformUrl || !projectId || !secret) return null;

  try {
    const res = await fetch(
      `${platformUrl.replace(/\/$/, "")}/api/data-plane/credentials`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, webhookSecret: secret }),
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) {
      // 409 github_not_connected = owner must reconnect; other statuses are
      // transient (429/5xx) — either way we fall back to the static token.
      console.error(`[control-plane] credentials request failed: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return typeof data.token === "string" && data.token ? data.token : null;
  } catch (error) {
    console.error("[control-plane] credentials request error:", error);
    return null;
  }
}

/**
 * GitHub access token for reviews. Prefers a freshly-refreshed token from
 * the Control Plane; falls back to the static GITHUB_TOKEN env for old
 * setups or when the Control Plane is unreachable. Never logs the token.
 */
export async function getGithubToken(): Promise<string | null> {
  if (
    cachedGithubToken &&
    Date.now() - cachedGithubToken.fetchedAt < GITHUB_TOKEN_CACHE_TTL_MS
  ) {
    return cachedGithubToken.token;
  }
  if (inflightGithubToken) return inflightGithubToken;

  inflightGithubToken = (async () => {
    const fresh = await fetchGithubTokenFromControlPlane();
    if (fresh) {
      cachedGithubToken = { token: fresh, fetchedAt: Date.now() };
      return fresh;
    }
    return process.env.GITHUB_TOKEN || null;
  })().finally(() => {
    inflightGithubToken = null;
  });

  return inflightGithubToken;
}
