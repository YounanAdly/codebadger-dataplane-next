import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import https from "https";

// ═══════════════════════════════════════════════════════
// ENVIRONMENT & CONSTANTS
// ═══════════════════════════════════════════════════════

const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

const AZURE_DEVOPS_PAT = process.env.AZURE_DEVOPS_PAT;
const AZURE_ORG = process.env.AZURE_DEVOPS_ORG;
const AZURE_API_VERSION = "7.1-preview.1";

// ═══════════════════════════════════════════════════════
// GENERAL HELPERS
// ═══════════════════════════════════════════════════════

function getPrivateKey() {
  if (!PRIVATE_KEY) return "";
  return PRIVATE_KEY.replace(/\\n/g, "\n");
}

function getEnabledBranches() {
  const env = process.env.ENABLED_BRANCHES || "main,development";
  return env
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean);
}

function errorHtml(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 4rem auto; padding: 0 1rem; background: #0d1117; color: #c9d1d9; }
    .error { background: #161b22; border: 1px solid #30363d; padding: 1.5rem; border-radius: 8px; }
    h2 { color: #f85149; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="error">
    <h2>❌ ${title}</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════
// AZURE DEVOPS HELPERS (using Node.js https)
// ═══════════════════════════════════════════════════════

function adoAuthHeader() {
  if (!AZURE_DEVOPS_PAT) return "";
  const basic = Buffer.from(`:${AZURE_DEVOPS_PAT}`).toString("base64");
  return `Basic ${basic}`;
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
      console.log(`[ADO] Response: ${res.statusCode}`);
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            console.log(`[ADO] Data keys: ${Object.keys(json).join(", ")}`);
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

    req.on("error", (err) => {
      console.error(`[ADO] Request error: ${err.message}`);
      reject(err);
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error("ADO request timeout"));
    });

    req.end();
  });
}

function adoRepoUrl(org, project, repoId) {
  return `https://dev.azure.com/${org}/${encodeURIComponent(
    project
  )}/_apis/git/repositories/${encodeURIComponent(repoId)}`;
}

// ═══════════════════════════════════════════════════════
// ROUTING & URL BUILDERS
// ═══════════════════════════════════════════════════════

function buildDashboardUrl(provider, params, extra = {}) {
  const search = new URLSearchParams();
  search.set("provider", provider);
  if (provider === "azure") {
    search.set("org", params.org);
    search.set("project", params.project);
  } else {
    search.set("owner", params.owner);
  }
  search.set("repo", params.repo);

  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null) search.set(k, v);
  }
  return `/api/dashboard?${search.toString()}`;
}

function buildPrDetailsUrl(provider, params, prNum) {
  const search = new URLSearchParams();
  search.set("provider", provider);
  if (provider === "azure") {
    search.set("org", params.org);
    search.set("project", params.project);
  } else {
    search.set("owner", params.owner);
  }
  search.set("repo", params.repo);
  search.set("pr", prNum);
  return `/api/dashboard/pr?${search.toString()}`;
}

// ═══════════════════════════════════════════════════════
// MAIN API HANDLER
// ═══════════════════════════════════════════════════════

export default async function handler(req, res) {
  const {
    provider = "github",
    owner,
    org,
    project,
    repo,
    tab = "prs",
    branch = "all",
  } = req.query;

  const isAzure = provider === "azure";

  if (isAzure) {
    if (!org || !project || !repo) {
      return res
        .status(400)
        .send(
          errorHtml(
            "Missing parameters",
            "Azure: Use: ?provider=azure&org=ORG&project=PROJECT&repo=REPO"
          )
        );
    }
    if (!AZURE_DEVOPS_PAT || !AZURE_ORG) {
      return res
        .status(500)
        .send(
          errorHtml(
            "Azure not configured",
            "AZURE_DEVOPS_PAT and AZURE_DEVOPS_ORG env vars are required."
          )
        );
    }
    console.log(
      `[dashboard] Azure request: org=${org}, project=${project}, repo=${repo}, AZURE_ORG=${AZURE_ORG}`
    );
    return azureDashboardHandler(req, res, { org, project, repo, tab, branch });
  }

  if (!owner || !repo) {
    return res
      .status(400)
      .send(errorHtml("Missing parameters", "Use: ?owner=USER&repo=REPO"));
  }

  return githubDashboardHandler(req, res, { owner, repo, tab, branch });
}

// ═══════════════════════════════════════════════════════
// GITHUB PROVIDER HANDLER
// ═══════════════════════════════════════════════════════

async function githubDashboardHandler(req, res, { owner, repo, tab, branch }) {
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
        .send(
          errorHtml(
            "App Not Installed",
            `The Marafiq AI Reviewer app is not installed on <strong>${owner}</strong>.`
          )
        );
    }

    const authOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: APP_ID,
        privateKey: getPrivateKey(),
        installationId: installation.id,
      },
    });

    const { data: branchesData } = await authOctokit.rest.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });
    const branches = branchesData.map((b) => b.name);
    const enabledBranches = getEnabledBranches();

    const { data: pulls } = await authOctokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      per_page: 25,
      sort: "updated",
      direction: "desc",
    });

    const prsWithReviews = await Promise.all(
      pulls.map(async (pr) => {
        let botComments = [];
        try {
          const { data: comments } = await authOctokit.rest.issues.listComments(
            {
              owner,
              repo,
              issue_number: pr.number,
              per_page: 50,
            }
          );
          botComments = comments.filter(
            (c) =>
              c.user?.login?.includes("marafiq-ai-reviewer") &&
              (c.body || "").includes("Marafiq AI Review")
          );
        } catch {}

        const summaryComment = botComments.find((c) =>
          (c.body || "").includes("Findings")
        );
        let verdict = "pending";
        let findingsCount = 0;

        if (summaryComment) {
          if (summaryComment.body.includes("Changes required")) {
            verdict = "failure";
          } else if (summaryComment.body.includes("Approve")) {
            verdict = "success";
          } else {
            verdict = "comment";
          }

          const match = summaryComment.body.match(
            /🛑 (\d+) critical|⚠️ (\d+) high|🟡 (\d+) medium|🔵 (\d+) low|ℹ️ (\d+) info/g
          );
          if (match) {
            findingsCount = match.reduce((sum, m) => {
              const n = parseInt(m.replace(/[^0-9]/g, ""), 10);
              return sum + (isNaN(n) ? 0 : n);
            }, 0);
          }
        }

        return {
          ...pr,
          _verdict: verdict,
          _findings: findingsCount,
          _reviewedAt: summaryComment?.created_at || pr.updated_at,
        };
      })
    );

    let commits = [];
    const targetBranch = branch !== "all" ? branch : "main";
    try {
      const { data: commitsData } = await authOctokit.rest.repos.listCommits({
        owner,
        repo,
        sha: targetBranch,
        per_page: 30,
      });
      commits = commitsData;
    } catch {}

    let checkRunsMap = new Map();
    try {
      for (const b of branch !== "all" ? [branch] : branches.slice(0, 5)) {
        try {
          const { data: checksData } = await authOctokit.rest.checks.listForRef(
            {
              owner,
              repo,
              ref: `heads/${b}`,
              check_name: "Marafiq AI Review",
              per_page: 20,
            }
          );
          for (const run of checksData.check_runs || []) {
            checkRunsMap.set(run.head_sha, run);
          }
        } catch {}
      }
    } catch {}

    const commitsWithStatus = commits.map((c) => {
      const run = checkRunsMap.get(c.sha);
      return {
        ...c,
        _reviewStatus: run ? run.conclusion || run.status : "none",
        _checkRunUrl: run?.html_url || null,
      };
    });

    const successCount = prsWithReviews.filter(
      (p) => p._verdict === "success"
    ).length;
    const failureCount = prsWithReviews.filter(
      (p) => p._verdict === "failure"
    ).length;
    const commentCount = prsWithReviews.filter(
      (p) => p._verdict === "comment"
    ).length;

    const commitSuccess = commitsWithStatus.filter(
      (c) => c._reviewStatus === "success"
    ).length;
    const commitFailure = commitsWithStatus.filter(
      (c) => c._reviewStatus === "failure"
    ).length;
    const commitPending = commitsWithStatus.filter(
      (c) => c._reviewStatus === "in_progress"
    ).length;
    const commitNone = commitsWithStatus.filter(
      (c) => c._reviewStatus === "none"
    ).length;

    const html = buildHtml({
      provider: "github",
      urlParams: { owner, repo },
      owner,
      repo,
      tab,
      branch,
      branches,
      enabledBranches,
      prsWithReviews,
      successCount,
      failureCount,
      commentCount,
      commitsWithStatus,
      commitSuccess,
      commitFailure,
      commitPending,
      commitNone,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    console.error("[dashboard] error:", err);
    res.status(500).send(errorHtml("Error", err.message));
  }
}

// ═══════════════════════════════════════════════════════
// AZURE DEVOPS PROVIDER HANDLER
// ═══════════════════════════════════════════════════════

async function azureDashboardHandler(
  req,
  res,
  { org, project, repo, tab, branch }
) {
  const debugLogs = [];
  function log(msg) {
    console.log(msg);
    debugLogs.push(msg);
  }

  try {
    const repoUrl = adoRepoUrl(org, project, repo);
    log(`[Azure] Repo URL: ${repoUrl}`);
    log(`[Azure] AZURE_ORG env: ${AZURE_ORG}`);
    log(`[Azure] Request org: ${org}`);

    // 1. Fetch branches
    let branches = [];
    try {
      const refsUrl = `${repoUrl}/refs?api-version=${AZURE_API_VERSION}&filter=heads&$top=100`;
      log(`[Azure] Fetching branches: ${refsUrl}`);
      const refsData = await adoFetch(refsUrl);
      log(
        `[Azure] Branches raw response: ${JSON.stringify(refsData).slice(
          0,
          500
        )}`
      );
      branches = (refsData.value || [])
        .map((r) => r.name?.replace("refs/heads/", "") || "")
        .filter(Boolean);
      log(`[Azure] Parsed branches: ${branches.join(", ") || "(none)"}`);
    } catch (err) {
      log(`[Azure] Branches ERROR: ${err.message}`);
    }

    // 2. Fetch PRs
    let pulls = [];
    try {
      const prsUrl = `${repoUrl}/pullRequests?api-version=${AZURE_API_VERSION}&searchCriteria.status=all&$top=25`;
      log(`[Azure] Fetching PRs: ${prsUrl}`);
      const prsData = await adoFetch(prsUrl);
      log(
        `[Azure] PRs raw response count: ${
          prsData.count || (prsData.value ? prsData.value.length : 0)
        }`
      );
      pulls = prsData.value || [];
      log(`[Azure] Parsed PRs: ${pulls.length}`);
      if (pulls.length > 0) {
        log(
          `[Azure] First PR title: ${pulls[0].title}, ID: ${pulls[0].pullRequestId}`
        );
      }
    } catch (err) {
      log(`[Azure] PRs ERROR: ${err.message}`);
    }

    // 3. Enrich PRs with review threads
    const prsWithReviews = await Promise.all(
      pulls.map(async (pr) => {
        let verdict = "pending";
        let findingsCount = 0;
        let reviewedAt = pr.creationDate;

        try {
          const threadsUrl = `${repoUrl}/pullRequests/${pr.pullRequestId}/threads?api-version=${AZURE_API_VERSION}`;
          log(`[Azure] Fetching threads for PR ${pr.pullRequestId}`);
          const threadsData = await adoFetch(threadsUrl);
          const threads = threadsData.value || [];
          log(`[Azure] PR ${pr.pullRequestId} threads: ${threads.length}`);

          const summaryThread = threads.find((t) => {
            const first = t.comments?.[0];
            return (
              first &&
              (first.author?.displayName || "")
                .toLowerCase()
                .includes("marafiq") &&
              (first.content || "").includes("Marafiq AI Review")
            );
          });

          if (summaryThread) {
            const body = summaryThread.comments[0].content || "";
            reviewedAt = summaryThread.publishedDate || reviewedAt;

            if (body.includes("Changes required")) verdict = "failure";
            else if (body.includes("Approve")) verdict = "success";
            else verdict = "comment";

            const match = body.match(
              /🛑 (\d+) critical|⚠️ (\d+) high|🟡 (\d+) medium|🔵 (\d+) low|ℹ️ (\d+) info/g
            );
            if (match) {
              findingsCount = match.reduce((sum, m) => {
                const n = parseInt(m.replace(/[^0-9]/g, ""), 10);
                return sum + (isNaN(n) ? 0 : n);
              }, 0);
            }
          }
        } catch (err) {
          log(
            `[Azure] Threads ERROR for PR ${pr.pullRequestId}: ${err.message}`
          );
        }

        return {
          number: pr.pullRequestId,
          title: pr.title || "(no title)",
          html_url: pr.url || "",
          user: {
            login:
              pr.createdBy?.displayName ||
              pr.createdBy?.uniqueName ||
              "unknown",
            avatar_url: pr.createdBy?.imageUrl || "",
          },
          head: { ref: (pr.sourceRefName || "").replace("refs/heads/", "") },
          base: { ref: (pr.targetRefName || "").replace("refs/heads/", "") },
          state: pr.status === "completed" ? "closed" : "open",
          updated_at: pr.creationDate,
          _verdict: verdict,
          _findings: findingsCount,
          _reviewedAt: reviewedAt,
        };
      })
    );

    // 4. Fetch Commits
    let commits = [];
    const targetBranch = branch !== "all" ? branch : branches[0] || "main";
    try {
      const commitsUrl = `${repoUrl}/commits?api-version=${AZURE_API_VERSION}&searchCriteria.itemVersion.version=${encodeURIComponent(
        targetBranch
      )}&$top=30`;
      log(`[Azure] Fetching commits: ${commitsUrl}`);
      const commitsData = await adoFetch(commitsUrl);
      log(
        `[Azure] Commits raw count: ${
          commitsData.count ||
          (commitsData.value ? commitsData.value.length : 0)
        }`
      );
      commits = (commitsData.value || []).map((c) => ({
        sha: c.commitId,
        html_url: c.url || "",
        commit: {
          message: c.comment || "",
          author: { name: c.author?.name || "unknown", date: c.author?.date },
          committer: { date: c.author?.date },
        },
        author: { login: c.author?.name || "unknown", avatar_url: "" },
      }));
      log(`[Azure] Parsed commits: ${commits.length}`);
    } catch (err) {
      log(`[Azure] Commits ERROR: ${err.message}`);
    }

    // 5. Fetch PR Statuses
    let checkRunsMap = new Map();
    try {
      const branchList = branch !== "all" ? [branch] : branches.slice(0, 5);
      for (const b of branchList) {
        try {
          const prsForBranchUrl = `${repoUrl}/pullRequests?api-version=${AZURE_API_VERSION}&searchCriteria.sourceRefName=refs/heads/${encodeURIComponent(
            b
          )}&searchCriteria.status=all&$top=20`;
          const prsForBranch = await adoFetch(prsForBranchUrl);

          for (const pr of prsForBranch.value || []) {
            try {
              const statusesData = await adoFetch(
                `${repoUrl}/pullRequests/${pr.pullRequestId}/statuses?api-version=${AZURE_API_VERSION}`
              );
              const statuses = statusesData.value || [];
              const aiStatus = statuses.find(
                (s) =>
                  s.context?.name === "marafiq-ai-review" ||
                  (s.description || "").toLowerCase().includes("marafiq")
              );
              if (aiStatus && pr.lastMergeSourceCommit?.commitId) {
                checkRunsMap.set(pr.lastMergeSourceCommit.commitId, {
                  conclusion:
                    aiStatus.state === "succeeded"
                      ? "success"
                      : aiStatus.state === "failed"
                      ? "failure"
                      : aiStatus.state === "pending"
                      ? "in_progress"
                      : "none",
                  status: aiStatus.state,
                  html_url: pr.url || "",
                });
              }
            } catch {}
          }
        } catch {}
      }
    } catch {}

    const commitsWithStatus = commits.map((c) => {
      const run = checkRunsMap.get(c.sha);
      return {
        ...c,
        _reviewStatus: run ? run.conclusion || run.status : "none",
        _checkRunUrl: run?.html_url || null,
      };
    });

    const successCount = prsWithReviews.filter(
      (p) => p._verdict === "success"
    ).length;
    const failureCount = prsWithReviews.filter(
      (p) => p._verdict === "failure"
    ).length;
    const commentCount = prsWithReviews.filter(
      (p) => p._verdict === "comment"
    ).length;

    const commitSuccess = commitsWithStatus.filter(
      (c) => c._reviewStatus === "success"
    ).length;
    const commitFailure = commitsWithStatus.filter(
      (c) => c._reviewStatus === "failure"
    ).length;
    const commitPending = commitsWithStatus.filter(
      (c) => c._reviewStatus === "in_progress"
    ).length;
    const commitNone = commitsWithStatus.filter(
      (c) => c._reviewStatus === "none"
    ).length;

    const html = buildHtml({
      provider: "azure",
      urlParams: { org, project, repo },
      owner: org,
      repo,
      tab,
      branch,
      branches,
      enabledBranches: getEnabledBranches(),
      prsWithReviews,
      successCount,
      failureCount,
      commentCount,
      commitsWithStatus,
      commitSuccess,
      commitFailure,
      commitPending,
      commitNone,
      debugLogs,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.status(200).send(html);
  } catch (err) {
    console.error("[dashboard/azure] error:", err);
    res.status(500).send(errorHtml("Error", err.message));
  }
}

// ═══════════════════════════════════════════════════════
// HTML TEMPLATE RENDERERS
// ═══════════════════════════════════════════════════════

function buildHtml({
  provider,
  urlParams,
  owner,
  repo,
  tab,
  branch,
  branches,
  enabledBranches,
  prsWithReviews,
  successCount,
  failureCount,
  commentCount,
  commitsWithStatus,
  commitSuccess,
  commitFailure,
  commitPending,
  commitNone,
  debugLogs = [],
}) {
  const displayName =
    provider === "azure"
      ? `${urlParams.org}/${urlParams.project}/${repo}`
      : `${owner}/${repo}`;
  const prsUrl = buildDashboardUrl(provider, urlParams, { tab: "prs" });
  const commitsUrl = buildDashboardUrl(provider, urlParams, { tab: "commits" });
  const branchesUrl = buildDashboardUrl(provider, urlParams, {
    tab: "branches",
  });

  const toggleBaseParams = new URLSearchParams();
  toggleBaseParams.set("provider", provider);
  if (provider === "azure") {
    toggleBaseParams.set("org", urlParams.org);
    toggleBaseParams.set("project", urlParams.project);
  } else {
    toggleBaseParams.set("owner", urlParams.owner);
  }
  toggleBaseParams.set("repo", repo);
  const toggleBaseUrl = "/api/dashboard/toggle?" + toggleBaseParams.toString();

  const debugHtml =
    debugLogs.length > 0
      ? `<details style="margin-bottom:1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1rem;">
          <summary style="cursor:pointer;font-weight:600;color:var(--warning);">🔧 Debug Logs (${
            debugLogs.length
          })</summary>
          <pre style="margin-top:0.75rem;font-size:0.75rem;color:var(--text-secondary);overflow-x:auto;white-space:pre-wrap;">${debugLogs
            .map((l) => l.replace(/</g, "&lt;"))
            .join("\n")}</pre>
        </details>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Marafiq AI Review — ${displayName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
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
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 280px; background: var(--surface); border-right: 1px solid var(--border); padding: 1.5rem; position: fixed; height: 100vh; overflow-y: auto; }
    .brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 2rem; }
    .brand-icon { width: 38px; height: 38px; background: linear-gradient(135deg, var(--brand), var(--brand-light)); border-radius: 10px; display: grid; place-items: center; font-size: 1.2rem; }
    .brand-text { font-weight: 700; font-size: 1.1rem; letter-spacing: -0.02em; }
    .brand-text span { color: var(--brand-light); }
    .repo-badge { background: rgba(0,140,152,0.12); border: 1px solid rgba(0,140,152,0.25); color: var(--brand-light); padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1.5rem; display: inline-block; word-break: break-all; }
    .nav-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary); margin-bottom: 0.75rem; }
    .nav-item { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.75rem; border-radius: 8px; color: var(--text-secondary); text-decoration: none; font-size: 0.9rem; font-weight: 500; transition: all 0.15s; margin-bottom: 0.25rem; }
    .nav-item:hover { background: var(--surface-hover); color: var(--text); }
    .nav-item.active { background: rgba(0,140,152,0.15); color: var(--brand-light); }
    .main { margin-left: 280px; flex: 1; padding: 2rem; max-width: 1400px; }
    .header { margin-bottom: 1.5rem; }
    .header h1 { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
    .header p { color: var(--text-secondary); font-size: 0.95rem; }
    .tabs { display: flex; gap: 0.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 0.35rem; margin-bottom: 1.5rem; width: fit-content; }
    .tab { padding: 0.5rem 1.25rem; border-radius: 8px; font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); text-decoration: none; transition: all 0.15s; border: none; background: transparent; cursor: pointer; }
    .tab:hover { color: var(--text); }
    .tab.active { background: var(--brand); color: white; }
    .tab .count { background: rgba(255,255,255,0.2); padding: 0.15rem 0.5rem; border-radius: 10px; font-size: 0.75rem; margin-left: 0.4rem; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .branch-select { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.9rem; font-family: inherit; cursor: pointer; min-width: 180px; }
    .branch-select:focus { outline: none; border-color: var(--brand); }
    .branch-select option { background: var(--surface); color: var(--text); }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; transition: all 0.2s; }
    .stat-card:hover { border-color: var(--brand); transform: translateY(-2px); }
    .stat-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); margin-bottom: 0.5rem; }
    .stat-value { font-size: 2rem; font-weight: 700; letter-spacing: -0.03em; }
    .stat-total .stat-value { color: var(--text); }
    .stat-success .stat-value { color: var(--success); }
    .stat-failure .stat-value { color: var(--danger); }
    .stat-comment .stat-value { color: var(--warning); }
    .stat-pending .stat-value { color: var(--info); }
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .section-header { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
    .section-header h2 { font-size: 0.95rem; font-weight: 600; }
    .section-header .count { background: var(--bg); color: var(--text-secondary); padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.75rem 1.25rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.02); }
    td { padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border); font-size: 0.88rem; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface-hover); }
    .pr-title { font-weight: 500; color: var(--text); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pr-title a { color: inherit; text-decoration: none; }
    .pr-title a:hover { color: var(--brand-light); }
    .pr-number { color: var(--text-secondary); font-size: 0.82rem; font-family: 'JetBrains Mono', monospace; }
    .author { display: flex; align-items: center; gap: 0.5rem; color: var(--text-secondary); font-size: 0.85rem; }
    .author img { width: 20px; height: 20px; border-radius: 50%; }
    .badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.65rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .badge-success { background: rgba(63,185,80,0.15); color: var(--success); }
    .badge-failure { background: rgba(248,81,73,0.15); color: var(--danger); }
    .badge-comment { background: rgba(210,153,34,0.15); color: var(--warning); }
    .badge-pending { background: rgba(88,166,255,0.15); color: var(--info); }
    .badge-neutral { background: rgba(139,148,158,0.15); color: var(--text-secondary); }
    .findings-count { font-weight: 700; font-size: 0.9rem; }
    .findings-count.zero { color: var(--text-secondary); }
    .findings-count.has-issues { color: var(--danger); }
    .date { color: var(--text-secondary); font-size: 0.82rem; }
    .btn { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.78rem; font-weight: 600; text-decoration: none; border: 1px solid var(--border); background: var(--bg); color: var(--text-secondary); transition: all 0.15s; cursor: pointer; }
    .btn:hover { border-color: var(--brand); color: var(--brand-light); background: rgba(0,140,152,0.08); }
    .btn-primary { background: var(--brand); color: white; border-color: var(--brand); }
    .btn-primary:hover { background: var(--brand-light); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .commit-sha { font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: var(--brand-light); background: rgba(0,140,152,0.1); padding: 0.25rem 0.5rem; border-radius: 6px; text-decoration: none; }
    .commit-sha:hover { background: rgba(0,140,152,0.2); }
    .commit-msg { max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
    .commit-author { display: flex; align-items: center; gap: 0.4rem; color: var(--text-secondary); font-size: 0.85rem; }
    .commit-author img { width: 18px; height: 18px; border-radius: 50%; }
    .toggle-wrap { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; }
    .toggle-switch { position: relative; width: 40px; height: 22px; background: var(--surface-hover); border-radius: 11px; transition: background 0.2s; border: 1px solid var(--border); }
    .toggle-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; background: var(--text-secondary); border-radius: 50%; transition: all 0.2s; }
    .toggle-switch.active { background: var(--brand); border-color: var(--brand); }
    .toggle-switch.active::after { left: 20px; background: white; }
    .toggle-label { font-size: 0.85rem; font-weight: 500; }
    .toggle-label.enabled { color: var(--success); }
    .toggle-label.disabled { color: var(--danger); }
    .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .toast { position: fixed; bottom: 2rem; right: 2rem; background: var(--surface); border: 1px solid var(--border); padding: 1rem 1.5rem; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); font-size: 0.9rem; font-weight: 500; z-index: 1000; display: none; animation: slideIn 0.3s ease; }
    .toast.show { display: block; }
    .toast.success { border-color: var(--success); color: var(--success); }
    .toast.error { border-color: var(--danger); color: var(--danger); }
    @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    .empty-state { text-align: center; padding: 4rem 2rem; color: var(--text-secondary); }
    .empty-state h3 { color: var(--text); margin-bottom: 0.5rem; font-weight: 600; }
    @media (max-width: 1024px) { .sidebar { display: none; } .main { margin-left: 0; padding: 1.5rem; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .stats-grid { grid-template-columns: 1fr; } th, td { padding: 0.75rem 1rem; } .pr-title { max-width: 200px; } .toolbar { flex-direction: column; align-items: stretch; } }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-icon">🤖</div>
        <div class="brand-text">Marafiq <span>AI</span></div>
      </div>
      <div class="repo-badge">${displayName}</div>
      <div class="nav-label">Navigation</div>
      <a href="${prsUrl}" class="nav-item ${
    tab === "prs" ? "active" : ""
  }">🔀 Pull Requests</a>
      <a href="${commitsUrl}" class="nav-item ${
    tab === "commits" ? "active" : ""
  }">📦 Commits</a>
      <a href="${branchesUrl}" class="nav-item ${
    tab === "branches" ? "active" : ""
  }">🌿 Branches</a>
    </aside>

    <main class="main">
      <div class="header">
        <h1>${
          tab === "prs"
            ? "Pull Request Reviews"
            : tab === "commits"
            ? "Commit Reviews"
            : "Branch Controls"
        }</h1>
        <p>AI-powered code review for ${displayName}</p>
      </div>

      ${debugHtml}

      ${
        tab === "prs"
          ? renderPRsTab({
              provider,
              urlParams,
              prsWithReviews,
              successCount,
              failureCount,
              commentCount,
              owner,
              repo,
              branch,
              branches,
            })
          : ""
      }
      ${
        tab === "commits"
          ? renderCommitsTab({
              provider,
              urlParams,
              commitsWithStatus,
              commitSuccess,
              commitFailure,
              commitPending,
              commitNone,
              owner,
              repo,
              branch,
              branches,
            })
          : ""
      }
      ${
        tab === "branches"
          ? renderBranchesTab({
              provider,
              urlParams,
              branches,
              enabledBranches,
              owner,
              repo,
            })
          : ""
      }
    </main>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    function showToast(message, type) {
      type = type || 'success';
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.className = 'toast show ' + type;
      setTimeout(function() { toast.classList.remove('show'); }, 3000);
    }

    async function runReview(sha, branchName, btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Running...';
      try {
        const res = await fetch('/api/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner: '${owner}', repo: '${repo}', sha: sha, branch: branchName })
        });
        const data = await res.json();
        if (res.ok) {
          showToast('✓ Review started for ' + sha.slice(0, 7));
          setTimeout(function() { window.location.reload(); }, 2000);
        } else {
          showToast('✕ ' + (data.error || 'Failed'), 'error');
          btn.disabled = false;
          btn.innerHTML = '🔄 Run Review';
        }
      } catch (err) {
        showToast('✕ Network error', 'error');
        btn.disabled = false;
        btn.innerHTML = '🔄 Run Review';
      }
    }

    async function toggleBranch(branch, enabled) {
      var url = '${toggleBaseUrl}' + '&branch=' + encodeURIComponent(branch) + '&enabled=' + encodeURIComponent(enabled);
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        var el = document.querySelector('[data-branch="' + branch + '"] .toggle-switch');
        var lbl = document.querySelector('[data-branch="' + branch + '"] .toggle-label');
        if (enabled) {
          el.classList.add('active');
          lbl.textContent = 'Enabled';
          lbl.className = 'toggle-label enabled';
        } else {
          el.classList.remove('active');
          lbl.textContent = 'Disabled';
          lbl.className = 'toggle-label disabled';
        }
        showToast(enabled ? '✓ Enabled for ' + branch : '✓ Disabled for ' + branch);
      } else {
        showToast('✕ Toggle failed', 'error');
      }
    }
  </script>
</body>
</html>`;
}

function renderPRsTab({
  provider,
  urlParams,
  prsWithReviews,
  successCount,
  failureCount,
  commentCount,
  owner,
  repo,
  branch,
  branches,
}) {
  return `
      <div class="tabs">
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "prs",
        })}" class="tab active">🔀 Pull Requests <span class="count">${
    prsWithReviews.length
  }</span></a>
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "commits",
        })}" class="tab">📦 Commits</a>
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "branches",
        })}" class="tab">🌿 Branches</a>
      </div>

      <div class="toolbar">
        <select class="branch-select" onchange="window.location.href=this.value">
          <option value="${buildDashboardUrl(provider, urlParams, {
            tab: "prs",
            branch: "all",
          })}" ${branch === "all" ? "selected" : ""}>All Branches</option>
          ${branches
            .map(
              (b) =>
                `<option value="${buildDashboardUrl(provider, urlParams, {
                  tab: "prs",
                  branch: b,
                })}" ${branch === b ? "selected" : ""}>${b}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-total"><div class="stat-label">Total PRs</div><div class="stat-value">${
          prsWithReviews.length
        }</div></div>
        <div class="stat-card stat-success"><div class="stat-label">Approved</div><div class="stat-value">${successCount}</div></div>
        <div class="stat-card stat-failure"><div class="stat-label">Changes Required</div><div class="stat-value">${failureCount}</div></div>
        <div class="stat-card stat-comment"><div class="stat-label">Comments</div><div class="stat-value">${commentCount}</div></div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Recent Pull Requests</h2><span class="count">${
          prsWithReviews.length
        }</span></div>
        ${
          prsWithReviews.length === 0
            ? `<div class="empty-state"><h3>No pull requests found</h3><p>Reviews will appear here once the bot processes PRs.</p></div>`
            : `
          <table>
            <thead>
              <tr>
                <th>Pull Request</th>
                <th>Author</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Findings</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${prsWithReviews
                .map(
                  (pr) => `
                <tr>
                  <td>
                    <div class="pr-title"><a href="${
                      pr.html_url
                    }" target="_blank">${pr.title.replace(
                    /</g,
                    "&lt;"
                  )}</a></div>
                    <div class="pr-number">#${pr.number}</div>
                  </td>
                  <td><div class="author"><img src="${
                    pr.user?.avatar_url || ""
                  }" alt="" onerror="this.style.display='none'">${
                    pr.user?.login || "unknown"
                  }</div></td>
                  <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-secondary)">${
                    pr.head?.ref || "?"
                  }</code></td>
                  <td><span class="badge badge-${pr._verdict}">${
                    pr._verdict === "success"
                      ? "✓ Approved"
                      : pr._verdict === "failure"
                      ? "✕ Changes Required"
                      : pr._verdict === "comment"
                      ? "● Comment"
                      : "○ Pending"
                  }</span></td>
                  <td><span class="findings-count ${
                    pr._findings > 0 ? "has-issues" : "zero"
                  }">${pr._findings}</span></td>
                  <td class="date">${new Date(
                    pr._reviewedAt
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}</td>
                  <td><a href="${buildPrDetailsUrl(
                    provider,
                    urlParams,
                    pr.number
                  )}" class="btn">Details →</a></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
        }
      </div>
  `;
}

function renderCommitsTab({
  provider,
  urlParams,
  commitsWithStatus,
  commitSuccess,
  commitFailure,
  commitPending,
  commitNone,
  owner,
  repo,
  branch,
  branches,
}) {
  return `
      <div class="tabs">
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "prs",
        })}" class="tab">🔀 Pull Requests</a>
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "commits",
        })}" class="tab active">📦 Commits <span class="count">${
    commitsWithStatus.length
  }</span></a>
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "branches",
        })}" class="tab">🌿 Branches</a>
      </div>

      <div class="toolbar">
        <select class="branch-select" onchange="window.location.href=this.value">
          <option value="${buildDashboardUrl(provider, urlParams, {
            tab: "commits",
            branch: "all",
          })}" ${branch === "all" ? "selected" : ""}>All Branches</option>
          ${branches
            .map(
              (b) =>
                `<option value="${buildDashboardUrl(provider, urlParams, {
                  tab: "commits",
                  branch: b,
                })}" ${branch === b ? "selected" : ""}>${b}</option>`
            )
            .join("")}
        </select>
      </div>

      <div class="stats-grid">
        <div class="stat-card stat-total"><div class="stat-label">Total Commits</div><div class="stat-value">${
          commitsWithStatus.length
        }</div></div>
        <div class="stat-card stat-success"><div class="stat-label">Passed</div><div class="stat-value">${commitSuccess}</div></div>
        <div class="stat-card stat-failure"><div class="stat-label">Failed</div><div class="stat-value">${commitFailure}</div></div>
        <div class="stat-card stat-pending"><div class="stat-label">Pending / None</div><div class="stat-value">${
          commitPending + commitNone
        }</div></div>
      </div>

      <div class="section">
        <div class="section-header"><h2>Recent Commits</h2><span class="count">${
          commitsWithStatus.length
        }</span></div>
        ${
          commitsWithStatus.length === 0
            ? `<div class="empty-state"><h3>No commits found</h3><p>Select a branch to view commits.</p></div>`
            : `
          <table>
            <thead>
              <tr>
                <th>Commit</th>
                <th>Message</th>
                <th>Author</th>
                <th>Branch</th>
                <th>Review Status</th>
                <th>Time</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${commitsWithStatus
                .map(
                  (c) => `
                <tr>
                  <td><a href="${
                    c.html_url
                  }" target="_blank" class="commit-sha">${
                    c.sha?.slice(0, 7) || "???????"
                  }</a></td>
                  <td><div class="commit-msg" title="${(
                    c.commit?.message || ""
                  ).replace(/"/g, "&quot;")}">${(c.commit?.message || "")
                    .split("\n")[0]
                    .replace(/</g, "&lt;")}</div></td>
                  <td><div class="commit-author"><img src="${
                    c.author?.avatar_url || ""
                  }" alt="" onerror="this.style.display='none'">${
                    c.author?.login || c.commit?.author?.name || "unknown"
                  }</div></td>
                  <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-secondary)">${
                    branch !== "all" ? branch : "main"
                  }</code></td>
                  <td>${
                    c._reviewStatus === "success"
                      ? '<span class="badge badge-success">✓ Passed</span>'
                      : c._reviewStatus === "failure"
                      ? '<span class="badge badge-failure">✕ Failed</span>'
                      : c._reviewStatus === "in_progress"
                      ? '<span class="badge badge-pending">⏳ Running</span>'
                      : '<span class="badge badge-neutral">○ Not Reviewed</span>'
                  }</td>
                  <td class="date">${new Date(
                    c.commit?.committer?.date || Date.now()
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}</td>
                  <td>${
                    c._reviewStatus === "none" || c._reviewStatus === "neutral"
                      ? `<button class="btn btn-primary" onclick="runReview('${
                          c.sha
                        }', '${
                          branch !== "all" ? branch : "main"
                        }', this)">🔄 Run Review</button>`
                      : `<a href="${
                          c._checkRunUrl || c.html_url
                        }" target="_blank" class="btn">View ↗</a>`
                  }</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        `
        }
      </div>
  `;
}

function renderBranchesTab({
  provider,
  urlParams,
  branches,
  enabledBranches,
  owner,
  repo,
}) {
  return `
      <div class="tabs">
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "prs",
        })}" class="tab">🔀 Pull Requests</a>
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "commits",
        })}" class="tab">📦 Commits</a>
        <a href="${buildDashboardUrl(provider, urlParams, {
          tab: "branches",
        })}" class="tab active">🌿 Branches <span class="count">${
    branches.length
  }</span></a>
      </div>

      <div class="section">
        <div class="section-header"><h2>Branch Review Controls</h2><span class="count">${
          branches.length
        }</span></div>
        <table>
          <thead>
            <tr>
              <th>Branch</th>
              <th>Status</th>
              <th>AI Review</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${branches
              .map((b) => {
                const enabled = enabledBranches.includes(b);
                return `
                <tr data-branch="${b}">
                  <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.9rem;color:var(--brand-light)">${b}</code></td>
                  <td><span class="badge badge-${
                    enabled ? "success" : "neutral"
                  }">${enabled ? "● Active" : "○ Inactive"}</span></td>
                  <td>
                    <div class="toggle-wrap" onclick="toggleBranch('${b}', ${!enabled})">
                      <div class="toggle-switch ${
                        enabled ? "active" : ""
                      }"></div>
                      <span class="toggle-label ${
                        enabled ? "enabled" : "disabled"
                      }">${enabled ? "Enabled" : "Disabled"}</span>
                    </div>
                  </td>
                  <td><span style="color:var(--text-secondary);font-size:0.85rem">${
                    enabled ? "Auto-review on push" : "Reviews paused"
                  }</span></td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>

      <div style="margin-top:1.5rem;padding:1.25rem;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
        <h3 style="font-size:0.95rem;margin-bottom:0.5rem">ℹ️ How it works</h3>
        <p style="color:var(--text-secondary);font-size:0.85rem;line-height:1.6">
          Toggle branches to control which ones trigger AI reviews automatically on push events.
          <strong>Enabled</strong> branches will be reviewed when commits are pushed.
          You can also run manual reviews from the <a href="${buildDashboardUrl(
            provider,
            urlParams,
            { tab: "commits" }
          )}" style="color:var(--brand-light)">Commits tab</a>.
        </p>
      </div>
  `;
}
