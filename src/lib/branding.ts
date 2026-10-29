// Branding configuration for Codrevia AI Review

export const COMPANY_NAME = 'Codrevia';
export const BOT_NAME = 'Codrevia AI Review';
export const BOT_ROLE = 'Codrevia Reviewer';

// Fallback logo URL (hosted on GitHub raw repo or custom domain/CDN)
export const LOGO_URL =
  process.env.CODREVIA_LOGO_URL ||
  (process.env.DATAPLANE_URL
    ? `${process.env.DATAPLANE_URL.replace(/\/$/, '')}/codrevia-logo.png`
    : 'https://raw.githubusercontent.com/YounanAdly/codebadger-dataplane-next/main/public/codrevia-logo.png');

export const SUMMARY_MARKER = '<!-- codrevia-ai-review-summary -->';
export const LEGACY_SUMMARY_MARKER = '<!-- marafiq-ai-review-summary -->';
// Comments posted before the rebrand keep these markers and footers; they must stay recognised.
const PRE_REBRAND_SUMMARY_MARKER = '<!-- codebadger-ai-review-summary -->';
const PRE_REBRAND_BOT_NAME = 'CodeBadger AI Review';
const PRE_REBRAND_BOT_ROLE = 'CodeBadger Reviewer';
const PRE_REBRAND_COMPANY_NAME = 'CodeBadger';

export const FINGERPRINT_REGEX = /<!-- (?:codrevia|codebadger|marafiq)-ai-review-fp:([^\s>]+) -->/;

export function isSummaryComment(body?: string): boolean {
  if (!body) return false;
  return [SUMMARY_MARKER, PRE_REBRAND_SUMMARY_MARKER, LEGACY_SUMMARY_MARKER].some((marker) => body.includes(marker));
}

const BOT_FOOTERS = [
  `AI reviewer — ${BOT_NAME}`,
  `AI reviewer — ${PRE_REBRAND_BOT_NAME}`,
  `${BOT_ROLE} — ${COMPANY_NAME}`,
  `${PRE_REBRAND_BOT_ROLE} — ${PRE_REBRAND_COMPANY_NAME}`,
];

/** True when the text carries a footer written by this bot, before or after the rebrand. */
export function hasBotFooter(text?: string): boolean {
  if (!text) return false;
  return BOT_FOOTERS.some((footer) => text.includes(footer));
}

export function formatLogoBadge(size: number = 28): string {
  return `<img src="${LOGO_URL}" width="${size}" height="${size}" alt="${COMPANY_NAME}" align="absmiddle" />`;
}

/**
 * Per-severity counts from a review summary body. The summary badge posts
 * lines like "🛑 2 critical · ⚠️ 1 high" (see review-runner), so the emoji +
 * word pairs are a stable parsing contract.
 */
export function severityCountsFromBody(body: string): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  if (!body) return counts;
  for (const [sev, emoji] of [
    ["critical", "🛑"],
    ["high", "⚠️"],
    ["medium", "🟡"],
    ["low", "🔵"],
    ["info", "ℹ️"],
  ] as const) {
    const m = body.match(new RegExp(`${emoji}\\s+(\\d+)\\s+${sev}`));
    if (m) counts[sev] = parseInt(m[1], 10) || 0;
  }
  return counts;
}

/**
 * Validates whether a suggestion is a genuine in-place code replacement.
 * Prevents prose instructions, markdown explanations, or cross-file requests
 * from being inserted into clickable ```suggestion blocks which break files.
 */
export function isValidSuggestion(suggestion?: string | null, filePath?: string): boolean {
  if (typeof suggestion !== 'string' || !suggestion.trim()) return false;
  const trimmed = suggestion.trim();

  // 1. If it starts with common English instructional verbs, it is advice/prose, NOT replacement code
  const proseRegex = /^(add|remove|delete|update|replace|please|ensure|make sure|consider|fix|clean up|use|move|note|refer|import)\b/i;
  if (proseRegex.test(trimmed)) return false;

  // 2. If it contains cross-file directions like "to `src/..." or "in `src/..."
  if (/\b(?:to|in|into|from|inside)\s+[`'][^`'\n]+\.[a-z0-9]+[`']/i.test(trimmed)) return false;

  // 3. For JSON files, ensure it is actually JSON syntax (not English prose)
  if (filePath && /\.json$/i.test(filePath)) {
    const isJsonKeyValue = /^\s*"[^"]+"[\s\S]*:[\s\S]*/.test(trimmed);
    const isJsonArrayItem = /^\s*(?:"[^"]*"|\d+|true|false|null|\{|\}|\[|\])[\s\S]*/.test(trimmed);
    if (!isJsonKeyValue && !isJsonArrayItem && trimmed !== '') {
      return false;
    }
  }

  return true;
}

