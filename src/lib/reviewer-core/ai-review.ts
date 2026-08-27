// src/lib/reviewer-core/ai-review.ts
/**
 * AI review engine — calls Gemini and orchestrates scanner + AI findings.
 * Shared across all providers (GitHub, Azure, future).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMPANY_NAME, CODEBADGER_LOGO_URL, BOT_NAME } from "@/lib/branding";
import { scanDiff, parseUnifiedDiffFiles } from "./rules-scanner";
import { detectPlatform, extractFilePaths, type Platform } from "./platform-detector";
import { buildSystemPrompt } from "./platform-prompts";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

export function loadRules(): string {
  try {
    return readFileSync(join(process.cwd(), "rules.md"), "utf8");
  } catch {
    return "";
  }
}

export async function runAIReview(
  rules: string,
  diff: string,
  pr: { title: string; user?: { login?: string }; body?: string | null }
): Promise<{ summary: string; verdict: string; findings: any[]; platform: Platform }> {
  // Detect platform from diff file paths
  const filePaths = extractFilePaths(diff);
  const { platform, confidence } = detectPlatform(filePaths);
  console.log(`[review] detected platform: ${platform} (confidence: ${confidence.toFixed(2)}, files: ${filePaths.length})`);

  // Build platform-aware system prompt
  const systemPrompt = buildSystemPrompt(platform, COMPANY_NAME, rules);

  const userPrompt = `## PR metadata
- Title: ${pr.title}
- Author: ${pr.user?.login || "unknown"}
- Description: ${(pr.body || "").slice(0, 2000)}

## Diff (unified)
\`\`\`diff
${diff.slice(0, 150000)}
\`\`\`

Review every file against the rulebook. Line numbers refer to the RIGHT side (new file). Prefer high-signal findings only.`;

  // Retry with exponential backoff for transient errors (429, 503)
  const MAX_RETRIES = 3;
  let res: Response | null = null;
  let lastError = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (res.ok) break;

    lastError = await res.text().catch(() => "");
    const isTransient = res.status === 429 || res.status === 503;
    if (!isTransient || attempt === MAX_RETRIES) {
      throw new Error(`Gemini ${res.status}: ${lastError}`);
    }

    // Exponential backoff: 2s, 4s, 8s
    const delayMs = Math.pow(2, attempt + 1) * 1000;
    console.warn(`[gemini] ${res.status} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await new Promise((r) => setTimeout(r, delayMs));
  }

  if (!res || !res.ok) throw new Error(`Gemini failed after ${MAX_RETRIES} retries: ${lastError}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  try {
    return { ...JSON.parse(text), platform };
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return { ...JSON.parse(match[1]), platform };
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first)
      return { ...JSON.parse(text.slice(first, last + 1)), platform };
    throw new Error("Invalid JSON from AI");
  }
}

export interface ReviewResult {
  allFindings: any[];
  comments: Array<{ file: string; line: number; endLine?: number | null; body: string }>;
  summaryMd: string;
  verdict: string;
  scannerFindings: any[];
  aiResult: any;
}

/**
 * Execute a full review: scanner + AI + verdict + summary markdown.
 * Provider-agnostic — works for GitHub, Azure, or any provider.
 */
export async function executeReview({
  diff,
  fakePr,
  renderComment,
}: {
  diff: string;
  fakePr: { title: string; user?: { login?: string }; body?: string | null };
  renderComment: (f: any) => string;
}): Promise<ReviewResult> {
  const rules = loadRules();
  const scannerFindings = scanDiff(parseUnifiedDiffFiles(diff));
  const aiResult = await runAIReview(rules, diff, fakePr);
  const allFindings = [...scannerFindings, ...(aiResult.findings || [])];

  const failSeverities = ["critical", "high"];
  const verdict = allFindings.some((f) => failSeverities.includes(f.severity))
    ? "request_changes"
    : "comment";

  const comments = allFindings
    .filter((f) => f.file && !f.file.startsWith("("))
    .map((f) => ({
      file: f.file,
      line: f.line,
      endLine: f.endLine,
      body: renderComment(f),
    }));

  const counts = allFindings.reduce((acc: Record<string, number>, f: any) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {});
  const badge =
    Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(
        ([sev, n]) =>
          `${
            ({ critical: "🛑", high: "⚠️", medium: "🟡", low: "🔵", info: "ℹ️" } as Record<string, string>)[
              sev
            ]
          } ${n} ${sev}`
      )
      .join(" · ") || "✨ No findings.";

  const summaryMd = [
    `## <img src="${CODEBADGER_LOGO_URL}" width="28" height="28" alt="${COMPANY_NAME}" align="absmiddle" /> ${BOT_NAME}`,
    "",
    ({
      approve: "✅ **Approve** — no blocking issues.",
      comment: "💬 **Comment** — please review the notes below.",
      request_changes: "🛑 **Changes required** — critical rule violations found.",
    } as Record<string, string>)[verdict],
    "",
    `**Findings**: ${badge}`,
    "",
    aiResult.summary || "_(no additional summary)_",
    "",
    "---",
    `<sub>Reviewed by **${COMPANY_NAME}** · Platform: **${aiResult.platform || "unknown"}** · AI: Gemini · Scanner: ${
      scannerFindings.length
    } · AI: ${aiResult.findings?.length || 0}</sub>`,
  ].join("\n");

  return {
    allFindings,
    comments,
    summaryMd,
    verdict,
    scannerFindings,
    aiResult,
  };
}
