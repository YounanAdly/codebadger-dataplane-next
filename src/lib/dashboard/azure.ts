// src/lib/dashboard/azure.ts
//
// Azure DevOps data provider for the dashboard — the ADO counterpart of the
// GitHub octokit calls the dashboard pages make. All calls use the same
// fresh Entra Bearer token (legacy PAT fallback) the review runner uses,
// resolved through the Control Plane credentials endpoint.

import { getAzureDevOpsToken } from "@/lib/control-plane";
import {
  SUMMARY_MARKER,
  LEGACY_SUMMARY_MARKER,
  FINGERPRINT_REGEX,
} from "@/lib/branding";

const API_VERSION = "7.1-preview.1";

export interface AzureDashboardContext {
  authHeader: string;
  org: string;
  project: string;
  repoName: string;
}

/** Resolve the ADO context for this deployment, or null when not Azure-configured. */
export async function getAzureDashboardContext(): Promise<AzureDashboardContext | null> {
  const creds = await getAzureDevOpsToken();
  if (!creds) return null;
  const project =
    creds.project ||
    process.env.SYSTEM_TEAMPROJECT ||
    "";
  const repoName =
    creds.repositoryName ||
    process.env.BUILD_REPOSITORY_NAME ||
    "";
  if (!project || !repoName) return null;
  return {
    authHeader: creds.authHeader,
    org: creds.organization,
    project,
    repoName,
  };
}

async function ado<T = any>(
  ctx: AzureDashboardContext,
  path: string,
  init: any = {}
): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://dev.azure.com/${encodeURIComponent(ctx.org)}/${encodeURIComponent(
    ctx.project
  )}/_apis/git/repositories/${encodeURIComponent(ctx.repoName)}${path}${sep}api-version=${API_VERSION}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: ctx.authHeader,
      "user-agent": "CodeBadger-Dataplane-Dashboard",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure ${init.method || "GET"} ${path} → ${res.status}: ${err.slice(0, 300)}`);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export interface AzurePrRow {
  id: number;
  title: string;
  author: string;
  avatar: string;
  sourceBranch: string;
  targetBranch: string;
  state: string; // active | completed | abandoned
  updatedAt: string;
  createdByBot: boolean;
  verdict: string; // success | failure | comment | pending
  findings: number;
  reviewDate: string;
}

function verdictFromBody(body: string): string {
  if (body.includes("Changes required")) return "failure";
  if (body.includes("Approve")) return "success";
  if (body.includes("Findings")) return "comment";
  return "pending";
}

function findingsCount(body: string): number {
  const m = body.match(
    /🛑 (\d+) critical|⚠️ (\d+) high|🟡 (\d+) medium|🔵 (\d+) low|ℹ️ (\d+)/g
  );
  if (!m) return 0;
  return m.reduce((s: number, x: string) => {
    const n = parseInt(x.replace(/[^0-9]/g, ""), 10);
    return s + (isNaN(n) ? 0 : n);
  }, 0);
}

function hasBotMarker(body: string): boolean {
  return body.includes(SUMMARY_MARKER) || body.includes(LEGACY_SUMMARY_MARKER);
}

/** Recent PRs with CodeBadger review verdicts (threads summary comment). */
export async function listAzurePullRequests(
  ctx: AzureDashboardContext,
  limit = 25
): Promise<AzurePrRow[]> {
  const data = await ado(ctx, `/pullrequests?searchCriteria.status=all&$top=${limit}`);
  const prs: any[] = data.value || [];

  const rows: AzurePrRow[] = [];
  for (const pr of prs) {
    let verdict = "pending";
    let count = 0;
    let reviewDate = "";
    let createdByBot = false;
    try {
      const threads = await ado(ctx, `/pullrequests/${pr.pullRequestId}/threads`);
      for (const t of threads.value || []) {
        const first = (t.comments || [])[0];
        if (!first) continue;
        const text = first.content || "";
        if (hasBotMarker(text)) {
          createdByBot = true;
          verdict = verdictFromBody(text);
          count = findingsCount(text);
          reviewDate = first.publishedDate || "";
          break;
        }
      }
    } catch {
      /* threads are cosmetic — skip on failure */
    }
    rows.push({
      id: pr.pullRequestId,
      title: pr.title || "",
      author: pr.createdBy?.displayName || pr.createdBy?.uniqueName || "unknown",
      avatar: "",
      sourceBranch: (pr.sourceRefName || "").replace("refs/heads/", ""),
      targetBranch: (pr.targetRefName || "").replace("refs/heads/", ""),
      state: pr.status || "unknown",
      updatedAt: pr.closedDate || pr.creationDate || "",
      createdByBot,
      verdict,
      findings: count,
      reviewDate,
    });
  }
  return rows;
}

export interface AzureFinding {
  severity: string;
  title: string;
  explanation: string;
  suggestion: string | null;
  path: string;
  line: number;
}

export interface AzurePrDetail {
  id: number;
  title: string;
  author: string;
  sourceBranch: string;
  targetBranch: string;
  state: string;
  creationDate: string;
  webUrl: string;
  summaryBody: string | null;
  findings: AzureFinding[];
}

/** One PR + its CodeBadger summary comment and inline findings. */
export async function getAzurePullRequestDetail(
  ctx: AzureDashboardContext,
  prId: number
): Promise<AzurePrDetail | null> {
  let pr: any;
  try {
    pr = await ado(ctx, `/pullrequests/${prId}`);
  } catch {
    return null;
  }
  const webUrl = `https://dev.azure.com/${encodeURIComponent(ctx.org)}/${encodeURIComponent(
    ctx.project
  )}/_git/${encodeURIComponent(ctx.repoName)}/pullrequest/${prId}`;

  let summaryBody: string | null = null;
  const findings: AzureFinding[] = [];
  try {
    const threads = await ado(ctx, `/pullrequests/${prId}/threads`);
    for (const t of threads.value || []) {
      for (const c of t.comments || []) {
        const body = c.content || "";
        if (hasBotMarker(body) && !summaryBody) {
          summaryBody = body;
          continue;
        }
        const fp = FINGERPRINT_REGEX.exec(body);
        if (!fp) continue;
        const sevChar = body.match(/(🛑|⚠️|🟡|🔵|ℹ️)/)?.[1];
        const severity =
          sevChar === "🛑" ? "critical" : sevChar === "⚠️" ? "high" : sevChar === "🟡" ? "medium" : sevChar === "🔵" ? "low" : "info";
        const title = body.match(/—\s*(.+?)(?:\n|$)/)?.[1]?.trim() || "Finding";
        let explanation = body
          .replace(/[🛑⚠️🟡🔵ℹ️]/g, "")
          .replace(/—.*/, "")
          .replace(/\*\*(?:CRITICAL|HIGH|MEDIUM|LOW|INFO)\*\*/gi, "")
          .replace(/📖 _.+?_/g, "")
          .replace(/🦡 _.+?_/g, "")
          .replace(/<!--.*?-->/g, "")
          .replace(/\n{2,}/g, "\n")
          .trim();
        explanation = explanation.split("```suggestion")[0].trim();
        const suggestion = body.match(/```suggestion\s*([\s\S]*?)```/)?.[1]?.trim() || null;
        findings.push({
          severity,
          title,
          explanation: explanation || title,
          suggestion,
          path: (t.threadContext?.filePath || "").replace(/^\//, ""),
          line: t.threadContext?.rightFileStart?.line || 0,
        });
      }
    }
  } catch {
    /* threads are cosmetic */
  }

  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  return {
    id: pr.pullRequestId,
    title: pr.title || "",
    author: pr.createdBy?.displayName || pr.createdBy?.uniqueName || "unknown",
    sourceBranch: (pr.sourceRefName || "").replace("refs/heads/", ""),
    targetBranch: (pr.targetRefName || "").replace("refs/heads/", ""),
    state: pr.status || "unknown",
    creationDate: pr.creationDate || "",
    webUrl,
    summaryBody,
    findings,
  };
}

export interface AzureBranchRow {
  name: string;
  aheadCount?: number;
  isDefault: boolean;
}

/** Branches of the repository (stats include ahead counts; default from repo). */
export async function listAzureBranches(
  ctx: AzureDashboardContext
): Promise<AzureBranchRow[]> {
  const repo = await ado(ctx, "");
  const defaultBranch = (repo.defaultBranch || "refs/heads/main").replace("refs/heads/", "");
  const data = await ado(ctx, `/stats/branches`);
  return (data.value || [])
    .map((b: any) => ({
      name: (b.name || "").replace("refs/heads/", ""),
      aheadCount: b.aheadCount,
      isDefault: (b.name || "").replace("refs/heads/", "") === defaultBranch,
    }))
    .filter((b: AzureBranchRow) => !!b.name)
    .sort((a: AzureBranchRow, b: AzureBranchRow) => a.name.localeCompare(b.name));
}

export interface AzureCommitRow {
  sha: string;
  message: string;
  author: string;
  date: string;
}

/** Recent commits on one branch (default when omitted). */
export async function listAzureCommits(
  ctx: AzureDashboardContext,
  branch?: string
): Promise<AzureCommitRow[]> {
  const q = branch ? `&searchCriteria.itemVersion.version=${encodeURIComponent(branch)}` : "";
  const data = await ado(ctx, `/commits?searchCriteria.itemVersion.versionType=branch&$top=30${q}`);
  return (data.value || []).map((c: any) => ({
    sha: c.commitId || "",
    message: (c.comment || "").split("\n")[0],
    author: c.author?.name || c.committer?.name || "unknown",
    date: c.author?.date || c.committer?.date || "",
  }));
}
