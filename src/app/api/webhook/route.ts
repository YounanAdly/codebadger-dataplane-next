import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Octokit } from "@octokit/rest";
import { scanDiff, parseUnifiedDiffFiles } from "@/lib/reviewer-core/rules-scanner";
import { reportRun } from "@/lib/control-plane";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

// Customer repos are accessed with the project owner's OAuth token (no GitHub App installation).
function makeOctokit() {
  if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set");
  return new Octokit({ auth: GITHUB_TOKEN });
}

function getEnabledBranches() {
  const env = process.env.ENABLED_BRANCHES || "main,development";
  return env
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

function isBranchEnabled(branch: string) {
  return getEnabledBranches().includes(branch);
}

/**
 * فشل مغلق (fail-closed): في الإنتاج يجب أن يكون WEBHOOK_SECRET مضبوطاً —
 * وإلا فالطلب مرفوض. (في التطوير المحلي نسمح بالتجربة بدون سر.)
 */
function isAuthConfigured() {
  return process.env.NODE_ENV !== "production" || !!WEBHOOK_SECRET;
}

function verifySignature(rawBody: string, signature: string) {
  if (!WEBHOOK_SECRET) return process.env.NODE_ENV !== "production";
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(rawBody).digest("hex")}`;
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function loadRules() {
  try {
    return readFileSync(join(process.cwd(), "rules.md"), "utf8");
  } catch {
    return "";
  }
}

async function runAIReview(rules: string, diff: string, pr: any) {
  const systemPrompt = `You are **Marafiq Reviewer**, a senior Angular 22 code-review agent.
Your ONLY job: read the PR diff and enforce the project's rulebook with surgical precision.
You are strict, aggressive, and specific. Never say "looks good" without justification.

## Severity guide
- **critical**: @Input/@Output decorators, *ngIf/*ngFor, NgModules, HttpClient in components, console.error/alert, hardcoded colors in SCSS, missing i18n parity.
- **high**: missing OnPush, missing @defer, missing aria-label on icon-only buttons, missing NgOptimizedImage priority.
- **medium**: naming/style violations, missing test spec, minor a11y improvements.
- **low**: readability/microopts, minor RTL concerns.

## Response format (STRICT JSON — no markdown fences outside)
{
  "summary": "Markdown, 3-8 sentences, high-signal only",
  "verdict": "approve" | "comment" | "request_changes",
  "findings": [
    {
      "file": "repo-relative path",
      "line": 1,
      "endLine": null,
      "severity": "critical" | "high" | "medium" | "low" | "info",
      "category": "rules" | "security" | "angular22" | "accessibility" | "i18n" | "scss" | "tests" | "performance" | "bug" | "style",
      "title": "Short imperative headline <80 chars",
      "explanation": "Why it violates a rule. Cite exact rule id.",
      "suggestion": "Exact replacement code (optional)",
      "ruleRef": "rules.md §1.5"
    }
  ]
}

## Rules
${rules.slice(0, 120000)}`;

  const userPrompt = `## PR metadata
- Title: ${pr.title}
- Author: ${pr.user?.login || "unknown"}
- Description: ${(pr.body || "").slice(0, 2000)}

## Diff (unified)
\`\`\`diff
${diff.slice(0, 150000)}
\`\`\`

Review every file against the rulebook. Line numbers refer to the RIGHT side (new file). Prefer high-signal findings only.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first)
      return JSON.parse(text.slice(first, last + 1));
    throw new Error("Invalid JSON from AI");
  }
}

function renderComment(f: any) {
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
  if (f.suggestion) parts.push("", "```suggestion", f.suggestion, "```");
  parts.push("", "🤖 _AI reviewer — Marafiq AI Review_");
  return parts.join("\n");
}

async function postSummary(octokit: any, owner: string, repo: string, prNumber: number, markdown: string) {
  const marker = "<!-- marafiq-ai-review-summary -->";
  const body = `${marker}\n${markdown}`;
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const mine = comments.find((c: any) => (c.body || "").startsWith(marker));
  if (mine) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: mine.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }
}

async function postReview(octokit: any, owner: string, repo: string, prNumber: number, headSha: string, comments: any[]) {
  if (comments.length === 0) {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: headSha,
      event: "COMMENT",
      body: "Marafiq AI Review: no inline findings.",
    });
    return;
  }
  const payload = {
    commit_id: headSha,
    event: "COMMENT",
    comments: comments.map((c) => {
      const base = { path: c.file, body: c.body, side: "RIGHT" };
      if (c.endLine && c.endLine > c.line)
        return {
          ...base,
          start_line: c.line,
          start_side: "RIGHT",
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

async function createCheckRun(
  octokit: any,
  owner: string,
  repo: string,
  headSha: string,
  name = "Marafiq AI Review"
) {
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

async function updateCheckRun(
  octokit: any,
  owner: string,
  repo: string,
  checkRunId: number,
  conclusion: string,
  output: any
) {
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

async function postCommitComment(octokit: any, owner: string, repo: string, sha: string, path: string, line: number, body: string) {
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

async function executeReview({
  octokit,
  owner,
  repo,
  headSha,
  diff,
  fakePr,
  checkRunId,
}: {
  octokit: any;
  owner: string;
  repo: string;
  headSha: string;
  diff: string;
  fakePr: any;
  checkRunId?: number;
}) {
  const rules = loadRules();
  const scannerFindings = scanDiff(parseUnifiedDiffFiles(diff));
  const aiResult = await runAIReview(rules, diff, fakePr);
  const allFindings = [...scannerFindings, ...(aiResult.findings || [])];

  const failSeverities = ["critical", "high"];
  const verdict = allFindings.some((f) => failSeverities.includes(f.severity))
    ? "request_changes"
    : "comment";

  const comments = allFindings
    .filter((f) => f.file && !f.file.startsWith("("))
    .map((f) => ({
      file: f.file,
      line: f.line,
      endLine: f.endLine,
      body: renderComment(f),
    }));

  const counts = allFindings.reduce((acc: Record<string, number>, f: any) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  const badge =
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(
        ([sev, n]) =>
          `${
            ({ critical: "🛑", high: "⚠️", medium: "🟡", low: "🔵", info: "ℹ️" } as Record<string, string>)[
              sev
            ]
          } ${n} ${sev}`
      )
      .join(" · ") || "✨ No findings.";

  const summaryMd = [
    `## 🤖 Marafiq AI Review`,
    "",
    ({
      approve: "✅ **Approve** — no blocking issues.",
      comment: "💬 **Comment** — please review the notes below.",
      request_changes:
        "🛑 **Changes required** — critical rule violations found.",
    } as Record<string, string>)[verdict],
    "",
    `**Findings**: ${badge}`,
    "",
    aiResult.summary || "_(no additional summary)_",
    "",
    "---",
    `<sub>Reviewed against private rulebook. AI: Gemini. Scanner: ${
      scannerFindings.length
    } · AI: ${aiResult.findings?.length || 0}</sub>`,
  ].join("\n");

  return {
    allFindings,
    comments,
    summaryMd,
    verdict,
    scannerFindings,
    aiResult,
  };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256") || "";

  if (!isAuthConfigured()) {
    console.error("[webhook] rejected: WEBHOOK_SECRET is not configured (production is fail-closed)");
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

  // ── Pull Request Event ──
  if (event === "pull_request") {
    const { action, pull_request, repository } = payload;
    if (!["opened", "synchronize", "reopened"].includes(action)) {
      return NextResponse.json({ message: "Action ignored" });
    }

    try {
      const octokit = makeOctokit();
      const owner = repository.owner.login;
      const repo = repository.name;
      const prNumber = pull_request.number;

      const [{ data: diff }, rules] = await Promise.all([
        octokit.rest.pulls.get({
          owner,
          repo,
          pull_number: prNumber,
          mediaType: { format: "diff" },
        }),
        Promise.resolve(loadRules()),
      ]);

      const result = await executeReview({
        octokit,
        owner,
        repo,
        headSha: pull_request.head.sha,
        diff: typeof diff === "string" ? diff : "",
        fakePr: pull_request,
      });

      await postSummary(octokit, owner, repo, prNumber, result.summaryMd);
      await postReview(
        octokit,
        owner,
        repo,
        prNumber,
        pull_request.head.sha,
        result.comments
      );

      await reportRun({
        eventType: `pull_request.${action}`,
        prNumber,
        verdict: result.verdict,
        findings: result.allFindings.length,
        durationMs: Date.now() - startedAt,
        status: "success",
      });

      return NextResponse.json({
        message: "Review posted",
        scanner: result.scannerFindings.length,
        ai: result.aiResult.findings?.length || 0,
        verdict: result.verdict,
      });
    } catch (err: any) {
      console.error("[reviewer] fatal:", err);
      await reportRun({
        eventType: `pull_request.${action}`,
        prNumber: payload.pull_request?.number ?? null,
        durationMs: Date.now() - startedAt,
        status: "failed",
        errorMsg: String(err.message || err).slice(0, 2000),
      });
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }

  // ── Push Event ──
  if (event === "push") {
    const { ref, after: headSha, repository } = payload;
    const branchName = ref.replace("refs/heads/", "");

    if (!isBranchEnabled(branchName)) {
      await reportRun({
        eventType: "push",
        status: "skipped",
        errorMsg: `Branch ${branchName} not enabled`,
      });
      return NextResponse.json({ message: `Branch ${branchName} not enabled` });
    }

    try {
      const octokit = makeOctokit();
      const owner = repository.owner.login;
      const repo = repository.name;

      const checkRunId = await createCheckRun(octokit, owner, repo, headSha);

      try {
        const { data: diffData } = await octokit.rest.repos.compareCommits({
          owner,
          repo,
          base: `${headSha}~1`,
          head: headSha,
          mediaType: { format: "diff" },
        });
        const diff = typeof diffData === "string" ? diffData : "";

        const fakePr = {
          title: `Push to ${branchName}`,
          user: { login: payload.pusher?.name || "unknown" },
          body: payload.commits?.map((c: any) => `- ${c.message}`).join("\n") || "",
        };

        const limitedDiff =
          diff.length > 50000
            ? diff.slice(0, 50000) + "\n\n[...truncated...]"
            : diff;

        const result = await executeReview({
          octokit,
          owner,
          repo,
          headSha,
          diff: limitedDiff,
          fakePr,
          checkRunId,
        });

        for (const c of result.allFindings.filter(
          (f) => f.file && !f.file.startsWith("(")
        )) {
          await postCommitComment(
            octokit,
            owner,
            repo,
            headSha,
            c.file,
            c.line,
            renderComment(c)
          );
        }

        const conclusion =
          result.verdict === "request_changes" ? "failure" : "success";
        await updateCheckRun(octokit, owner, repo, checkRunId, conclusion, {
          title:
            conclusion === "failure"
              ? `🛑 ${result.allFindings.length} issue(s) found`
              : "✅ No blocking issues",
          summary: result.summaryMd,
          text:
            result.allFindings
              .map(
                (f) =>
                  `**${f.severity.toUpperCase()}** — ${f.file}:${f.line} — ${
                    f.title
                  }`
              )
              .join("\n\n") || "No findings.",
        });

        await reportRun({
          eventType: "push",
          verdict: result.verdict,
          findings: result.allFindings.length,
          durationMs: Date.now() - startedAt,
          status: "success",
        });

        return NextResponse.json({
          message: "Commit reviewed",
          findings: result.allFindings.length,
          conclusion,
        });
      } catch (innerErr: any) {
        await updateCheckRun(octokit, owner, repo, checkRunId, "neutral", {
          title: "Review could not complete",
          summary: innerErr.message,
          text: "The AI reviewer encountered an error. This may be due to API rate limits or timeout.",
        });
        throw innerErr;
      }
    } catch (err: any) {
      console.error("[push] fatal:", err);
      await reportRun({
        eventType: "push",
        durationMs: Date.now() - startedAt,
        status: "failed",
        errorMsg: String(err.message || err).slice(0, 2000),
      });
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Event ignored" });
}