import { executeReview } from "@/lib/reviewer-core/ai-review";
import { verifyLocalReviewSignature, normalizeLocalFindings } from "@/lib/local-review-auth";
import { isProjectRulePath, type ProjectRuleFile } from "@/lib/reviewer-core/project-rules";

export const runtime = "nodejs";
export const maxDuration = 300;

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return json({ error: "Body required." }, 400);
  let body: string;
  try {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1_100_000) { await reader.cancel(); return json({ error: "Payload too large." }, 413); }
      chunks.push(value);
    }
    body = Buffer.concat(chunks).toString("utf8");
  } finally { reader.releaseLock(); }
  if (!verifyLocalReviewSignature({ body, projectId: request.headers.get("x-project-id"), timestamp: request.headers.get("x-codebadger-timestamp"),
    signature: request.headers.get("x-codebadger-signature"), expectedProjectId: process.env.PROJECT_ID, secret: process.env.WEBHOOK_SECRET })) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const input = JSON.parse(body) as { diff: string; files: string[]; projectRules: ProjectRuleFile[]; branch: string; author: string };
    if (typeof input.diff !== "string" || !input.diff.trim() || Buffer.byteLength(input.diff) > 800_000 ||
      !Array.isArray(input.files) || !input.files.length || input.files.length > 40 || input.files.some((p) => typeof p !== "string") ||
      !Array.isArray(input.projectRules) || input.projectRules.length > 20 ||
      input.projectRules.some((r) => !r || typeof r.path !== "string" || !isProjectRulePath(r.path) || typeof r.content !== "string" || Buffer.byteLength(r.content) > 32_000) ||
      input.projectRules.reduce((n, r) => n + r.content.length, 0) > 30_000) return json({ error: "Invalid review payload." }, 400);
    // Reuse the PR pipeline without posting comments or fetching unpublished refs.
    const result = await executeReview({ diff: input.diff, fakePr: {
      title: `Local code review: ${String(input.branch).slice(0, 250)}`, user: { login: String(input.author).slice(0, 100) },
      body: "Review the supplied local Git changes before they are pushed. No pull request exists for this review.",
    }, projectRules: input.projectRules, renderComment: () => "" });
    const findings = normalizeLocalFindings(result.allFindings, input.files);
    return json({ summary: String(result.aiResult.summary || "").slice(0, 8000),
      verdict: findings.some((f) => f.severity === "critical" || f.severity === "high") ? "request_changes" : "comment", findings });
  } catch {
    return json({ error: "Local review failed. Check the configured AI provider." }, 502);
  }
}
