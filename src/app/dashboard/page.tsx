// src/app/dashboard/page.tsx
/**
 * Public-facing dashboard for each customer's Data Plane deployment.
 * Shows PRs with review status, branches, and commit status.
 */
import Link from "next/link";
import { makeOctokit } from "@/lib/providers/github";
import { SUMMARY_MARKER, LEGACY_SUMMARY_MARKER } from "@/lib/branding";
import {
  AppShell, PageHeader, StatCard, VerdictBadge, EmptyState,
  IconPullRequest, IconArrowRight, IconExternal,
} from "@/components/ui";

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

function relativeTime(dateStr: string): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TABS = [
  { key: "prs", label: "Pull Requests", short: "PRs" },
  { key: "commits", label: "Commits", short: "Commits" },
  { key: "branches", label: "Branches", short: "Branches" },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; branch?: string }>;
}) {
  const { tab = "prs", branch: branchFilter = "all" } = await searchParams;
  const activeTab = (TABS.some((t) => t.key === tab) ? tab : "prs") as string;
  const { owner, repo } = parseRepo();

  if (!owner || !repo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-fg">
        <div className="cb-fade-up max-w-md rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-accent">Dataplane not configured</h1>
          <p className="text-sm text-fg-3">
            Set the <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-xs text-fg-2">GITHUB_REPOSITORY</code>{" "}
            environment variable to enable the dashboard.
          </p>
        </div>
      </div>
    );
  }

  const octokit = await makeOctokit();

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
  const criticalFindings = failureCount;

  return (
    <AppShell active={activeTab} owner={owner} repo={repo}>
      <PageHeader
        title={activeTab === "prs" ? "Pull Request Reviews" : activeTab === "commits" ? "Commit Activity" : "Branches"}
        description={`AI-powered code review for ${owner}/${repo}`}
      >
        <a
          href={`https://github.com/${owner}/${repo}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-fg-2 transition-colors duration-150 hover:border-line-strong hover:text-fg"
        >
          <IconExternal className="h-3.5 w-3.5" />
          Repository
        </a>
      </PageHeader>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-xl border border-line-subtle bg-surface p-1">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          const count = t.key === "prs" ? prs.length : t.key === "commits" ? commits.length : branches.length;
          return (
            <Link
              key={t.key}
              href={buildUrl(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-150 ${
                isActive ? "bg-raised text-fg shadow-[inset_0_0_0_1px_var(--border)]" : "text-fg-3 hover:text-fg-2"
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums ${isActive ? "bg-accent-soft text-accent" : "bg-raised text-fg-3"}`}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      {/* ========= PRS ========= */}
      {activeTab === "prs" && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total PRs" value={prs.length} hint="last 25 by activity" />
            <StatCard label="Approved" value={successCount} tone="success" />
            <StatCard label="Changes Required" value={failureCount} tone="failure" />
            <StatCard label="In Review" value={otherCount} tone="warning" />
          </div>

          <section className="overflow-hidden rounded-xl border border-line-subtle bg-surface cb-fade-up" style={{ animationDelay: "60ms" }}>
            <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3">
              <h2 className="text-sm font-semibold text-fg">Recent Pull Requests</h2>
              {criticalFindings > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-border bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  {failureCount} requiring changes
                </span>
              )}
            </div>

            {prs.length === 0 ? (
              <EmptyState
                title="No pull requests yet"
                body="Reviews will appear here as soon as the AI reviewer processes its first pull request on this repository."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line-subtle text-left text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">
                      <th className="px-5 py-2.5 font-medium">Pull Request</th>
                      <th className="px-5 py-2.5 font-medium">Author</th>
                      <th className="hidden px-5 py-2.5 font-medium md:table-cell">Branch</th>
                      <th className="px-5 py-2.5 font-medium">Status</th>
                      <th className="px-5 py-2.5 font-medium">Findings</th>
                      <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Reviewed</th>
                      <th className="px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {prs.map((pr, i) => (
                      <tr
                        key={pr.number}
                        className="cb-fade-in border-t border-line-subtle transition-colors duration-150 hover:bg-raised/60"
                        style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                      >
                        <td className="max-w-[320px] px-5 py-3">
                          <Link
                            href={`/dashboard/pr/${pr.number}`}
                            className="block truncate font-medium text-fg transition-colors duration-150 hover:text-accent"
                            title={pr.title}
                          >
                            {pr.title}
                          </Link>
                          <span className="font-mono text-xs text-fg-3">#{pr.number}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-2 text-fg-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pr.avatar} alt="" className="h-5 w-5 rounded-full ring-1 ring-line" loading="lazy" />
                            <span className="truncate">{pr.author}</span>
                          </span>
                        </td>
                        <td className="hidden px-5 py-3 md:table-cell">
                          <code className="rounded-md border border-line-subtle bg-raised px-2 py-0.5 font-mono text-xs text-fg-3">{pr.branch}</code>
                        </td>
                        <td className="px-5 py-3"><VerdictBadge verdict={pr.verdict} /></td>
                        <td className="px-5 py-3">
                          {pr.findings > 0 ? (
                            <span className="inline-flex min-w-6 justify-center rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-semibold tabular-nums text-accent">
                              {pr.findings}
                            </span>
                          ) : (
                            <span className="text-xs tabular-nums text-fg-3">0</span>
                          )}
                        </td>
                        <td className="hidden px-5 py-3 text-xs text-fg-3 sm:table-cell" title={pr.reviewDate}>
                          {relativeTime(pr.reviewDate)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/dashboard/pr/${pr.number}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-line-subtle bg-raised px-2.5 py-1 text-xs font-semibold text-fg-3 transition-colors duration-150 hover:border-accent-border hover:text-fg"
                          >
                            Review
                            <IconArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* ========= COMMITS ========= */}
      {activeTab === "commits" && (
        <section className="overflow-hidden rounded-xl border border-line-subtle bg-surface cb-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3">
            <h2 className="text-sm font-semibold text-fg">Recent Commits</h2>
            <form method="get" action="/dashboard" className="flex items-center gap-2">
              <input type="hidden" name="tab" value="commits" />
              <label htmlFor="branch-select" className="text-xs text-fg-3">Branch</label>
              <select
                id="branch-select"
                name="branch"
                defaultValue={branchFilter}
                className="max-w-[180px] rounded-lg border border-line bg-raised px-2.5 py-1.5 font-mono text-xs text-fg-2 transition-colors duration-150 hover:border-line-strong focus:border-accent-border"
              >
                <option value="all">All · default</option>
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>{b.name}{b.isDefault ? " (default)" : ""}</option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-semibold text-fg-2 transition-colors duration-150 hover:border-accent-border hover:text-fg"
              >
                View
              </button>
            </form>
          </div>

          {commits.length === 0 ? (
            <EmptyState
              title="No commits found"
              body="Pick a branch above to browse its recent commits, or check that the repository has activity on the default branch."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">
                    <th className="px-5 py-2.5 font-medium">Commit</th>
                    <th className="px-5 py-2.5 font-medium">Message</th>
                    <th className="hidden px-5 py-2.5 font-medium sm:table-cell">Author</th>
                    <th className="hidden px-5 py-2.5 font-medium md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commits.map((c, i) => (
                    <tr
                      key={c.sha}
                      className="cb-fade-in border-t border-line-subtle transition-colors duration-150 hover:bg-raised/60"
                      style={{ animationDelay: `${Math.min(i * 25, 250)}ms` }}
                    >
                      <td className="px-5 py-3">
                        <a
                          href={`https://github.com/${owner}/${repo}/commit/${c.sha}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-line-subtle bg-raised px-2 py-0.5 font-mono text-xs text-fg-2 transition-colors duration-150 hover:border-accent-border hover:text-accent"
                        >
                          {c.sha.slice(0, 7)}
                        </a>
                      </td>
                      <td className="max-w-[380px] px-5 py-3">
                        <div className="truncate text-fg-2" title={c.message}>{c.message}</div>
                      </td>
                      <td className="hidden px-5 py-3 sm:table-cell">
                        <span className="flex items-center gap-2 text-fg-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.avatar} alt="" className="h-4 w-4 rounded-full ring-1 ring-line" loading="lazy" />
                          <span className="truncate">{c.author}</span>
                        </span>
                      </td>
                      <td className="hidden px-5 py-3 text-xs text-fg-3 md:table-cell">
                        {c.date ? new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ========= BRANCHES ========= */}
      {activeTab === "branches" && (
        <section className="overflow-hidden rounded-xl border border-line-subtle bg-surface cb-fade-up">
          <div className="flex items-center justify-between border-b border-line-subtle px-5 py-3">
            <h2 className="text-sm font-semibold text-fg">Branches</h2>
            <span className="rounded-full border border-line-subtle bg-raised px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-fg-3">{branches.length}</span>
          </div>
          {branches.length === 0 ? (
            <EmptyState title="No branches found" body="Branches will appear once the repository reports them through GitHub." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-subtle text-left text-[11px] font-medium uppercase tracking-[0.08em] text-fg-3">
                    <th className="px-5 py-2.5 font-medium">Branch</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                    <th className="px-5 py-2.5 font-medium">Default</th>
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b, i) => (
                    <tr
                      key={b.name}
                      className="cb-fade-in border-t border-line-subtle transition-colors duration-150 hover:bg-raised/60"
                      style={{ animationDelay: `${Math.min(i * 20, 200)}ms` }}
                    >
                      <td className="px-5 py-3">
                        <code className="font-mono text-xs text-fg-2">{b.name}</code>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" />
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {b.isDefault ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                            <IconPullRequest className="hidden" />
                            Default
                          </span>
                        ) : (
                          <span className="text-xs text-fg-3">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
