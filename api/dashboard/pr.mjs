import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import https from "https";

const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const AZURE_DEVOPS_PAT = process.env.AZURE_DEVOPS_PAT;
const AZURE_API_VERSION = "7.1-preview.1";

function getPrivateKey() {
  if (!PRIVATE_KEY) return "";
  return PRIVATE_KEY.replace(/\\n/g, "\n");
}

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ═══════════════════════════════════════════════════════
// AZURE DEVOPS HELPERS
// ═══════════════════════════════════════════════════════

function adoAuthHeader() {
  if (!AZURE_DEVOPS_PAT) return "";
  const basic = Buffer.from(`:${AZURE_DEVOPS_PAT}`).toString("base64");
  return `Basic ${basic}`;
}

function adoRepoUrl(org, project, repoId) {
  return `https://dev.azure.com/${org}/${encodeURIComponent(
    project
  )}/_apis/git/repositories/${encodeURIComponent(repoId)}`;
}

function adoFetch(url) {
  return new Promise((resolve, reject) => {
    console.log(`[ADO] GET ${url}`);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: adoAuthHeader(),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            resolve(data);
          }
        } else {
          console.error(`[ADO] Error: ${data.slice(0, 500)}`);
          reject(
            new Error(`ADO ${url} → ${res.statusCode}: ${data.slice(0, 500)}`)
          );
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("ADO request timeout"));
    });
    req.end();
  });
}

// ═══════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {
  const { provider = "github", owner, org, project, repo, pr } = req.query;

  if (provider === "azure") {
    if (!org || !project || !repo || !pr) {
      return res
        .status(400)
        .send(
          errorHtml(
            "Missing parameters",
            "Azure: Use: ?provider=azure&org=ORG&project=PROJECT&repo=REPO&pr=NUMBER"
          )
        );
    }
    if (!AZURE_DEVOPS_PAT) {
      return res
        .status(500)
        .send(
          errorHtml(
            "Azure not configured",
            "AZURE_DEVOPS_PAT env var is required."
          )
        );
    }
    const prNum = parseInt(pr, 10);
    if (isNaN(prNum)) {
      return res
        .status(400)
        .send(errorHtml("Invalid PR number", "PR must be a number"));
    }
    return azurePrHandler(req, res, { org, project, repo, prNum });
  }

  // ── GitHub flow (original) ──
  const ghOwner = owner || org;
  if (!ghOwner || !repo || !pr) {
    return res
      .status(400)
      .send(
        errorHtml(
          "Missing parameters",
          "Use: ?owner=USER&repo=REPO&pr=NUMBER (or use ?org=ORG)"
        )
      );
  }

  try {
    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: { appId: APP_ID, privateKey: getPrivateKey() },
    });

    const { data: installations } = await octokit.rest.apps.listInstallations();
    const installation = installations.find(
      (i) => i.account?.login?.toLowerCase() === ghOwner.toLowerCase()
    );

    if (!installation) {
      return res.status(404).send("App not installed on this account");
    }

    const authOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: APP_ID,
        privateKey: getPrivateKey(),
        installationId: installation.id,
      },
    });

    const prNum = parseInt(pr, 10);
    if (isNaN(prNum)) {
      return res.status(400).send("Invalid PR number");
    }

    const { data: pull } = await authOctokit.rest.pulls.get({
      owner: ghOwner,
      repo,
      pull_number: prNum,
    });

    let issueComments = [];
    try {
      const { data: comments } = await authOctokit.rest.issues.listComments({
        owner: ghOwner,
        repo,
        issue_number: prNum,
        per_page: 100,
      });
      issueComments = comments || [];
    } catch (err) {
      console.warn(
        `[dashboard/pr] Failed to fetch issue comments: ${err.message}`
      );
    }

    let reviewComments = [];
    try {
      const { data: rcs } = await authOctokit.rest.pulls.listReviewComments({
        owner: ghOwner,
        repo,
        pull_number: prNum,
        per_page: 100,
      });
      reviewComments = rcs || [];
    } catch (err) {
      console.warn(
        `[dashboard/pr] Failed to fetch review comments: ${err.message}`
      );
    }

    const botSummary = issueComments.find(
      (c) =>
        c.user?.login?.includes("marafiq-ai-reviewer") &&
        (c.body || "").includes("Marafiq AI Review")
    );

    const botFindings = reviewComments.filter((c) =>
      c.user?.login?.includes("marafiq-ai-reviewer")
    );

    return renderPrPage(res, {
      provider: "github",
      owner: ghOwner,
      repo,
      prNum,
      pull,
      botSummary,
      botFindings,
      backUrl: `/api/dashboard?owner=${encodeURIComponent(
        ghOwner
      )}&repo=${encodeURIComponent(repo)}`,
    });
  } catch (err) {
    console.error("[dashboard/pr] error:", err);
    res.status(500).send(errorHtml("Error", err.message));
  }
}

// ═══════════════════════════════════════════════════════
// AZURE DEVOPS PR HANDLER  (FIXED DETECTION)
// ═══════════════════════════════════════════════════════

async function azurePrHandler(req, res, { org, project, repo, prNum }) {
  try {
    const repoUrl = adoRepoUrl(org, project, repo);

    // Fetch PR details
    const prData = await adoFetch(
      `${repoUrl}/pullRequests/${prNum}?api-version=${AZURE_API_VERSION}`
    );

    // Fetch threads (comments + inline comments)
    const threadsData = await adoFetch(
      `${repoUrl}/pullRequests/${prNum}/threads?api-version=${AZURE_API_VERSION}`
    );
    const threads = threadsData.value || [];

    // Map ADO PR to GitHub-like shape for the template
    const pull = {
      title: prData.title || "(no title)",
      html_url: prData.url || "",
      user: {
        login:
          prData.createdBy?.displayName ||
          prData.createdBy?.uniqueName ||
          "unknown",
        avatar_url: prData.createdBy?.imageUrl || "",
      },
      head: {
        ref: (prData.sourceRefName || "").replace("refs/heads/", ""),
      },
      base: {
        ref: (prData.targetRefName || "").replace("refs/heads/", ""),
      },
      state: prData.status === "completed" ? "closed" : "open",
      merged: prData.status === "completed",
    };

    // ── FIX: detect by content signature, NOT author name ──
    // Azure PAT comments are posted under the PAT owner's identity,
    // so author.displayName is never "marafiq".

    const summaryThread = threads.find((t) => {
      const first = t.comments?.[0];
      return first && (first.content || "").includes("🤖 Marafiq AI Review");
    });
    const botSummary = summaryThread
      ? { body: summaryThread.comments[0].content || "" }
      : null;

    const botFindings = threads
      .filter((t) => {
        const first = t.comments?.[0];
        return (
          first &&
          (first.content || "").includes("🤖 Marafiq AI Reviewer") &&
          t.threadContext?.filePath
        );
      })
      .map((t) => ({
        body: t.comments[0].content || "",
        path: t.threadContext.filePath.replace(/^\//, ""),
        line: t.threadContext.rightFileStart?.line || 0,
        original_line: t.threadContext.rightFileStart?.line || 0,
        html_url: prData.url || "",
      }));

    return renderPrPage(res, {
      provider: "azure",
      owner: org,
      repo,
      prNum,
      pull,
      botSummary,
      botFindings,
      backUrl: `/api/dashboard?provider=azure&org=${encodeURIComponent(
        org
      )}&project=${encodeURIComponent(project)}&repo=${encodeURIComponent(
        repo
      )}`,
    });
  } catch (err) {
    console.error("[dashboard/pr/azure] error:", err);
    res.status(500).send(errorHtml("Error", err.message));
  }
}

// ═══════════════════════════════════════════════════════
// SHARED HTML RENDERER
// ═══════════════════════════════════════════════════════

function renderPrPage(
  res,
  { provider, owner, repo, prNum, pull, botSummary, botFindings, backUrl }
) {
  const findings = [];
  for (const c of botFindings) {
    try {
      const body = c.body || "";
      const sevMatch = body.match(/(🛑|⚠️|🟡|🔵|ℹ️)/);
      const severity =
        sevMatch?.[1] === "🛑"
          ? "critical"
          : sevMatch?.[1] === "⚠️"
          ? "high"
          : sevMatch?.[1] === "🟡"
          ? "medium"
          : sevMatch?.[1] === "🔵"
          ? "low"
          : "info";

      const titleMatch = body.match(/—\s*(.+?)(?:\n|$)/);
      const title = titleMatch ? titleMatch[1].trim() : "Finding";

      let explanation = body
        .replace(/[🛑⚠️🟡🔵ℹ️]/g, "")
        .replace(/—.*/, "")
        .replace(
          /\*\*CRITICAL\*\*|\*\*HIGH\*\*|\*\*MEDIUM\*\*|\*\*LOW\*\*|\*\*INFO\*\*/gi,
          ""
        )
        .replace(/📖 _.+?_/g, "")
        .replace(/🤖 _.+?_/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim();

      explanation = explanation.split("```suggestion")[0].trim();

      const suggestionMatch = body.match(/\`\`\`suggestion\s*([\s\S]*?)\`\`\`/);

      findings.push({
        path: c.path || "unknown",
        line: c.line || c.original_line || 0,
        severity,
        title,
        explanation: explanation || title,
        suggestion: suggestionMatch ? suggestionMatch[1].trim() : null,
        url: c.html_url || pull.html_url,
      });
    } catch (err) {
      console.error(`[dashboard/pr] Error parsing finding: ${err.message}`);
      continue;
    }
  }

  findings.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
  });

  const counts = findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});

  const severityConfig = {
    critical: {
      icon: "🛑",
      label: "Critical",
      color: "#f85149",
      bg: "rgba(248,81,73,0.12)",
      border: "rgba(248,81,73,0.35)",
    },
    high: {
      icon: "⚠️",
      label: "High",
      color: "#d29922",
      bg: "rgba(210,153,34,0.12)",
      border: "rgba(210,153,34,0.35)",
    },
    medium: {
      icon: "🟡",
      label: "Medium",
      color: "#e3b341",
      bg: "rgba(227,179,65,0.12)",
      border: "rgba(227,179,65,0.35)",
    },
    low: {
      icon: "🔵",
      label: "Low",
      color: "#58a6ff",
      bg: "rgba(88,166,255,0.12)",
      border: "rgba(88,166,255,0.35)",
    },
    info: {
      icon: "ℹ️",
      label: "Info",
      color: "#8b949e",
      bg: "rgba(139,148,158,0.12)",
      border: "rgba(139,148,158,0.35)",
    },
  };

  let verdict = "pending";
  let verdictLabel = "Pending Review";
  let verdictClass = "verdict-pending";

  if (botSummary) {
    const body = botSummary.body || "";
    if (body.includes("Changes required")) {
      verdict = "failure";
      verdictLabel = "Changes Required";
      verdictClass = "verdict-failure";
    } else if (body.includes("Approve")) {
      verdict = "success";
      verdictLabel = "Approved";
      verdictClass = "verdict-success";
    } else {
      verdict = "comment";
      verdictLabel = "Comment";
      verdictClass = "verdict-comment";
    }
  }

  const findingsBadge = botSummary
    ? botSummary.body.match(/\*\*Findings\*\*: ([^*]+)/)?.[1] || ""
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PR #${prNum} — Marafiq AI Review</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/scss.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/html.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --surface-hover: #1c2128;
      --border: #30363d;
      --text: #c9d1d9;
      --text-secondary: #8b949e;
      --brand: #008c98;
      --brand-light: #00b4c4;
      --success: #3fb950;
      --warning: #d29922;
      --danger: #f85149;
      --info: #58a6ff;
      --code-bg: #0d1117;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }
    .layout { display: flex; min-height: 100vh; }
    .sidebar {
      width: 260px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 1.5rem;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .brand-icon {
      width: 38px; height: 38px;
      background: linear-gradient(135deg, var(--brand), var(--brand-light));
      border-radius: 10px;
      display: grid; place-items: center;
      font-size: 1.2rem;
    }
    .brand-text { font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em; }
    .brand-text span { color: var(--brand-light); }
    .repo-badge {
      background: rgba(0,140,152,0.12);
      border: 1px solid rgba(0,140,152,0.25);
      color: var(--brand-light);
      padding: 0.5rem 0.75rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 2rem;
      display: inline-block;
    }
    .main {
      margin-left: 260px;
      flex: 1;
      padding: 2rem;
      max-width: 1100px;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 1.5rem;
      transition: color 0.15s;
    }
    .back-link:hover { color: var(--brand-light); }

    .pr-header {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.75rem;
      margin-bottom: 1.25rem;
    }
    .pr-title {
      font-size: 1.3rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 0.75rem;
      line-height: 1.4;
    }
    .pr-meta {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      flex-wrap: wrap;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .pr-meta a { color: var(--brand-light); text-decoration: none; font-weight: 500; }
    .pr-meta a:hover { text-decoration: underline; }
    .pr-meta img { width: 20px; height: 20px; border-radius: 50%; vertical-align: middle; margin-right: 0.3rem; }

    .verdict-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    .verdict-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.95rem;
    }
    .verdict-success { background: rgba(63,185,80,0.15); color: var(--success); border: 1px solid rgba(63,185,80,0.3); }
    .verdict-failure { background: rgba(248,81,73,0.15); color: var(--danger); border: 1px solid rgba(248,81,73,0.3); }
    .verdict-comment { background: rgba(210,153,34,0.15); color: var(--warning); border: 1px solid rgba(210,153,34,0.3); }
    .verdict-pending { background: rgba(88,166,255,0.15); color: var(--info); border: 1px solid rgba(88,166,255,0.3); }

    .github-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      background: var(--brand);
      color: white;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.9rem;
      transition: all 0.15s;
      border: none;
      cursor: pointer;
    }
    .github-btn:hover { background: var(--brand-light); transform: translateY(-1px); }

    .stats-row {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      flex-wrap: wrap;
    }
    .stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.9rem;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--surface);
    }

    .findings-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1rem;
    }
    .findings-header h2 { font-size: 1.05rem; font-weight: 600; letter-spacing: -0.01em; }
    .findings-header .count {
      background: var(--surface);
      color: var(--text-secondary);
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid var(--border);
    }

    .finding-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      margin-bottom: 1rem;
      transition: all 0.2s;
    }
    .finding-card:hover {
      border-color: var(--border);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .finding-header {
      padding: 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border);
    }
    .finding-severity {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.7rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .finding-title-text {
      font-weight: 600;
      font-size: 0.95rem;
      flex: 1;
    }
    .finding-file {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      color: var(--text-secondary);
      background: var(--bg);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      border: 1px solid var(--border);
      text-decoration: none;
      transition: all 0.15s;
    }
    .finding-file:hover { border-color: var(--brand); color: var(--brand-light); }
    .finding-body {
      padding: 1rem 1.25rem;
    }
    .finding-explanation {
      color: var(--text-secondary);
      font-size: 0.9rem;
      line-height: 1.7;
      margin-bottom: 1rem;
      white-space: pre-wrap;
    }

    .suggestion-block {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .suggestion-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.6rem 1rem;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid var(--border);
    }
    .suggestion-label {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary);
    }
    .suggestion-actions {
      display: flex;
      gap: 0.5rem;
    }
    .icon-btn {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
      padding: 0.3rem 0.6rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      text-decoration: none;
    }
    .icon-btn:hover {
      border-color: var(--brand);
      color: var(--brand-light);
      background: rgba(0,140,152,0.08);
    }
    .suggestion-code {
      padding: 1rem 1.25rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.82rem;
      line-height: 1.7;
      overflow-x: auto;
      white-space: pre;
      color: var(--text);
    }
    .suggestion-code pre {
      margin: 0;
      background: transparent !important;
      padding: 0 !important;
    }
    .suggestion-code code {
      background: transparent !important;
      padding: 0 !important;
      font-family: 'JetBrains Mono', monospace !important;
      font-size: 0.82rem !important;
    }

    .empty-state {
      text-align: center;
      padding: 5rem 2rem;
      color: var(--text-secondary);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
    }
    .empty-state h2 { color: var(--text); font-size: 1.25rem; margin-bottom: 0.5rem; font-weight: 600; }
    .empty-state p { font-size: 0.95rem; }

    @media (max-width: 1024px) {
      .sidebar { display: none; }
      .main { margin-left: 0; padding: 1.5rem; }
    }
    @media (max-width: 640px) {
      .pr-title { font-size: 1.1rem; }
      .finding-header { flex-direction: column; align-items: flex-start; }
      .verdict-bar { flex-direction: column; align-items: flex-start; }
      .suggestion-header { flex-direction: column; gap: 0.5rem; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">🤖</div>
        <div class="brand-text">Marafiq <span>AI</span></div>
      </div>
      <div class="repo-badge">${owner}/${repo}</div>
    </aside>

    <main class="main">
      <a href="${backUrl}" class="back-link">← Back to Dashboard</a>

      <div class="pr-header">
        <div class="pr-title">${escapeHtml(pull.title)}</div>
        <div class="pr-meta">
          <span><img src="${
            pull.user?.avatar_url || ""
          }" alt="" onerror="this.style.display='none'">${
    pull.user?.login || "unknown"
  }</span>
          <span><a href="${
            pull.html_url
          }" target="_blank">PR #${prNum}</a></span>
          <span>${pull.head?.ref || "?"} → ${pull.base?.ref || "?"}</span>
          <span>${
            pull.merged
              ? "✓ Merged"
              : pull.state === "closed"
              ? "✕ Closed"
              : "● Open"
          }</span>
        </div>
      </div>

      <div class="verdict-bar">
        <div class="verdict-badge ${verdictClass}">
          ${
            verdict === "success"
              ? "✓"
              : verdict === "failure"
              ? "✕"
              : verdict === "comment"
              ? "●"
              : "○"
          }
          ${verdictLabel}
          ${
            findingsBadge
              ? `<span style="opacity:0.7;margin-left:0.5rem;font-weight:500">— ${findingsBadge}</span>`
              : ""
          }
        </div>
        <a href="${pull.html_url}" target="_blank" class="github-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          View on ${provider === "azure" ? "Azure DevOps" : "GitHub"}
        </a>
      </div>

      <div class="stats-row">
        ${Object.entries(counts)
          .map(
            ([sev, count]) => `
          <div class="stat-chip" style="color: ${
            severityConfig[sev]?.color || "#8b949e"
          }; border-color: ${severityConfig[sev]?.border || "var(--border)"};">
            ${severityConfig[sev]?.icon || "•"} ${
              severityConfig[sev]?.label || sev
            }: ${count}
          </div>
        `
          )
          .join("")}
        ${
          findings.length === 0 && botSummary
            ? '<div class="stat-chip" style="color:var(--success);border-color:rgba(63,185,80,0.3)">✨ No issues found</div>'
            : ""
        }
        ${
          !botSummary
            ? '<div class="stat-chip" style="color:var(--info);border-color:rgba(88,166,255,0.3)">⏳ Not reviewed yet</div>'
            : ""
        }
      </div>

      <div class="findings-header">
        <h2>Review Findings</h2>
        <span class="count">${findings.length}</span>
      </div>

      <div class="findings-list">
        ${
          !botSummary
            ? `
          <div class="empty-state"><h2>⏳ Not Reviewed Yet</h2><p>The AI reviewer hasn't processed this pull request yet.</p></div>
        `
            : findings.length === 0
            ? `
          <div class="empty-state"><h2>✨ Clean Code</h2><p>The AI reviewer found no rule violations in this pull request.</p></div>
        `
            : findings
                .map(
                  (f) => `
          <div class="finding-card" style="border-color: ${
            severityConfig[f.severity]?.border || "var(--border)"
          };">
            <div class="finding-header" style="background: ${
              severityConfig[f.severity]?.bg || "transparent"
            };">
              <div style="display:flex;align-items:center;gap:0.75rem;flex:1;min-width:0;">
                <span class="finding-severity" style="color: ${
                  severityConfig[f.severity]?.color || "#8b949e"
                }; border: 1px solid ${
                    severityConfig[f.severity]?.border || "var(--border)"
                  };">
                  ${severityConfig[f.severity]?.icon || "•"} ${
                    severityConfig[f.severity]?.label || f.severity
                  }
                </span>
                <span class="finding-title-text" style="color: ${
                  severityConfig[f.severity]?.color || "var(--text)"
                };">
                  ${escapeHtml(f.title)}
                </span>
              </div>
              <a href="${
                f.url
              }" target="_blank" class="finding-file">${escapeHtml(f.path)}:${
                    f.line
                  }</a>
            </div>
            <div class="finding-body">
              <div class="finding-explanation">${escapeHtml(
                f.explanation
              )}</div>
              ${
                f.suggestion
                  ? `
                <div class="suggestion-block">
                  <div class="suggestion-header">
                    <span class="suggestion-label">Suggested Change</span>
                    <div class="suggestion-actions">
                      <button class="icon-btn" onclick="copyCode(this)" title="Copy to clipboard">📋 Copy</button>
                      <a href="${
                        f.url
                      }" target="_blank" class="icon-btn" title="View on ${
                      provider === "azure" ? "Azure DevOps" : "GitHub"
                    }">🔗 ${provider === "azure" ? "Azure" : "GitHub"}</a>
                    </div>
                  </div>
                  <div class="suggestion-code"><pre><code class="language-typescript">${escapeHtml(
                    f.suggestion
                  )}</code></pre></div>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `
                )
                .join("")
        }
      </div>
    </main>
  </div>

  <script>
    async function copyCode(btn) {
      const code = btn.closest('.suggestion-block').querySelector('.suggestion-code').innerText;
      try {
        await navigator.clipboard.writeText(code);
        const original = btn.innerText;
        btn.innerText = '✓ Copied!';
        btn.style.borderColor = '#3fb950';
        btn.style.color = '#3fb950';
        setTimeout(() => { btn.innerText = original; btn.style.borderColor = ''; btn.style.color = ''; }, 2000);
      } catch (err) {
        btn.innerText = '✕ Failed';
        setTimeout(() => btn.innerText = '📋 Copy', 2000);
      }
    }
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    });
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function errorHtml(title, message) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title>
  <style>body{font-family:system-ui,sans-serif;max-width:600px;margin:4rem auto;padding:0 1rem;background:#0d1117;color:#c9d1d9}
  .error{background:#161b22;border:1px solid #30363d;padding:1.5rem;border-radius:8px}
  h2{color:#f85149;margin-bottom:0.5rem}</style></head>
  <body><div class="error"><h2>❌ ${title}</h2><p>${message}</p></div></body></html>`;
}
