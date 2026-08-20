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
