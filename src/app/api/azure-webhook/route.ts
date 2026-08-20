import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanDiff, parseUnifiedDiffFiles } from "@/lib/reviewer-core/rules-scanner";
import { reportRun } from "@/lib/control-plane";
import {
  COMPANY_NAME,
  BOT_NAME,
  BOT_ROLE,
  CODEBADGER_LOGO_URL,
  SUMMARY_MARKER,
  LEGACY_SUMMARY_MARKER,
} from "@/lib/branding";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const AZURE_DEVOPS_PAT = process.env.AZURE_DEVOPS_PAT || "";
const AZURE_ORG = process.env.AZURE_DEVOPS_ORG || "";
const AZURE_WEBHOOK_USER = process.env.AZURE_WEBHOOK_USER || "";
const AZURE_WEBHOOK_PASS = process.env.AZURE_WEBHOOK_PASS || "";

const API_VERSION = "7.1-preview.1";
const ENABLED_BRANCHES = (process.env.ENABLED_BRANCHES || "main,development")
  .split(",")
  .map((b) => b.trim())
  .filter(Boolean);

function loadRules() {
  try {
    return readFileSync(join(process.cwd(), "rules.md"), "utf8");
  } catch {
    return "";
  }
}

async function runAIReview(rules: string, diff: string, pr: any) {
  const systemPrompt = `You are **CodeBadger Reviewer**, a senior Angular 22 code-review agent for ${COMPANY_NAME}.
Your ONLY job: read the PR diff and enforce the project's rulebook with surgical precision.
You are strict, aggressive, and specific. Never say "looks good" without justification.

## Severity guide
- **critical**: @Input/@Output decorators, *ngIf/*ngFor, NgModules, HttpClient in components, console.error/alert, hardcoded colors in component SCSS outside theme files, missing i18n parity between en.json and ar.json.
- **high**: missing OnPush, missing @defer, missing aria-label on icon-only buttons, missing NgOptimizedImage priority.
- **medium**: naming/style violations, missing test spec, minor a11y improvements.
- **low**: readability/microopts, minor RTL concerns.

## Critical Exemptions & Rules
1. **Theme files are exempt from color rules**: ANY file in \`src/styles/themes/**/*.scss\`, \`src/styles/**/*theme*.scss\`, \`**/_variables*.scss\`, or token definitions is ALLOWED to contain raw hex/rgb/rgba color definitions. Do not flag colors inside theme files.
2. **Translation catalogs (\`src/assets/i18n/*.json\`) are exempt from hardcoded strings**: Raw translated text in i18n JSON catalogs is expected by definition. Do NOT flag text in translation files.
3. **New translation keys are valid**: Developers can add new keys. Only enforce parity (matching key in both en.json and ar.json). Never flag a new key as missing simply because it's not pre-seeded in documentation.

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
    if (first >= 0 && last > first) return JSON.parse(text.slice(first, last + 1));
    throw new Error("Invalid JSON from AI");
  }
}

function renderComment(f: any) {
  const icons: Record<string, string> = { critical: "🛑", high: "⚠️", medium: "🟡", low: "🔵", info: "ℹ️" };
  const icon = icons[f.severity] || "•";
  const severity = (f.severity || "info").toUpperCase();
  const category = f.category || "rule";

  const parts = [
    `### ${icon} ${severity} — ${f.title}`,
    ``,
    `**Category:** \`${category}\``,
  ];
  if (f.ruleRef) parts.push(`**Rule:** \`${f.ruleRef}\``);
  parts.push(``, f.explanation);
  if (f.suggestion) {
    parts.push(``, `**Suggested fix:**`, "```suggestion", f.suggestion, "```");
  }
  parts.push(``, `---`, `<sub>🦡 ${BOT_ROLE} — ${COMPANY_NAME}</sub>`);
  return parts.join("\n");
}

function adoAuthHeader() {
  const basic = Buffer.from(`:${AZURE_DEVOPS_PAT}`).toString("base64");
  return `Basic ${basic}`;
}

async function ado(url: string, init: any = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: adoAuthHeader(),
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ADO ${init.method || "GET"} ${url} → ${res.status}: ${err.slice(0, 500)}`);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

function repoUrl(project: string, repoId: string) {
  return `https://dev.azure.com/${AZURE_ORG}/${encodeURIComponent(project)}/_apis/git/repositories/${repoId}`;
}

async function getPullRequest(project: string, repoId: string, prId: string) {
  return ado(`${repoUrl(project, repoId)}/pullRequests/${prId}?api-version=${API_VERSION}`);
}

async function getPullRequestDiff(project: string, repoId: string, prId: string) {
  const iterations = await ado(
    `${repoUrl(project, repoId)}/pullRequests/${prId}/iterations?api-version=${API_VERSION}`
  );
  const iters = iterations.value || [];
  const latest = iters[iters.length - 1];
  if (!latest) return "";

  const iterationId = latest.id;
  const headCommit =
    latest.sourceRefCommit?.commitId ||
    latest.commonRefCommit?.commitId ||
    latest.targetRefCommit?.commitId;

  const iterChanges = await ado(
    `${repoUrl(project, repoId)}/pullRequests/${prId}/iterations/${iterationId}/changes?api-version=${API_VERSION}`
  );

  const out: string[] = [];
  for (const c of iterChanges.changeEntries || []) {
    const path = c.item?.path || "";
    if (!path) continue;
    const changeType = String(c.changeType || "").toLowerCase();
    if (changeType.includes("delete")) continue;

    try {
      const url =
        `${repoUrl(project, repoId)}/items` +
        `?path=${encodeURIComponent(path)}` +
        `&versionDescriptor.version=${headCommit}` +
        `&versionDescriptor.versionType=commit` +
        `&includeContent=true` +
        `&api-version=${API_VERSION}`;

      const res = await fetch(url, {
        headers: { accept: "text/plain", authorization: adoAuthHeader() },
      });
      if (!res.ok) {
        console.warn(`[azure-webhook] items ${path} → ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!text) continue;

      out.push(`diff --git a${path} b${path}`);
      out.push(`--- a${path}`);
      out.push(`+++ b${path}`);
      const lines = text.split("\n");
      out.push(`@@ -1,${lines.length} +1,${lines.length} @@`);
      for (const l of lines) out.push(`+${l}`);
    } catch (err: any) {
      console.warn(`[azure-webhook] skip file ${path}: ${err.message}`);
    }
  }
  return out.join("\n");
}

async function postPrThread(project: string, repoId: string, prId: string, { content, filePath, line, endLine }: { content: string; filePath?: string; line?: number; endLine?: number }) {
  const thread: any = {
    comments: [{ parentCommentId: 0, content, commentType: 1 }],
    status: 1,
  };
  if (filePath) {
    thread.threadContext = {
      filePath: filePath.startsWith("/") ? filePath : `/${filePath}`,
      rightFileStart: { line: line || 1, offset: 1 },
      rightFileEnd: { line: (endLine && line && endLine > line) ? endLine : (line || 1), offset: 1 },
    };
  }
  return ado(`${repoUrl(project, repoId)}/pullRequests/${prId}/threads?api-version=${API_VERSION}`, {
    method: "POST",
    body: JSON.stringify(thread),
  });
}

async function getPrChangedFiles(project: string, repoId: string, prId: string) {
  const iterations = await ado(
    `${repoUrl(project, repoId)}/pullRequests/${prId}/iterations?api-version=${API_VERSION}`
  );
  const iters = iterations.value || [];
  const latest = iters[iters.length - 1];
  if (!latest) return [];

  const iterChanges = await ado(
    `${repoUrl(project, repoId)}/pullRequests/${prId}/iterations/${latest.id}/changes?api-version=${API_VERSION}`
  );
  return (iterChanges.changeEntries || [])
    .map((c: any) => c.item?.path)
    .filter(Boolean);
}

async function generatePrTitle(files: string[]) {
  const list = files.slice(0, 60).join(", ");
  const prompt = `Based on these changed files: ${list}

Generate a concise PR title following conventional commits format.

Rules:
- Use one of these prefixes: feat | fix | style | i18n | test | chore | docs | ci | refactor | perf | build
- Maximum 10 words.
- Be specific about what changed.
- Output ONLY the title. No quotes. No markdown.

Examples:
feat: add contact-us page with form
style: update contact-us color tokens
fix: resolve dashboard loading spinner
i18n: add Arabic translations for login`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 60 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini title ${res.status}`);
  const data = await res.json();
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || "")
    .replace(/["`\n]/g, "")
    .trim();
  if (!/^(feat|fix|style|i18n|test|chore|docs|ci|refactor|perf|build):\s.+/.test(raw)) {
    return "chore: update code";
  }
  return raw;
}

async function updatePrTitle(project: string, repoId: string, prId: string, title: string) {
  return ado(`${repoUrl(project, repoId)}/pullRequests/${prId}?api-version=${API_VERSION}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

function isValidBranchName(branch: string) {
  if (!branch) return false;
  if (/^(main|development|master|HEAD)$/.test(branch)) return true;
  if (/^(release|hotfix|test)\/.+$/.test(branch)) return true;
  return /^[a-z0-9-]+(\/[a-z0-9-]+)?$/.test(branch);
}

function branchNameHelp(branch: string) {
  return [
    `🛑 **Invalid source branch name**: \`${branch}\``,
    ``,
    `**Required format**:`,
    `- \`<page>\`  →  \`login\``,
    `- \`<module>/<sub-module>\`  →  \`services/noc\``,
    ``,
    `**Examples**: \`login\`, \`dashboard\`, \`services/noc\`, \`services/tanker\`, \`services/fire\``,
    ``,
    `Use conventional commits for the type: \`fix(noc): resolve api error\`.`,
    ``,
    `Please rename your branch and re-open the PR.`,
    ``,
    `🦡 _${BOT_NAME} — branch policy_`,
  ].join("\n");
}

const SHARED_PATH_PATTERNS = [
  /^\/?src\/assets\/i18n\//i,
  /^\/?src\/app\/shared\//i,
  /^\/?src\/app\/layouts\//i,
  /^\/?src\/styles\//i,
  /^\/?src\/environments\//i,
  /^\/?(package(-lock)?\.json|angular\.json|tsconfig.*\.json|proxy\.conf\.json)$/i,
  /^\/?\.husky\//i,
  /^\/?commitlint\.config\.js$/i,
  /^\/?rules\.md$/i,
  /^\/?README\.md$/i,
  /^\/?\.github\//i,
];

function isSharedPath(path: string) {
  return SHARED_PATH_PATTERNS.some((rx) => rx.test(path));
}

function getBranchScopes(branch: string) {
  return branch.split("/").filter(Boolean).map((s) => s.toLowerCase());
}

function findOffScopeFiles(files: string[], branch: string) {
  const scopes = getBranchScopes(branch);
  if (!scopes.length) return [];
  return files.filter((path) => {
    if (isSharedPath(path)) return false;
    const lower = path.toLowerCase();
    return !scopes.some((s) => lower.includes(`/${s}`) || lower.includes(`${s}/`) || lower.includes(`${s}.`));
  });
}

function offScopeWarning(branch: string, offScope: string[]) {
  const list = offScope.slice(0, 20).map((f) => `- \`${f}\``).join("\n");
  const more = offScope.length > 20 ? `\n\n_(+${offScope.length - 20} more)_` : "";
  return [
    `⚠️ **Branch-scope warning** — the branch \`${branch}\` touches files outside its scope`,
    ``,
    `The following ${offScope.length} file(s) don't seem related to \`${branch}\`:`,
    ``,
    list + more,
    ``,
    `**Expected**: only files whose path contains one of \`${getBranchScopes(branch).join("`, `")}\`, or shared paths (\`src/assets/i18n/\`, \`src/app/shared/\`, \`src/styles/\`, root config).`,
    ``,
    `If these changes are intentional, ignore this warning. Otherwise, move them to their own branch.`,
    ``,
    `🦡 _${BOT_NAME} — scope policy_`,
  ].join("\n");
}

async function setPrStatus(project: string, repoId: string, prId: string, { state, description, iterationId }: { state: string; description: string; iterationId?: string }) {
  const body: any = {
    state,
    description,
    context: { name: "codebadger-ai-review", genre: "continuous-integration" },
  };
  if (iterationId) body.iterationId = iterationId;
  return ado(`${repoUrl(project, repoId)}/pullRequests/${prId}/statuses?api-version=${API_VERSION}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function POST(req: NextRequest) {
  /**
   * فشل مغلق (fail-closed): في الإنتاج يجب ضبط AZURE_WEBHOOK_USER/PASS.
   */
  if (process.env.NODE_ENV === "production" && (!AZURE_WEBHOOK_USER || !AZURE_WEBHOOK_PASS)) {
    console.error("[azure-webhook] rejected: basic auth credentials not configured (production is fail-closed)");
    return NextResponse.json({ error: "Webhook authentication not configured" }, { status: 401 });
  }

  if (AZURE_WEBHOOK_USER && AZURE_WEBHOOK_PASS) {
    const auth = req.headers.get("authorization") || "";
    const expected = "Basic " + Buffer.from(`${AZURE_WEBHOOK_USER}:${AZURE_WEBHOOK_PASS}`).toString("base64");
    const a = Buffer.from(auth);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = payload.eventType || "";

  if (!/^git\.pullrequest\.(created|updated)$/.test(eventType)) {
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" });
  }

  const resource = payload.resource || {};
  const project = resource.repository?.project?.name;
  const repoId = resource.repository?.id;
  const prId = resource.pullRequestId;
  const targetBranch = (resource.targetRefName || "").replace("refs/heads/", "");
  const sourceBranch = (resource.sourceRefName || "").replace("refs/heads/", "");
  const title = resource.title || "(no title)";
  const description = resource.description || "";
  const author = resource.createdBy?.displayName || resource.createdBy?.uniqueName || "unknown";
  const startedAt = Date.now();

  if (!project || !repoId || !prId) {
    return NextResponse.json({ error: "malformed webhook — missing project/repoId/prId" }, { status: 400 });
  }
  if (!ENABLED_BRANCHES.includes(targetBranch)) {
    return NextResponse.json({ ok: true, skipped: `target ${targetBranch} not enabled` });
  }

  if (!isValidBranchName(sourceBranch)) {
    try {
      await postPrThread(project, repoId, prId, { content: branchNameHelp(sourceBranch) });
      await setPrStatus(project, repoId, prId, {
        state: "failed",
        description: `🛑 Invalid branch name: ${sourceBranch}`,
      });
    } catch (e: any) {
      console.warn(`[azure-webhook] branch-policy comment failed: ${e.message}`);
    }
    return NextResponse.json({ ok: false, rejected: "invalid-branch-name", branch: sourceBranch });
  }

  try {
    await setPrStatus(project, repoId, prId, {
      state: "pending",
      description: `🦡 ${BOT_NAME} — running…`,
    });

    if (eventType === "git.pullrequest.created") {
      let files: string[] = [];
      try {
        files = await getPrChangedFiles(project, repoId, prId);
      } catch (e: any) {
        console.warn(`[azure-webhook] fetch changed files failed: ${e.message}`);
      }

      if (files.length) {
        try {
          const newTitle = await generatePrTitle(files);
          if (newTitle && newTitle !== title) {
            await updatePrTitle(project, repoId, prId, newTitle);
            console.log(`[azure-webhook] renamed PR #${prId} → "${newTitle}"`);
          }
        } catch (e: any) {
          console.warn(`[azure-webhook] title generation failed: ${e.message}`);
        }

        try {
          const offScope = findOffScopeFiles(files, sourceBranch);
          if (offScope.length) {
            await postPrThread(project, repoId, prId, {
              content: offScopeWarning(sourceBranch, offScope),
            });
            console.log(`[azure-webhook] off-scope files on ${sourceBranch}: ${offScope.length}`);
          }
        } catch (e: any) {
          console.warn(`[azure-webhook] scope check failed: ${e.message}`);
        }
      }
    }

    const diff = await getPullRequestDiff(project, repoId, prId);

    const rules = loadRules();
    const scannerFindings = scanDiff(parseUnifiedDiffFiles(diff));
    const aiResult = await runAIReview(rules, diff, {
      title,
      body: description,
      user: { login: author },
    });

    const allFindings = [...scannerFindings, ...(aiResult.findings || [])];
    const failSeverities = ["critical", "high"];
    const verdict = allFindings.some((f) => failSeverities.includes(f.severity))
      ? "request_changes"
      : "comment";

    for (const f of allFindings.filter((x) => x.file && !x.file.startsWith("("))) {
      try {
        await postPrThread(project, repoId, prId, {
          content: renderComment(f),
          filePath: f.file,
          line: f.line,
          endLine: f.endLine,
        });
      } catch (e: any) {
        console.warn(`[azure-webhook] skip inline ${f.file}:${f.line} → ${e.message}`);
      }
    }

    const counts = allFindings.reduce((acc: Record<string, number>, f: any) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    }, {});

    const sevIcons: Record<string, string> = { critical: "🛑", high: "⚠️", medium: "🟡", low: "🔵", info: "ℹ️" };
    const sevOrder = ["critical", "high", "medium", "low", "info"];
    const severityRows = sevOrder
      .map((sev) => `| ${sevIcons[sev]} ${sev.charAt(0).toUpperCase() + sev.slice(1)} | ${counts[sev] || 0} |`)
      .join("\n");

    const fileCounts = allFindings.reduce((acc: Record<string, number>, f: any) => {
      if (!f.file) return acc;
      acc[f.file] = (acc[f.file] || 0) + 1;
      return acc;
    }, {});
    const filesSection = Object.entries(fileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([file, n]) => `- \`${file}\` — **${n}** finding${n > 1 ? "s" : ""}`)
      .join("\n");

    const categoryCounts = allFindings.reduce((acc: Record<string, number>, f: any) => {
      const c = f.category || "other";
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});
    const categoriesSection = Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `\`${cat}\` (${n})`)
      .join(" · ");

    const verdictBanner = ({
      approve: "## ✅ Approved\n\nNo blocking issues found. Nice work!",
      comment: "## 💬 Review Notes\n\nA few improvements suggested — not blocking.",
      request_changes: "## 🛑 Changes Required\n\nCritical rule violations found. Please address them before merging.",
    } as Record<string, string>)[verdict];

    const summaryLines = [
      `# <img src="${CODEBADGER_LOGO_URL}" width="32" height="32" alt="${COMPANY_NAME}" align="absmiddle" /> ${BOT_NAME}`,
      ``,
      verdictBanner,
      ``,
      `### 📊 Findings Breakdown`,
      ``,
      `| Severity | Count |`,
      `|:--|:--:|`,
      severityRows,
    ];

    if (allFindings.length && categoriesSection) {
      summaryLines.push(``, `**By category:** ${categoriesSection}`);
    }

    if (filesSection) {
      summaryLines.push(``, `### 📁 Files with Issues`, ``, filesSection);
    }

    summaryLines.push(
      ``,
      `### 📝 Overview`,
      ``,
      aiResult.summary || "_(no additional summary)_",
      ``,
      `---`,
      `<sub>Reviewed by **${COMPANY_NAME}** against private rulebook · AI: Gemini · Scanner findings: ${scannerFindings.length} · AI findings: ${aiResult.findings?.length || 0}</sub>`
    );

    const summaryMd = summaryLines.join("\n");

    await postPrThread(project, repoId, prId, { content: summaryMd });

    await setPrStatus(project, repoId, prId, {
      state: verdict === "request_changes" ? "failed" : "succeeded",
      description:
        verdict === "request_changes"
          ? `🛑 ${allFindings.length} issue(s) found`
          : "✅ AI Review passed",
    });

    await reportRun({
      eventType,
      prNumber: parseInt(prId, 10) || undefined,
      verdict,
      findings: allFindings.length,
      durationMs: Date.now() - startedAt,
      status: "success",
    });

    return NextResponse.json({ ok: true, prId, findings: allFindings.length, verdict });
  } catch (err: any) {
    console.error("[azure-webhook] fatal:", err);
    await reportRun({
      eventType: eventType || "unknown",
      prNumber: payload.resource?.pullRequestId ? parseInt(payload.resource.pullRequestId, 10) : undefined,
      durationMs: Date.now() - (startedAt ?? Date.now()),
      status: "failed",
      errorMsg: String(err.message || err).slice(0, 2000),
    });
    try {
      await setPrStatus(project, repoId, prId, {
        state: "failed",
        description: `⚠️ AI Review error: ${err.message.slice(0, 120)}`,
      });
    } catch {}
    return NextResponse.json({ ok: false, error: err.message });
  }
}
