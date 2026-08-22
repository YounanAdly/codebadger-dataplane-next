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
