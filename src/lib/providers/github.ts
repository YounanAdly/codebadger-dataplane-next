// src/lib/providers/github.ts
/**
 * GitHub-specific provider adapter.
 * Handles all GitHub API interactions: fetching diffs, posting reviews,
 * managing comments, and check runs.
 */
import { Octokit } from "@octokit/rest";
import {
  BOT_NAME,
  SUMMARY_MARKER,
  LEGACY_SUMMARY_MARKER,
  FINGERPRINT_REGEX,
  isValidSuggestion,
} from "@/lib/branding";
import { fingerprintOf } from "@/lib/reviewer-core/review-runner";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

export function makeOctokit(): Octokit {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: GITHUB_TOKEN });
}

// ── Bot comment detection ──

function isBotInlineComment(body?: string): boolean {
  if (!body) return false;
  return FINGERPRINT_REGEX.test(body) || body.includes(`AI reviewer — ${BOT_NAME}`);
}

// ── Comment rendering ──

export function renderComment(f: any): string {
  const icons: Record<string, string> = {
    critical: "🛑",
    high: "⚠️",
    medium: "🟡",
    low: "🔵",
    info: "ℹ️",
  };
  const parts = [
    `${icons[f.severity] || "•"} **${(f.severity || "info").toUpperCase()} · ${
      f.category || "rule"
    }** — ${f.title}`,
    "",
    f.explanation,
  ];
  if (f.ruleRef) parts.push("", `📖 _${f.ruleRef}_`);
  if (f.suggestion && isValidSuggestion(f.suggestion, f.file)) {
    parts.push("", "```suggestion", f.suggestion, "```");
  }
  parts.push("", `🦡 _AI reviewer — ${BOT_NAME}_`);
  parts.push(`<!-- codebadger-ai-review-fp:${fingerprintOf(f)} -->`);
  return parts.join("\n");
}

// ── Cleanup old bot comments (replace mode) ──

export async function cleanupOldBotComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<void> {
  const mine: any[] = [];
  let page = 1;
  while (page <= 20) {
    const { data: comments } = await octokit.rest.pulls.listReviewComments({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
      page,
    });
    if (!comments.length) break;
    for (const c of comments) {
      if (isBotInlineComment(c.body)) mine.push(c);
    }
    if (comments.length < 100) break;
    page++;
  }

  let deleted = 0;
  for (const c of mine) {
    try {
      await octokit.rest.pulls.deleteReviewComment({ owner, repo, comment_id: c.id });
      deleted++;
    } catch (e: any) {
      console.warn(`[review] could not delete old comment ${c.id}: ${e.message}`);
    }
  }
  if (deleted) console.log(`[review] removed ${deleted} old inline comment(s) before re-posting`);
}

// ── Post/update summary comment ──

export async function postSummary(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  markdown: string
): Promise<void> {
  const body = `${SUMMARY_MARKER}\n${markdown}`;
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const mine = comments.find((c: any) => {
    const text = c.body || "";
    return text.includes(SUMMARY_MARKER) || text.includes(LEGACY_SUMMARY_MARKER);
  });
  if (mine) {
    await octokit.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
  } else {
    await octokit.rest.issues.createComment({ owner, repo, issue_number: prNumber, body });
  }
}

// ── Post inline review ──

export async function postReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  headSha: string,
  comments: Array<{ file: string; line: number; endLine?: number | null; body: string }>
): Promise<void> {
  if (comments.length === 0) {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      event: "COMMENT",
      body: `${BOT_NAME}: no inline findings.`,
    });
    return;
  }

  const payload = {
    commit_id: headSha,
    event: "COMMENT" as const,
    comments: comments.map((c) => {
      const base = { path: c.file, body: c.body, side: "RIGHT" as const };
      if (c.endLine && c.endLine > c.line)
        return {
          ...base,
          start_line: c.line,
          start_side: "RIGHT" as const,
          line: c.endLine,
        };
      return { ...base, line: c.line };
    }),
  };

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      ...payload,
    });
  } catch (err: any) {
    console.warn("[review] bulk failed, falling back:", err.message);
    for (const c of payload.comments) {
      try {
        await octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: prNumber,
          commit_id: headSha,
          event: "COMMENT",
          comments: [c],
        });
      } catch {}
    }
  }
}

// ── Check runs (for push events) ──

export async function createCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
  name = BOT_NAME
): Promise<number> {
  const { data } = await octokit.rest.checks.create({
    owner,
    repo,
    name,
    head_sha: headSha,
    status: "in_progress",
    started_at: new Date().toISOString(),
  });
  return data.id;
}

export async function updateCheckRun(
  octokit: Octokit,
  owner: string,
  repo: string,
  checkRunId: number,
  conclusion: "success" | "failure" | "neutral" | "cancelled" | "timed_out" | "action_required" | "skipped" | "stale",
  output: { title: string; summary: string; text: string }
): Promise<void> {
  await octokit.rest.checks.update({
    owner,
    repo,
    check_run_id: checkRunId,
    status: "completed",
    conclusion,
    completed_at: new Date().toISOString(),
    output,
  });
}

// ── Commit comments (for push event inline findings) ──

export async function postCommitComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  sha: string,
  path: string,
  line: number,
  body: string
): Promise<void> {
  try {
    await octokit.rest.repos.createCommitComment({
      owner,
      repo,
      commit_sha: sha,
      path,
      line,
      body,
    });
  } catch (e: any) {
    console.warn(`[commit-comment] skipped ${path}:${line}:`, e.message);
  }
}

// ── Fetch PR diff ──

export async function fetchPrDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
    mediaType: { format: "diff" },
  });
  return typeof data === "string" ? data : "";
}

// ── Fetch commit diff (for push events) ──

export async function fetchCommitDiff(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string
): Promise<string> {
  const { data } = await octokit.rest.repos.compareCommits({
    owner,
    repo,
    base: `${headSha}~1`,
    head: headSha,
    mediaType: { format: "diff" },
  });
  return typeof data === "string" ? data : "";
}
