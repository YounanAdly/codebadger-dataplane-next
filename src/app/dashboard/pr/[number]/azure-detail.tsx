// src/app/dashboard/pr/[number]/azure-detail.tsx
// Azure DevOps variant of the PR detail page — shares the same visual
// language as the GitHub variant (AppShell, verdict/severity badges) but
// reads PRs, threads, and inline findings from Azure DevOps REST using the
// deployment's fresh Entra token (legacy PAT fallback).

import Link from "next/link";
import {
  getAzureDashboardContext,
  getAzurePullRequestDetail,
} from "@/lib/dashboard/azure";
import {
  AppShell, VerdictBadge, SeverityBadge, EmptyState, SEVERITY_CFG,
  IconArrowLeft, IconExternal, type Severity,
} from "@/components/ui";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function Frame({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-fg">
      <div className="cb-fade-up max-w-md rounded-xl border border-line bg-surface p-8 text-center">
        <h1 className="mb-2 text-lg font-semibold text-accent">{title}</h1>
        <p className="text-sm text-fg-3">{body}</p>
        <Link href="/dashboard" className="mt-4 inline-block text-sm text-fg-2 underline-offset-4 hover:text-fg hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

export default async function AzurePrDetail({
  prNum,
  linkQs = "",
}: {
  prNum: number;
  linkQs?: string;
}) {
  const ctx = await getAzureDashboardContext();
  if (!ctx) {
    return <Frame title="Dataplane not configured" body="Azure DevOps credentials for this deployment could not be resolved." />;
  }

  if (isNaN(prNum)) {
    return <Frame title="Invalid request" body="Could not load this pull request." />;
  }

  const detail = await getAzurePullRequestDetail(ctx, prNum);
  if (!detail) {
    return (
      <Frame
        title="PR not found"
        body={`Pull request #${prNum} could not be loaded from ${ctx.org}/${ctx.repoName}.`}
      />
    );
  }

  const counts = detail.findings.reduce((a: Record<string, number>, f) => {
    a[f.severity] = (a[f.severity] || 0) + 1;
    return a;
  }, {});

  let verdict = "pending";
  let verdictLabel = "Pending Review";
  if (detail.summaryBody) {
    if (detail.summaryBody.includes("Changes required")) { verdict = "failure"; verdictLabel = "Changes Required"; }
    else if (detail.summaryBody.includes("Approve")) { verdict = "success"; verdictLabel = "Approved"; }
    else { verdict = "comment"; verdictLabel = "Comment"; }
  }

  const stateLabel =
    detail.state === "active" ? "Open"
    : detail.state === "completed" ? "Completed"
    : detail.state === "abandoned" ? "Abandoned"
    : detail.state;
  const criticalCount = counts["critical"] || 0;

  return (
    <AppShell active="prs" owner={ctx.org} repo={ctx.repoName} linkQs={linkQs}>
      <Link
        href={`/dashboard${linkQs ? `?${linkQs}` : ""}`}
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-3 transition-colors duration-150 hover:text-fg"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        Back to dashboard
      </Link>

      {/* PR header */}
      <header className="cb-fade-up mb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="max-w-3xl text-lg font-semibold leading-snug tracking-tight text-fg">{esc(detail.title)}</h1>
          <a
            href={detail.webUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-accent-hover"
          >
            <IconExternal className="h-3.5 w-3.5" />
            View in Azure DevOps
          </a>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-fg-3">
          <span className="flex items-center gap-1.5 text-fg-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[10px] font-semibold text-fg-2">
              {detail.author.slice(0, 1).toUpperCase()}
            </span>
            {detail.author}
          </span>
          <span className="font-mono text-xs">#{prNum}</span>
          <span className="font-mono text-xs">
            <span className="text-fg-2">{detail.sourceBranch}</span>
            <span className="mx-1 text-fg-3">→</span>
            <span className="text-fg-2">{detail.targetBranch}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${detail.state === "active" ? "bg-success" : "bg-fg-3"}`} />
            {stateLabel}
          </span>
        </div>
      </header>

      {/* Verdict */}
      <div className="cb-fade-up mb-6 flex flex-wrap items-center gap-3" style={{ animationDelay: "40ms" }}>
        <VerdictBadge verdict={verdict} size="lg" />
        <span className="text-sm text-fg-3">{verdictLabel}</span>
      </div>

      {/* Findings overview */}
      {detail.findings.length > 0 && (
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
              {detail.findings.length} finding{detail.findings.length === 1 ? "" : "s"}
              {criticalCount > 0 && <span className="ml-1 font-semibold text-accent">· {criticalCount} critical</span>}
            </div>
          </div>
        </div>
      )}

      {/* Findings */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Review Findings</h2>
      </div>

      {!detail.summaryBody ? (
        <div className="rounded-xl border border-line-subtle bg-surface">
          <EmptyState
            title="Not reviewed yet"
            body="The AI reviewer hasn't processed this pull request. Push a new commit or trigger a review to generate findings."
            cta={{ href: detail.webUrl, label: "Open pull request", external: true }}
          />
        </div>
      ) : detail.findings.length === 0 ? (
        <div className="rounded-xl border border-success-border bg-success-soft/40">
          <EmptyState
            title="Clean review"
            body="No rule violations were found in this pull request. Nice work."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {detail.findings.map((f, i) => {
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
                  <span
                    className="shrink-0 rounded-md border border-line-subtle bg-raised px-2 py-1 font-mono text-[11px] text-fg-3"
                    title={f.path}
                  >
                    {f.path}:{f.line}
                  </span>
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
