import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function getPrivateKey() {
  if (!PRIVATE_KEY) return "";
  return PRIVATE_KEY.replace(/\\n/g, "\n");
}

// ── Shared logic (same as webhook) ──
function loadRules() {
  try {
    const { readFileSync } = require("fs");
    const { join } = require("path");
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
${diff.slice(0, 50000)}
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
    const match = text.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/);
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

async function createCheckRun(octokit, owner, repo, headSha) {
  const { data } = await octokit.rest.checks.create({
    owner,
    repo,
    name: "Marafiq AI Review",
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

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body;
  try {
    body =
      req.body ||
      JSON.parse(
        await new Promise((resolve, reject) => {
          let data = "";
          req.on("data", (chunk) => (data += chunk));
          req.on("end", () => resolve(data));
          req.on("error", reject);
        })
      );
    if (typeof body === "string") body = JSON.parse(body);
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
      auth: { appId: APP_ID, privateKey: getPrivateKey() },
    });

    const { data: installations } = await octokit.rest.apps.listInstallations();
    const installation = installations.find(
      (i) => i.account?.login?.toLowerCase() === owner.toLowerCase()
    );

    if (!installation) {
      return res
        .status(404)
        .json({ error: "App not installed on this account" });
    }

    const authOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: APP_ID,
        privateKey: getPrivateKey(),
        installationId: installation.id,
      },
    });

    // Get commit info
    const { data: commitData } = await authOctokit.rest.repos.getCommit({
      owner,
      repo,
      ref: sha,
    });

    const parentSha = commitData.parents?.[0]?.sha;
    let diff = "";

    if (parentSha) {
      // Use Octokit to get diff instead of raw fetch
      const { data: compareData } = await authOctokit.rest.repos.compareCommits(
        {
          owner,
          repo,
          base: parentSha,
          head: sha,
          mediaType: { format: "diff" },
        }
      );
      diff = compareData;
    }

    // Create check run
    const checkRunId = await createCheckRun(authOctokit, owner, repo, sha);

    const fakePr = {
      title: `Manual review on ${branch || "unknown"}`,
      user: { login: commitData.author?.login || "manual" },
      body: commitData.commit?.message || "Manual trigger",
    };

    // Run review
    const rules = loadRules();
    const scannerFindings = scanDiff(diff);
    const limitedDiff =
      diff.length > 50000
        ? diff.slice(0, 50000) + "\n\n[... diff truncated for size ...]"
        : diff;

    const aiResult = await runAIReview(rules, limitedDiff, fakePr);
    const allFindings = [...scannerFindings, ...(aiResult.findings || [])];

    const failSeverities = ["critical", "high"];
    const verdict = allFindings.some((f) => failSeverities.includes(f.severity))
      ? "request_changes"
      : "comment";
    const conclusion = verdict === "request_changes" ? "failure" : "success";

    // Post commit comments
    for (const c of allFindings.filter(
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

    // Update check run
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
              {
                critical: "🛑",
                high: "⚠️",
                medium: "🟡",
                low: "🔵",
                info: "ℹ️",
              }[sev]
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

    await updateCheckRun(authOctokit, owner, repo, checkRunId, conclusion, {
      title:
        conclusion === "failure"
          ? `🛑 ${allFindings.length} issue(s) found`
          : "✅ No blocking issues",
      summary: summaryMd,
      text:
        allFindings
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
      findings: allFindings.length,
      conclusion,
      verdict,
    });
  } catch (err) {
    console.error("[trigger] error:", err);
    return res.status(500).json({ error: err.message });
  }
}
