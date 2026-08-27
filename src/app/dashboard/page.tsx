// src/app/dashboard/page.tsx
/**
 * Public-facing dashboard for each customer's Data Plane deployment.
 * Shows PRs with review status, branches, and commit status.
 */
import Link from "next/link";
import { makeOctokit } from "@/lib/providers/github";
import { SUMMARY_MARKER, LEGACY_SUMMARY_MARKER } from "@/lib/branding";

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";
const COMPANY_NAME = "CodeBadger";

function parseRepo(): { owner: string; repo: string } {
  if (!GITHUB_REPOSITORY) return { owner: "", repo: "" };
  const [owner, repo] = GITHUB_REPOSITORY.split("/");
  return { owner, repo };
}

function verdictFromBody(body: string): string {
  if (body.includes("Changes required")) return "failure";
  if (body.includes("Approve")) return "success";
  if (body.includes("Findings")) return "comment";
  return "pending";
}

function findingsCount(body: string): number {
  const m = body.match(/🛑 (\d+) critical|⚠️ (\d+) high|🟡 (\d+) medium|🔵 (\d+) low|ℹ️ (\d+)/g);
  if (!m) return 0;
  return m.reduce((s: number, x: string) => {
    const n = parseInt(x.replace(/[^0-9]/g, ""), 10);
    return s + (isNaN(n) ? 0 : n);
  }, 0);
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg: Record<string, { bg: string; c: string; label: string; icon: string }> = {
    success: { bg: "rgba(63,185,80,0.15)", c: "#3fb950", label: "Approved", icon: "✓" },
    failure: { bg: "rgba(248,81,73,0.15)", c: "#f85149", label: "Changes Required", icon: "✕" },
    comment: { bg: "rgba(210,153,34,0.15)", c: "#d29922", label: "Comment", icon: "●" },
    pending: { bg: "rgba(88,166,255,0.15)", c: "#58a6ff", label: "Pending", icon: "○" },
  };
  const v = cfg[verdict] || cfg.pending;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: v.bg, color: v.c }}>
      {v.icon} {v.label}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 hover:border-[#008c98] transition-all hover:-translate-y-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8b949e] mb-2">{label}</div>
      <div className={`${color} text-3xl font-bold tracking-tight`}>{value}</div>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; branch?: string }>;
}) {
  const { tab = "prs", branch: branchFilter = "all" } = await searchParams;
  const { owner, repo } = parseRepo();

  if (!owner || !repo) {
    return (
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-[#161b22] border border-[#30363d] rounded-xl">
          <h1 className="text-xl font-bold text-[#f85149] mb-2">Not Configured</h1>
          <p className="text-[#8b949e]">GITHUB_REPOSITORY env var is not set.</p>
        </div>
      </div>
    );
  }

  const octokit = makeOctokit();

  // Branches
  let branches: { name: string; isDefault: boolean }[] = [];
  let defaultBranch = "main";
  try {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    defaultBranch = repoData.default_branch;
    const { data: branchData } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
    branches = branchData.map((b) => ({ name: b.name, isDefault: b.name === defaultBranch }));
  } catch { /* skip */ }

  // PRs
  let prs: Array<{
    number: number; title: string; author: string; avatar: string;
    branch: string; state: string; merged: boolean; updatedAt: string;
    verdict: string; findings: number; reviewDate: string;
  }> = [];
  try {
    const { data: pulls } = await octokit.rest.pulls.list({
      owner, repo, state: "all", per_page: 25, sort: "updated", direction: "desc",
    });
    for (const pr of pulls) {
      let verdict = "pending";
      let count = 0;
      let reviewDate = pr.updated_at;
      try {
        const { data: comments } = await octokit.rest.issues.listComments({
          owner, repo, issue_number: pr.number, per_page: 100,
        });
        const bot = comments.find(
          (c) => (c.body || "").includes(SUMMARY_MARKER) || (c.body || "").includes(LEGACY_SUMMARY_MARKER)
        );
        if (bot) {
          verdict = verdictFromBody(bot.body || "");
          count = findingsCount(bot.body || "");
          reviewDate = bot.created_at;
        }
      } catch { /* skip */ }
      prs.push({
        number: pr.number, title: pr.title,
        author: pr.user?.login || "unknown", avatar: pr.user?.avatar_url || "",
        branch: pr.head.ref, state: pr.state, merged: pr.merged_at !== null,
        updatedAt: pr.updated_at, verdict, findings: count, reviewDate,
      });
    }
  } catch { /* skip */ }

  // Commits
  let commits: Array<{ sha: string; message: string; author: string; avatar: string; date: string }> = [];
  try {
    const targetBranch = branchFilter !== "all" ? branchFilter : defaultBranch;
    const { data: cData } = await octokit.rest.repos.listCommits({ owner, repo, sha: targetBranch, per_page: 30 });
    commits = cData.map((c) => ({
      sha: c.sha, message: c.commit.message.split("\n")[0],
      author: c.author?.login || c.commit.author?.name || "unknown",
      avatar: c.author?.avatar_url || "", date: c.commit.author?.date || "",
    }));
  } catch { /* skip */ }

  const successCount = prs.filter((p) => p.verdict === "success").length;
  const failureCount = prs.filter((p) => p.verdict === "failure").length;
  const otherCount = prs.length - successCount - failureCount;

  const buildUrl = (t: string, b?: string) => `/dashboard?tab=${t}&branch=${b || branchFilter}`;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-[#161b22] border-r border-[#30363d] p-6 flex flex-col fixed h-screen overflow-y-auto">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.jpg" alt="CodeBadger" className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-bold text-lg">{COMPANY_NAME}</span>
          </div>
          <div className="bg-[rgba(0,140,152,0.12)] border border-[rgba(0,140,152,0.25)] text-[#00b4c4] px-3 py-2 rounded-lg text-sm font-semibold mb-8 break-all">
            {owner}/{repo}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8b949e] mb-3">Navigation</div>
          {(["prs", "commits", "branches"] as const).map((t) => (
            <Link key={t} href={buildUrl(t)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${
                tab === t ? "bg-[rgba(0,140,152,0.15)] text-[#00b4c4]" : "text-[#8b949e] hover:bg-[#1c2128] hover:text-[#c9d1d9]"
              }`}
            >
              {t === "prs" ? "🔀 Pull Requests" : t === "commits" ? "📦 Commits" : "🌿 Branches"}
            </Link>
          ))}
        </aside>

        {/* Main */}
        <main className="ml-64 flex-1 p-8 max-w-6xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight mb-1">
              {tab === "prs" ? "Pull Request Reviews" : tab === "commits" ? "Commit Reviews" : "Branch Controls"}
            </h1>
            <p className="text-[#8b949e] text-sm">AI-powered code review for {owner}/{repo}</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#161b22] border border-[#30363d] rounded-xl p-1 mb-6 w-fit">
            {(["prs", "commits", "branches"] as const).map((t) => (
              <Link key={t} href={buildUrl(t)}
                className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tab === t ? "bg-[#008c98] text-white" : "text-[#8b949e] hover:text-[#c9d1d9]"
                }`}
              >
                {t === "prs" ? "🔀 PRs" : t === "commits" ? "📦 Commits" : "🌿 Branches"}
                <span className="bg-[rgba(255,255,255,0.2)] px-2 py-0.5 rounded-full text-xs ml-1">
                  {t === "prs" ? prs.length : t === "commits" ? commits.length : branches.length}
                </span>
              </Link>
            ))}
          </div>

          {/* ========= PRS ========= */}
          {tab === "prs" && (
            <>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="Total PRs" value={prs.length} color="text-[#c9d1d9]" />
                <StatCard label="Approved" value={successCount} color="text-[#3fb950]" />
                <StatCard label="Changes Required" value={failureCount} color="text-[#f85149]" />
                <StatCard label="Other" value={otherCount} color="text-[#d29922]" />
              </div>
              <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Recent Pull Requests</h2>
                  <span className="bg-[#0d1117] text-[#8b949e] px-2 py-0.5 rounded text-xs font-semibold">{prs.length}</span>
                </div>
                {prs.length === 0 ? (
                  <div className="text-center py-16 text-[#8b949e]">
                    <h3 className="text-lg font-semibold text-[#c9d1d9] mb-1">No pull requests found</h3>
                    <p className="text-sm">Reviews will appear here once the bot processes PRs.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-[#8b949e] bg-[rgba(255,255,255,0.02)]">
                        <th className="text-left px-5 py-3">Pull Request</th>
                        <th className="text-left px-5 py-3">Author</th>
                        <th className="text-left px-5 py-3">Branch</th>
                        <th className="text-left px-5 py-3">Status</th>
                        <th className="text-left px-5 py-3">Findings</th>
                        <th className="text-left px-5 py-3">Updated</th>
                        <th className="text-left px-5 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prs.map((pr) => (
                        <tr key={pr.number} className="border-t border-[#30363d] hover:bg-[#1c2128] transition-colors">
                          <td className="px-5 py-3">
                            <div className="font-medium truncate max-w-[300px]">
                              <a href={`https://github.com/${owner}/${repo}/pull/${pr.number}`} target="_blank" rel="noopener noreferrer"
                                className="hover:text-[#00b4c4] transition-colors">{pr.title}</a>
                            </div>
                            <div className="text-[#8b949e] text-xs font-mono">#{pr.number}</div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2 text-[#8b949e] text-sm">
                              <img src={pr.avatar} alt="" className="w-5 h-5 rounded-full"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              {pr.author}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <code className="text-xs font-mono text-[#8b949e] bg-[#0d1117] px-2 py-0.5 rounded">{pr.branch}</code>
                          </td>
                          <td className="px-5 py-3"><VerdictBadge verdict={pr.verdict} /></td>
                          <td className="px-5 py-3">
                            <span className={`font-bold text-sm ${pr.findings > 0 ? "text-[#f85149]" : "text-[#8b949e]"}`}>{pr.findings}</span>
                          </td>
                          <td className="px-5 py-3 text-[#8b949e] text-xs">
                            {new Date(pr.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-5 py-3">
                            <Link href={`/dashboard/pr/${pr.number}`}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold border border-[#30363d] bg-[#0d1117] text-[#8b949e] hover:border-[#008c98] hover:text-[#00b4c4] transition-colors">
                              Details →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {/* ========= COMMITS ========= */}
          {tab === "commits" && (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent Commits</h2>
                <span className="bg-[#0d1117] text-[#8b949e] px-2 py-0.5 rounded text-xs font-semibold">{commits.length}</span>
              </div>
              {commits.length === 0 ? (
                <div className="text-center py-16 text-[#8b949e]">
                  <h3 className="text-lg font-semibold text-[#c9d1d9] mb-1">No commits found</h3>
                  <p className="text-sm">Select a branch to view commits.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#8b949e] bg-[rgba(255,255,255,0.02)]">
                      <th className="text-left px-5 py-3">Commit</th>
                      <th className="text-left px-5 py-3">Message</th>
                      <th className="text-left px-5 py-3">Author</th>
                      <th className="text-left px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commits.map((c) => (
                      <tr key={c.sha} className="border-t border-[#30363d] hover:bg-[#1c2128] transition-colors">
                        <td className="px-5 py-3">
                          <a href={`https://github.com/${owner}/${repo}/commit/${c.sha}`} target="_blank" rel="noopener noreferrer"
                            className="font-mono text-xs text-[#00b4c4] bg-[rgba(0,140,152,0.1)] px-2 py-0.5 rounded hover:bg-[rgba(0,140,152,0.2)] transition-colors">
                            {c.sha.slice(0, 7)}
                          </a>
                        </td>
                        <td className="px-5 py-3"><div className="truncate max-w-[350px]" title={c.message}>{c.message}</div></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2 text-[#8b949e] text-sm">
                            <img src={c.avatar} alt="" className="w-4 h-4 rounded-full"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            {c.author}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[#8b949e] text-xs">
                          {c.date ? new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ========= BRANCHES ========= */}
          {tab === "branches" && (
            <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#30363d] flex items-center justify-between">
                <h2 className="text-sm font-semibold">Branches</h2>
                <span className="bg-[#0d1117] text-[#8b949e] px-2 py-0.5 rounded text-xs font-semibold">{branches.length}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#8b949e] bg-[rgba(255,255,255,0.02)]">
                    <th className="text-left px-5 py-3">Branch</th>
                    <th className="text-left px-5 py-3">Status</th>
                    <th className="text-left px-5 py-3">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b.name} className="border-t border-[#30363d] hover:bg-[#1c2128] transition-colors">
                      <td className="px-5 py-3"><code className="font-mono text-sm text-[#00b4c4]">{b.name}</code></td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[rgba(63,185,80,0.15)] text-[#3fb950]">● Active</span>
                      </td>
                      <td className="px-5 py-3">
                        {b.isDefault ? <span className="text-[#3fb950] text-xs font-semibold">✓ Default</span> : <span className="text-[#8b949e] text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
