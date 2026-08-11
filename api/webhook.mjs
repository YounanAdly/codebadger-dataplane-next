import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

// ── CRITICAL: امنع Vercel من parse الـ body ──
export const config = {
  api: { bodyParser: false },
};

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Branches enabled for auto-review (comma-separated in env, fallback to main+development)
function getEnabledBranches() {
  const env = process.env.ENABLED_BRANCHES || "main,development";
  return env
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

function isBranchEnabled(branch) {
  return getEnabledBranches().includes(branch);
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function verifySignature(rawBody, signature) {
  const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
  const digest = `sha256=${hmac.update(rawBody).digest("hex")}`;
  return signature === digest;
}

function loadRules() {
  try {
    return readFileSync(join(process.cwd(), "rules.md"), "utf8");
  } catch {
    return "";
  }
}

function scanDiff(diffText) {
  const findings = [];
  const lines = diffText.split("\n");
  let currentFile = "";
  let newLineNo = 0;

  for (const line of lines) {
    if (line.startsWith("+++")) {
      currentFile = line.replace("+++ b/", "").trim();
      continue;
    }
    if (line.startsWith("@@")) {
      const m = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      newLineNo = m ? parseInt(m[1], 10) - 1 : 0;
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      newLineNo++;
      const content = line.slice(1);
      if (currentFile.endsWith(".ts")) {
        if (/\@Input\s*\(/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "angular22",
            title: "Use input() instead of @Input()",
            explanation: "rules.md §1.5 — Modern Angular 22 Patterns",
            ruleRef: "rules.md §1.5",
          });
        if (/\@Output\s*\(/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "angular22",
            title: "Use output() instead of @Output()",
            explanation: "rules.md §1.5",
            ruleRef: "rules.md §1.5",
          });
        if (/\@NgModule\s*\(/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "angular22",
            title: "No @NgModule — standalone only",
            explanation: "rules.md §1.5",
            ruleRef: "rules.md §1.5",
          });
        if (
          /inject\s*\(\s*HttpClient\s*\)/.test(content) &&
          currentFile.endsWith(".component.ts")
        )
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "rules",
            title: "HttpClient injected in component",
            explanation: "api-calls.instructions.md — use BaseCrudService",
            ruleRef: "api-calls.instructions.md",
          });
        if (/\bconsole\.error\s*\(/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "rules",
            title: "console.error() forbidden",
            explanation: "error-handling.instructions.md — use ToastService",
            ruleRef: "error-handling.instructions.md",
          });
        if (/constructor\s*\([^)]*private\s+\w+\s*:\s*\w+/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "angular22",
            title: "Constructor DI — use inject()",
            explanation: "rules.md §1.5",
            ruleRef: "rules.md §1.5",
          });
      }
      if (currentFile.endsWith(".html")) {
        if (/\*(ngIf|ngFor|ngSwitch)/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "angular22",
            title: "Use built-in control flow (@if/@for/@switch)",
            explanation: "rules.md §1.5",
            ruleRef: "rules.md §1.5",
          });
      }
      if (currentFile.endsWith(".scss")) {
        if (/#[0-9a-fA-F]{3,8}/.test(content) || /rgb\(|rgba\(/.test(content))
          findings.push({
            file: currentFile,
            line: newLineNo,
            severity: "critical",
            category: "scss",
            title: "Hardcoded color — use CSS variable",
            explanation: "styling-themes.instructions.md — use var(--color-*)",
            ruleRef: "styling-themes.instructions.md",
          });
      }
    } else if (!line.startsWith("-")) {
      newLineNo++;
    }
  }
  return findings;
}

async function runAIReview(rules, diff, pr) {
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

function renderComment(f) {
  const icons = {
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

async function postSummary(octokit, owner, repo, prNumber, markdown) {
  const marker = "<!-- marafiq-ai-review-summary -->";
  const body = `${marker}\n${markdown}`;
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  });
  const mine = comments.find((c) => (c.body || "").startsWith(marker));
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

async function postReview(octokit, owner, repo, prNumber, headSha, comments) {
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
  } catch (err) {
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

// ── Check Run helpers ──
async function createCheckRun(
  octokit,
  owner,
  repo,
  headSha,
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
  octokit,
  owner,
  repo,
  checkRunId,
  conclusion,
  output
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

async function postCommitComment(octokit, owner, repo, sha, path, line, body) {
  try {
    await octokit.rest.repos.createCommitComment({
      owner,
      repo,
      commit_sha: sha,
      path,
      line,
      body,
    });
  } catch (e) {
    console.warn(`[commit-comment] skipped ${path}:${line}:`, e.message);
  }
}

// ── Core Review Logic (shared between PR and Push) ──
async function executeReview({
  octokit,
  owner,
  repo,
  headSha,
  diff,
  fakePr,
  checkRunId,
}) {
  const rules = loadRules();
  const scannerFindings = scanDiff(diff);
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

  const counts = allFindings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  const badge =
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(
        ([sev, n]) =>
          `${
            { critical: "🛑", high: "⚠️", medium: "🟡", low: "🔵", info: "ℹ️" }[
              sev
            ]
          } ${n} ${sev}`
      )
      .join(" · ") || "✨ No findings.";

  const summaryMd = [
    `## 🤖 Marafiq AI Review`,
    "",
    {
      approve: "✅ **Approve** — no blocking issues.",
      comment: "💬 **Comment** — please review the notes below.",
      request_changes:
        "🛑 **Changes required** — critical rule violations found.",
    }[verdict],
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

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {
  // ── Manual Trigger Endpoint ──
  if (req.url?.startsWith("/api/trigger") && req.method === "POST") {
    let body;
    try {
      body = await getRawBody(req);
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { owner, repo, sha, branch } = body;
    if (!owner || !repo || !sha) {
      return res.status(400).json({ error: "Missing owner, repo, or sha" });
    }

    try {
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: { appId: APP_ID, privateKey: PRIVATE_KEY.replace(/\\n/g, "\n") },
      });
      const { data: installations } =
        await octokit.rest.apps.listInstallations();
      const installation = installations.find(
        (i) => i.account?.login?.toLowerCase() === owner.toLowerCase()
      );
      if (!installation)
        return res.status(404).json({ error: "App not installed" });

      const authOctokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: APP_ID,
          privateKey: PRIVATE_KEY.replace(/\\n/g, "\n"),
          installationId: installation.id,
        },
      });

      // Get diff for this commit
      const { data: commitData } = await authOctokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });
      const parentSha = commitData.parents?.[0]?.sha;

      let diff = "";
      if (parentSha) {
        const diffRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/compare/${parentSha}...${sha}`,
          {
            headers: {
              Authorization: `token ${(await authOctokit.auth()).token}`,
              Accept: "application/vnd.github.v3.diff",
            },
          }
        );
        diff = await diffRes.text();
      }

      const checkRunId = await createCheckRun(authOctokit, owner, repo, sha);

      const fakePr = {
        title: `Manual review on ${branch || "unknown"}`,
        user: { login: commitData.author?.login || "manual" },
        body: commitData.commit?.message || "Manual trigger",
      };

      const result = await executeReview({
        octokit: authOctokit,
        owner,
        repo,
        headSha: sha,
        diff,
        fakePr,
        checkRunId,
      });

      // Post commit comments
      for (const c of result.allFindings.filter(
        (f) => f.file && !f.file.startsWith("(")
      )) {
        await postCommitComment(
          authOctokit,
          owner,
          repo,
          sha,
          c.file,
          c.line,
          renderComment(c)
        );
      }

      const conclusion =
        result.verdict === "request_changes" ? "failure" : "success";
      await updateCheckRun(authOctokit, owner, repo, checkRunId, conclusion, {
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

      return res.status(200).json({
        message: "Review completed",
        findings: result.allFindings.length,
        conclusion,
      });
    } catch (err) {
      console.error("[trigger] error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Webhook Handler ──
  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch {
    return res.status(400).json({ message: "Cannot read body" });
  }

  const signature = req.headers["x-hub-signature-256"] || "";
  if (!verifySignature(rawBody, signature))
    return res.status(401).json({ message: "Invalid signature" });

  const event = req.headers["x-github-event"];
  const payload = JSON.parse(rawBody);

  // ── Pull Request ──
  if (event === "pull_request") {
    const { action, pull_request, repository, installation } = payload;
    if (!["opened", "synchronize", "reopened"].includes(action)) {
      return res.status(200).json({ message: "Action ignored" });
    }

    try {
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: APP_ID,
          privateKey: PRIVATE_KEY.replace(/\\n/g, "\n"),
          installationId: installation.id,
        },
      });
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
        diff,
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

      return res.status(200).json({
        message: "Review posted",
        scanner: result.scannerFindings.length,
        ai: result.aiResult.findings?.length || 0,
        verdict: result.verdict,
      });
    } catch (err) {
      console.error("[reviewer] fatal:", err);
      return res.status(500).json({ message: err.message });
    }
  }

  // ── Push (Commit) ──
  if (event === "push") {
    const { ref, after: headSha, repository, installation } = payload;
    const branchName = ref.replace("refs/heads/", "");

    // Check if branch is enabled
    if (!isBranchEnabled(branchName)) {
      return res
        .status(200)
        .json({ message: `Branch ${branchName} not enabled` });
    }

    try {
      const octokit = new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: APP_ID,
          privateKey: PRIVATE_KEY.replace(/\\n/g, "\n"),
          installationId: installation.id,
        },
      });
      const owner = repository.owner.login;
      const repo = repository.name;

      // Create check run FIRST
      const checkRunId = await createCheckRun(octokit, owner, repo, headSha);

      try {
        // Get diff
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
          body: payload.commits?.map((c) => `- ${c.message}`).join("\n") || "",
        };

        // ⚠️ Limit diff size to avoid timeout
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

        // Post commit comments
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

        return res.status(200).json({
          message: "Commit reviewed",
          findings: result.allFindings.length,
          conclusion,
        });
      } catch (innerErr) {
        // ⚠️ CRITICAL: Update check run even on error
        await updateCheckRun(octokit, owner, repo, checkRunId, "neutral", {
          title: "Review could not complete",
          summary: innerErr.message,
          text: "The AI reviewer encountered an error. This may be due to API rate limits or timeout.",
        });
        throw innerErr; // Re-throw to be caught by outer catch
      }
    } catch (err) {
      console.error("[push] fatal:", err);
      return res.status(500).json({ message: err.message });
    }
  }

  return res.status(200).json({ message: "Event ignored" });
}
