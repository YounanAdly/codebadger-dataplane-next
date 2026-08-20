// Branding configuration for CodeBadger AI Review

export const COMPANY_NAME = 'CodeBadger';
export const BOT_NAME = 'CodeBadger AI Review';
export const BOT_ROLE = 'CodeBadger Reviewer';

// Fallback logo URL (hosted on GitHub raw repo or custom domain/CDN)
export const CODEBADGER_LOGO_URL =
  process.env.CODEBADGER_LOGO_URL ||
  (process.env.DATAPLANE_URL
    ? `${process.env.DATAPLANE_URL.replace(/\/$/, '')}/codebadger-logo.jpg`
    : 'https://raw.githubusercontent.com/YounanAdly/codebadger-dataplane-next/main/public/codebadger-logo.jpg');

export const SUMMARY_MARKER = '<!-- codebadger-ai-review-summary -->';
export const LEGACY_SUMMARY_MARKER = '<!-- marafiq-ai-review-summary -->';

export const FINGERPRINT_REGEX = /<!-- (?:codebadger|marafiq)-ai-review-fp:([^\s>]+) -->/;

export function isSummaryComment(body?: string): boolean {
  if (!body) return false;
  return body.includes(SUMMARY_MARKER) || body.includes(LEGACY_SUMMARY_MARKER);
}

export function formatLogoBadge(size: number = 28): string {
  return `<img src="${CODEBADGER_LOGO_URL}" width="${size}" height="${size}" alt="${COMPANY_NAME}" align="absmiddle" />`;
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

