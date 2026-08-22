// src/app/api/webhook/route.ts
/**
 * GitHub webhook adapter — thin layer that validates, normalizes, and delegates.
 * All GitHub-specific logic lives in src/lib/providers/github.ts.
 * All review logic lives in src/lib/reviewer-core/ai-review.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { reportRun, checkProjectActive } from "@/lib/control-plane";
import {
  makeOctokit,
  renderComment,
  cleanupOldBotComments,
  postSummary,
  postReview,
  createCheckRun,
  updateCheckRun,
  postCommitComment,
  fetchPrDiff,
  fetchCommitDiff,
} from "@/lib/providers/github";
import { executeReview, loadRules } from "@/lib/reviewer-core/ai-review";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

function isAuthConfigured(): boolean {
  return process.env.NODE_ENV !== "production" || !!WEBHOOK_SECRET;
}

function verifySignature(rawBody: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return process.env.NODE_ENV !== "production";
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(rawBody).digest("hex")}`;
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function isBranchEnabled(branch: string): boolean {
  const env = process.env.ENABLED_BRANCHES || "main,development";
  return env.split(",").map((b) => b.trim()).filter(Boolean).includes(branch);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";

  if (!isAuthConfigured()) {
    return NextResponse.json({ message: "Webhook authentication not configured" }, { status: 401 });
  }
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Cannot parse body JSON" }, { status: 400 });
  }

  const event = req.headers.get("x-github-event");
  const startedAt = Date.now();

  if (event === "pull_request") return handlePullRequest(payload, startedAt);
  if (event === "push") return handlePush(payload, startedAt);
  return NextResponse.json({ message: "Event ignored" });
}

async function handlePullRequest(payload: any, startedAt: number) {
  const { action, pull_request, repository } = payload;
  if (!["opened", "synchronize", "reopened"].includes(action)) {
    return NextResponse.json({ message: "Action ignored" });
  }

  const isActive = await checkProjectActive();
  if (!isActive) {
    await reportRun({ eventType: `pull_request.${action}`, prNumber: pull_request.number, status: "skipped", errorMsg: "Project is inactive" });
    return NextResponse.json({ message: "Project inactive — review skipped" });
  }

  try {
    const octokit = makeOctokit();
    const owner = repository.owner.login;
    const repo = repository.name;
    const prNumber = pull_request.number;

    const diff = await fetchPrDiff(octokit, owner, repo, prNumber);
    const result = await executeReview({ diff, fakePr: pull_request, renderComment });

    await postSummary(octokit, owner, repo, prNumber, result.summaryMd);
    try { await cleanupOldBotComments(octokit, owner, repo, prNumber); } catch (e: any) { console.warn(`[review] cleanup failed: ${e.message}`); }
    await postReview(octokit, owner, repo, prNumber, pull_request.head.sha, result.comments);

    await reportRun({ eventType: `pull_request.${action}`, prNumber, verdict: result.verdict, findings: result.allFindings.length, durationMs: Date.now() - startedAt, status: "success" });
    return NextResponse.json({ message: "Review posted", scanner: result.scannerFindings.length, ai: result.aiResult.findings?.length || 0, verdict: result.verdict });
  } catch (err: any) {
    await reportRun({ eventType: `pull_request.${action}`, prNumber: payload.pull_request?.number ?? null, durationMs: Date.now() - startedAt, status: "failed", errorMsg: String(err.message || err).slice(0, 2000) });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

async function handlePush(payload: any, startedAt: number) {
  const { ref, after: headSha, repository } = payload;
  const branchName = ref.replace("refs/heads/", "");

  if (!isBranchEnabled(branchName)) {
    await reportRun({ eventType: "push", status: "skipped", errorMsg: `Branch ${branchName} not enabled` });
    return NextResponse.json({ message: `Branch ${branchName} not enabled` });
  }

  const isActive = await checkProjectActive();
  if (!isActive) {
    await reportRun({ eventType: "push", status: "skipped", errorMsg: "Project is inactive" });
    return NextResponse.json({ message: "Project inactive — review skipped" });
  }

  try {
    const octokit = makeOctokit();
    const owner = repository.owner.login;
    const repo = repository.name;
    const checkRunId = await createCheckRun(octokit, owner, repo, headSha);

    try {
      const diff = await fetchCommitDiff(octokit, owner, repo, headSha);
      const fakePr = { title: `Push to ${branchName}`, user: { login: payload.pusher?.name || "unknown" }, body: payload.commits?.map((c: any) => `- ${c.message}`).join("\n") || "" };
      const limitedDiff = diff.length > 50000 ? diff.slice(0, 50000) + "\n\n[...truncated...]" : diff;

      const result = await executeReview({ diff: limitedDiff, fakePr, renderComment });

      for (const c of result.allFindings.filter((f) => f.file && !f.file.startsWith("("))) {
        await postCommitComment(octokit, owner, repo, headSha, c.file, c.line, renderComment(c));
      }

      const conclusion = result.verdict === "request_changes" ? "failure" : "success";
      await updateCheckRun(octokit, owner, repo, checkRunId, conclusion, {
        title: conclusion === "failure" ? `🛑 ${result.allFindings.length} issue(s) found` : "✅ No blocking issues",
        summary: result.summaryMd,
        text: result.allFindings.map((f) => `**${f.severity.toUpperCase()}** — ${f.file}:${f.line} — ${f.title}`).join("\n\n") || "No findings.",
      });

      await reportRun({ eventType: "push", verdict: result.verdict, findings: result.allFindings.length, durationMs: Date.now() - startedAt, status: "success" });
      return NextResponse.json({ message: "Commit reviewed", findings: result.allFindings.length, conclusion });
    } catch (innerErr: any) {
      await updateCheckRun(octokit, owner, repo, checkRunId, "neutral", { title: "Review could not complete", summary: innerErr.message, text: "The AI reviewer encountered an error." });
      throw innerErr;
    }
  } catch (err: any) {
    await reportRun({ eventType: "push", durationMs: Date.now() - startedAt, status: "failed", errorMsg: String(err.message || err).slice(0, 2000) });
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
