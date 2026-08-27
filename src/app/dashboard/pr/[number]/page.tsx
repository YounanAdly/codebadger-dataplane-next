// src/app/dashboard/pr/[number]/page.tsx
/**
 * PR Detail page — shows bot review summary, findings with severity, suggested changes.
 */
import Link from "next/link";
import { makeOctokit } from "@/lib/providers/github";
import { SUMMARY_MARKER, LEGACY_SUMMARY_MARKER, FINGERPRINT_REGEX } from "@/lib/branding";

const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "";

function parseRepo(): { owner: string; repo: string } {
  if (!GITHUB_REPOSITORY) return { owner: "", repo: "" };
  const [owner, repo] = GITHUB_REPOSITORY.split("/");
  return { owner, repo };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SEV: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  critical: { icon: "🛑", label: "Critical", color: "#f85149", bg: "rgba(248,81,73,0.12)", border: "rgba(248,81,73,0.35)" },
  high: { icon: "⚠️", label: "High", color: "#d29922", bg: "rgba(210,153,34,0.12)", border: "rgba(210,153,34,0.35)" },
  medium: { icon: "🟡", label: "Medium", color: "#e3b341", bg: "rgba(227,179,65,0.12)", border: "rgba(227,179,65,0.35)" },
  low: { icon: "🔵", label: "Low", color: "#58a6ff", bg: "rgba(88,166,255,0.12)", border: "rgba(88,166,255,0.35)" },
  info: { icon: "ℹ️", label: "Info", color: "#8b949e", bg: "rgba(139,148,158,0.12)", border: "rgba(139,148,158,0.35)" },
};

const VC: Record<string, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: "rgba(63,185,80,0.15)", border: "rgba(63,185,80,0.3)", color: "#3fb950", icon: "✓" },
  failure: { bg: "rgba(248,81,73,0.15)", border: "rgba(248,81,73,0.3)", color: "#f85149", icon: "✕" },
  comment: { bg: "rgba(210,153,34,0.15)", border: "rgba(210,153,34,0.3)", color: "#d29922", icon: "●" },
  pending: { bg: "rgba(88,166,255,0.15)", border: "rgba(88,166,255,0.3)", color: "#58a6ff", icon: "○" },
};

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
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-[#161b22] border border-[#30363d] rounded-xl">
          <h1 className="text-xl font-bold text-[#f85149] mb-2">Invalid</h1>
          <p className="text-[#8b949e]">Could not load PR.</p>
        </div>
      </div>
    );
  }

  const octokit = makeOctokit();

  let pull: any;
  try {
    const { data } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNum });
    pull = data;
  } catch {
    return (
      <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9] flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-[#161b22] border border-[#30363d] rounded-xl">
          <h1 className="text-xl font-bold text-[#f85149] mb-2">PR Not Found</h1>
          <p className="text-[#8b949e]">PR #{prNum} could not be loaded.</p>
          <Link href="/dashboard" className="inline-block mt-4 text-[#00b4c4] hover:underline">← Back</Link>
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
  const vc = VC[verdict] || VC.pending;

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#c9d1d9]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-60 bg-[#161b22] border-r border-[#30363d] p-6 flex flex-col fixed h-screen">
          <div className="flex items-center gap-3 mb-8">
            <img src="/logo.jpg" alt="CodeBadger" className="w-10 h-10 rounded-xl object-cover" />
            <span className="font-bold text-lg">CodeBadger</span>
          </div>
          <div className="bg-[rgba(0,140,152,0.12)] border border-[rgba(0,140,152,0.25)] text-[#00b4c4] px-3 py-2 rounded-lg text-sm font-semibold break-all">
            {owner}/{repo}
          </div>
        </aside>

        {/* Main */}
        <main className="ml-60 flex-1 p-8 max-w-4xl">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#8b949e] hover:text-[#00b4c4] mb-6 transition-colors">
            ← Back to Dashboard
          </Link>

          {/* PR Header */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 mb-5">
            <h1 className="text-xl font-bold tracking-tight mb-3 leading-snug">{esc(pull.title)}</h1>
            <div className="flex items-center gap-5 text-sm text-[#8b949e] flex-wrap">
              <span className="flex items-center gap-1.5">
                <img src={pull.user?.avatar_url || ""} alt="" className="w-5 h-5 rounded-full"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                {pull.user?.login || "unknown"}
              </span>
              <span>
                <a href={`https://github.com/${owner}/${repo}/pull/${prNum}`} target="_blank" rel="noopener noreferrer"
                  className="text-[#00b4c4] font-medium hover:underline">PR #{prNum}</a>
              </span>
              <span className="font-mono text-xs">{pull.head?.ref} → {pull.base?.ref}</span>
              <span>{pull.merged ? "✓ Merged" : pull.state === "closed" ? "✕ Closed" : "● Open"}</span>
            </div>
          </div>

          {/* Verdict + GitHub link */}
          <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm"
              style={{ backgroundColor: vc.bg, color: vc.color, border: `1px solid ${vc.border}` }}>
              {vc.icon} {verdictLabel}
            </div>
            <a href={`https://github.com/${owner}/${repo}/pull/${prNum}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#008c98] text-white text-sm font-semibold hover:bg-[#00b4c4] transition-colors">
              View on GitHub
            </a>
          </div>

          {/* Severity chips */}
          <div className="flex gap-3 mb-6 flex-wrap">
            {Object.entries(counts).map(([sev, count]) => {
              const s = SEV[sev] || SEV.info;
              return (
                <div key={sev} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ color: s.color, border: `1px solid ${s.border}`, backgroundColor: s.bg }}>
                  {s.icon} {s.label}: {count}
                </div>
              );
            })}
            {findings.length === 0 && botSummary && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ color: "#3fb950", border: "1px solid rgba(63,185,80,0.3)", backgroundColor: "rgba(63,185,80,0.12)" }}>
                ✨ No issues found
              </div>
            )}
            {!botSummary && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ color: "#58a6ff", border: "1px solid rgba(88,166,255,0.3)", backgroundColor: "rgba(88,166,255,0.12)" }}>
                ⏳ Not reviewed yet
              </div>
            )}
          </div>

          {/* Findings */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Review Findings</h2>
            <span className="bg-[#0d1117] text-[#8b949e] px-2 py-0.5 rounded text-xs font-semibold border border-[#30363d]">{findings.length}</span>
          </div>

          {!botSummary ? (
            <div className="text-center py-20 bg-[#161b22] border border-[#30363d] rounded-2xl">
              <h3 className="text-lg font-semibold text-[#c9d1d9] mb-1">⏳ Not Reviewed Yet</h3>
              <p className="text-[#8b949e] text-sm">The AI reviewer hasn&apos;t processed this PR yet.</p>
            </div>
          ) : findings.length === 0 ? (
            <div className="text-center py-20 bg-[#161b22] border border-[#30363d] rounded-2xl">
              <h3 className="text-lg font-semibold text-[#c9d1d9] mb-1">✨ Clean Code</h3>
              <p className="text-[#8b949e] text-sm">No rule violations found in this pull request.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {findings.map((f, i) => {
                const s = SEV[f.severity] || SEV.info;
                return (
                  <div key={i} className="bg-[#161b22] border rounded-2xl overflow-hidden" style={{ borderColor: s.border }}>
                    <div className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ backgroundColor: s.bg }}>
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
                          style={{ color: s.color, border: `1px solid ${s.border}` }}>
                          {s.icon} {s.label}
                        </span>
                        <span className="font-semibold text-sm" style={{ color: s.color }}>{esc(f.title)}</span>
                      </div>
                      <a href={`https://github.com/${owner}/${repo}/pull/${prNum}#discussion-${f.line}`} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-[#8b949e] bg-[#0d1117] px-2 py-1 rounded border border-[#30363d] hover:border-[#008c98] hover:text-[#00b4c4] transition-colors">
                        {f.path}:{f.line}
                      </a>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[#8b949e] text-sm leading-relaxed mb-4 whitespace-pre-wrap">{esc(f.explanation)}</p>
                      {f.suggestion && (
                        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 bg-[rgba(255,255,255,0.03)] border-b border-[#30363d]">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8b949e]">Suggested Change</span>
                          </div>
                          <pre className="p-4 text-sm font-mono text-[#c9d1d9] overflow-x-auto whitespace-pre leading-relaxed">{f.suggestion}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
