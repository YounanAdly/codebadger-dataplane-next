// src/app/dashboard/pr/[number]/page.tsx
/**
 * PR Detail page — shows bot review summary, findings with severity, suggested changes.
 */
import Link from "next/link";
import { makeOctokit } from "@/lib/providers/github";
import { SUMMARY_MARKER, LEGACY_SUMMARY_MARKER, FINGERPRINT_REGEX } from "@/lib/branding";
import {
  AppShell, VerdictBadge, SeverityBadge, EmptyState, SEVERITY_CFG,
  IconArrowLeft, IconExternal, type Severity,
} from "@/components/ui";

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";

function parseRepo(): { owner: string; repo: string } {
  if (!GITHUB_REPOSITORY) return { owner: "", repo: "" };
  const [owner, repo] = GITHUB_REPOSITORY.split("/");
  return { owner, repo };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

export default async function PRDetailPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: prNumStr } = await params;
  const prNum = parseInt(prNumStr, 10);
  const { owner, repo } = parseRepo();

  if (!owner || !repo || isNaN(prNum)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-fg">
        <div className="cb-fade-up max-w-md rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-accent">Invalid request</h1>
          <p className="text-sm text-fg-3">Could not load this pull request.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-fg-2 underline-offset-4 hover:text-fg hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const octokit = await makeOctokit();

  let pull: any;
  try {
    const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNum });
    pull = data;
  } catch {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-fg">
        <div className="cb-fade-up max-w-md rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="mb-2 text-lg font-semibold text-accent">PR not found</h1>
          <p className="text-sm text-fg-3">Pull request #{prNum} could not be loaded from {owner}/{repo}.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-fg-2 underline-offset-4 hover:text-fg hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Summary
  let botSummary: { body: string } | null = null;
  try {
    const { data: comments } = await octokit.rest.issues.listComments({ owner, repo, issue_number: prNum, per_page: 100 });
    const found = comments.find(
      (c) => (c.body || "").includes(SUMMARY_MARKER) || (c.body || "").includes(LEGACY_SUMMARY_MARKER)
    );
    if (found) botSummary = { body: found.body || "" };
  } catch { /* skip */ }

  // Findings
  const findings: Array<{ severity: string; title: string; explanation: string; suggestion: string | null; path: string; line: number }> = [];
  try {
    const { data: rc } = await octokit.rest.pulls.listReviewComments({ owner, repo, pull_number: prNum, per_page: 100 });
    for (const c of rc) {
      if (!FINGERPRINT_REGEX.test(c.body || "")) continue;
      const body = c.body || "";
      const sevChar = body.match(/(🛑|⚠️|🟡|🔵|ℹ️)/)?.[1];
      const severity = sevChar === "🛑" ? "critical" : sevChar === "⚠️" ? "high" : sevChar === "🟡" ? "medium" : sevChar === "🔵" ? "low" : "info";
      const title = body.match(/—\s*(.+?)(?:\n|$)/)?.[1]?.trim() || "Finding";
      let explanation = body.replace(/[🛑⚠️🟡🔵ℹ️]/g, "").replace(/—.*/, "").replace(/\*\*(?:CRITICAL|HIGH|MEDIUM|LOW|INFO)\*\*/gi, "")
        .replace(/📖 _.+?_/g, "").replace(/🦡 _.+?_/g, "").replace(/<!--.*?-->/g, "").replace(/\n{2,}/g, "\n").trim();
      explanation = explanation.split("```suggestion")[0].trim();
      const suggestion = body.match(/```suggestion\s*([\s\S]*?)```/)?.[1]?.trim() || null;
      findings.push({ severity, title, explanation: explanation || title, suggestion, path: (c.path || "").replace(/^\//, ""), line: c.position || c.original_line || 0 });
    }
  } catch { /* skip */ }

  findings.sort((a, b) => {
    const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (o[a.severity] ?? 9) - (o[b.severity] ?? 9);
  });

  const counts = findings.reduce((a: Record<string, number>, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {});

  let verdict = "pending";
  let verdictLabel = "Pending Review";
  if (botSummary) {
    if (botSummary.body.includes("Changes required")) { verdict = "failure"; verdictLabel = "Changes Required"; }
    else if (botSummary.body.includes("Approve")) { verdict = "success"; verdictLabel = "Approved"; }
    else { verdict = "comment"; verdictLabel = "Comment"; }
  }

  const prUrl = `https://github.com/${owner}/${repo}/pull/${prNum}`;
  const criticalCount = counts["critical"] || 0;

  return (
    <AppShell active="prs" owner={owner} repo={repo}>
      <Link
        href="/dashboard"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-3 transition-colors duration-150 hover:text-fg"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      {/* PR header */}
      <header className="cb-fade-up mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-3xl text-lg font-semibold leading-snug tracking-tight text-fg">{esc(pull.title)}</h1>
          <a
            href={prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            <IconExternal className="h-3.5 w-3.5" />
            View on GitHub
          </a>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fg-3">
          <span className="flex items-center gap-1.5 text-fg-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pull.user?.avatar_url || ""} alt="" className="h-5 w-5 rounded-full ring-1 ring-line" />
            {pull.user?.login || "unknown"}
          </span>
          <span className="font-mono text-xs">#{prNum}</span>
          <span className="font-mono text-xs">
            <span className="text-fg-2">{pull.head?.ref}</span>
            <span className="mx-1 text-fg-3">→</span>
            <span className="text-fg-2">{pull.base?.ref}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${pull.merged ? "bg-[#a371f7]" : pull.state === "closed" ? "bg-fg-3" : "bg-success"}`} />
            {pull.merged ? "Merged" : pull.state === "closed" ? "Closed" : "Open"}
          </span>
        </div>
      </header>

      {/* Verdict */}
      <div className="cb-fade-up mb-6 flex flex-wrap items-center gap-3" style={{ animationDelay: "40ms" }}>
        <VerdictBadge verdict={verdict} size="lg" />
        <span className="text-sm text-fg-3">{verdictLabel}</span>
      </div>

      {/* Findings overview */}
      {findings.length > 0 && (
        <div className="cb-fade-up mb-6 rounded-xl border border-line-subtle bg-surface p-4" style={{ animationDelay: "80ms" }}>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {SEVERITY_ORDER.filter((s) => counts[s]).map((sev) => {
              const cfg = SEVERITY_CFG[sev];
              return (
                <div key={sev} className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                  <span className="text-lg font-semibold tabular-nums text-fg">{counts[sev]}</span>
                  <span className="text-xs text-fg-3">{cfg.label}</span>
                </div>
              );
            })}
            <div className="ml-auto text-xs text-fg-3">
              {findings.length} finding{findings.length === 1 ? "" : "s"}
              {criticalCount > 0 && <span className="ml-1 font-semibold text-accent">· {criticalCount} critical</span>}
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Review Findings</h2>
      </div>

      {!botSummary ? (
        <div className="rounded-xl border border-line-subtle bg-surface">
          <EmptyState
            title="Not reviewed yet"
            body="The AI reviewer hasn't processed this pull request. Push a new commit or trigger a review to generate findings."
            cta={{ href: prUrl, label: "Open pull request", external: true }}
          />
        </div>
      ) : findings.length === 0 ? (
        <div className="rounded-xl border border-success-border bg-success-soft/40">
          <EmptyState
            title="Clean review"
            body="No rule violations were found in this pull request. Nice work."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f, i) => {
            const cfg = SEVERITY_CFG[(f.severity as Severity) in SEVERITY_CFG ? (f.severity as Severity) : "info"];
            return (
              <article
                key={i}
                id={`finding-${i}`}
                className="cb-fade-up group overflow-hidden rounded-xl border border-line-subtle bg-surface transition-colors duration-200 hover:border-line-strong"
                style={{ animationDelay: `${Math.min(120 + i * 50, 500)}ms` }}
              >
                <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <SeverityBadge severity={f.severity} />
                    <h3 className="text-sm font-semibold text-fg">{esc(f.title)}</h3>
                  </div>
                  <a
                    href={`${prUrl}/files${f.line ? `#discussion-${f.line}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-md border border-line-subtle bg-raised px-2 py-1 font-mono text-[11px] text-fg-3 transition-colors duration-150 hover:border-accent-border hover:text-fg-2"
                    title={`Open ${f.path} on GitHub`}
                  >
                    {f.path}:{f.line}
                  </a>
                </div>
                <div className="border-t border-line-subtle px-5 py-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg-2">{esc(f.explanation)}</p>
                  {f.suggestion && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-line-subtle">
                      <div className="flex items-center justify-between border-b border-line-subtle bg-raised px-4 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-3">Suggested change</span>
                        <span className="flex gap-1" aria-hidden="true">
                          <span className="h-2 w-2 rounded-full bg-accent/70" />
                          <span className="h-2 w-2 rounded-full bg-warning/60" />
                          <span className="h-2 w-2 rounded-full bg-success/60" />
                        </span>
                      </div>
                      <pre className="overflow-x-auto whitespace-pre bg-canvas px-4 py-3.5 font-mono text-[13px] leading-relaxed text-fg-2">{f.suggestion}</pre>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
