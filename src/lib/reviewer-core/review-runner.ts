// Core orchestrator. Merges deterministic scanner findings with AI findings,
// computes the verdict client-side (never trusts the model to decide fail/pass),
// and renders comments with ```suggestion blocks for the native Apply button.

import { CODEBADGER_LOGO_URL, COMPANY_NAME, BOT_NAME } from '@/lib/branding';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const SEVERITY_ICON: Record<string, string> = {
  critical: '🛑',
  high: '⚠️',
  medium: '🟡',
  low: '🔵',
  info: 'ℹ️',
};
const SOURCE_ICON: Record<string, string> = {
  scanner: '🔍',
  ai: '🦡',
};

export async function runReview({ cfg, provider, systemPrompt, userPrompt }: { cfg: any; provider: any; systemPrompt: string; userPrompt: string }) {
  const raw = await provider.review({
    system: systemPrompt,
    user: userPrompt,
    model: cfg.model,
    temperature: cfg.temperature,
    maxOutputTokens: cfg.maxOutputTokens,
  });

  const parsed = safeParseJson(raw);
  if (!parsed) {
    throw new Error(`Model returned invalid JSON. First 500 chars:\n${raw.slice(0, 500)}`);
  }

  const findings = Array.isArray(parsed.findings) ? parsed.findings : [];
  for (const f of findings) f.source = 'ai';

  return {
    summary: parsed.summary || '',
    findings,
  };
}

/**
 * Merge deterministic scanner findings with AI findings and drop duplicates on
 * the (file, line, category) triple. Scanner findings win — they are always
 * correct by construction, and the AI's version might soften the severity.
 */
export function mergeFindings(scannerFindings: any[], aiFindings: any[]) {
  const seen = new Set();
  const merged: any[] = [];
  const push = (f: any) => {
    const key = `${f.file}::${f.line}::${f.category}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(f);
  };
  (scannerFindings || []).forEach(push);
  (aiFindings || []).forEach(push);
  merged.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  return merged;
}

/**
 * Client-side verdict. The AI's own verdict is ignored — we decide based on
 * merged findings so no clever prompt can talk us into approving a critical break.
 */
export function computeVerdict(findings: any[], failOnSeverity: string[] = ['critical', 'high']) {
  if (findings.some((f) => failOnSeverity.includes(f.severity))) return 'request_changes';
  return 'comment'; // never auto-approve — humans still stamp
}

export function findingsToComments(findings: any[]) {
  return findings.map((f) => ({
    path: f.file,
    line: f.line,
    endLine: f.endLine,
    body: renderCommentBody(f),
    fingerprint: fingerprintOf(f),
  }));
}

// Stable per-finding identity used for cross-run dedup.
export function fingerprintOf(f: any) {
  const rule = f.scannerRuleId || slugify(f.title || 'unknown');
  const file = String(f.file || 'x').replace(/[^a-z0-9._/-]/gi, '_');
  const cat = String(f.category || 'x').replace(/[^a-z0-9]/gi, '_');
  const end = f.endLine && f.endLine > f.line ? f.endLine : f.line;
  return `${file}::${f.line}::${end}::${cat}::${rule}`;
}

function slugify(s: string) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'x';
}

function renderCommentBody(f: any) {
  const sevIcon = SEVERITY_ICON[f.severity] || '•';
  const srcIcon = SOURCE_ICON[f.source] || '🦡';
  const parts = [
    `${sevIcon} **${(f.severity || 'info').toUpperCase()} · ${f.category || 'rule'}** — ${f.title}`,
    '',
    f.explanation,
  ];
  if (f.ruleRef) parts.push('', `📖 _${f.ruleRef}_`);
  if (typeof f.suggestion === 'string') {
    parts.push('', '```suggestion', f.suggestion, '```');
  }
  parts.push('', `${srcIcon} _${f.source === 'scanner' ? 'Deterministic rules scanner' : 'AI reviewer'} — ${BOT_NAME}_`);
  parts.push(`<!-- codebadger-ai-review-fp:${fingerprintOf(f)} -->`);
  return parts.join('\n');
}

export function renderSummary({ summary, findings, verdict, provider, model }: { summary: string; findings: any[]; verdict: string; provider: string; model: string }) {
  const counts = (findings || []).reduce((acc: Record<string, number>, f: any) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  const bySource = (findings || []).reduce(
    (acc: { ai: number; scanner: number }, f: any) => {
      if (f.source === 'scanner') acc.scanner++;
      else acc.ai++;
      return acc;
    },
    { ai: 0, scanner: 0 },
  );

  const verdictLabel = ({
    approve: '✅ **Approve** — no blocking issues.',
    comment: '💬 **Comment** — please review the notes below.',
    request_changes: '🛑 **Changes required** — critical rule violations found. This check blocks merge.',
  } as Record<string, string>)[verdict] || verdict;

  const badge =
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([sev, n]) => `${SEVERITY_ICON[sev] || '•'} ${n} ${sev}`)
      .join(' · ') || '✨ No findings.';

  const sourceLine = `🔍 Deterministic scan: ${bySource.scanner} · 🦡 AI review: ${bySource.ai}`;

  return [
    `## <img src="${CODEBADGER_LOGO_URL}" width="28" height="28" alt="${COMPANY_NAME}" align="absmiddle" /> ${BOT_NAME}`,
    ``,
    verdictLabel,
    ``,
    `**Findings**: ${badge}`,
    `**Source**: ${sourceLine}`,
    ``,
    summary?.trim() ? summary.trim() : '_(no additional summary from AI)_',
    ``,
    `---`,
    `<sub>Reviewed by **${COMPANY_NAME}** against \`rules.md\` + \`.github/copilot-instructions.md\` + \`.github/instructions/*.md\`. AI: \`${provider}\` / \`${model}\`. The deterministic scanner independently checks hardcoded colors, forbidden Angular APIs, direct HttpClient in components, subscription safety, inline endpoints, and hardcoded strings — those findings cannot be suppressed by the model.</sub>`,
  ].join('\n');
}

function safeParseJson(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        /* fall through */
      }
    }
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {
        /* give up */
      }
    }
    return null;
  }
}
