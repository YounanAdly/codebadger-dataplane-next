// src/lib/reviewer-core/ai-review.ts
/**
 * AI review engine — calls Gemini and orchestrates scanner + AI findings.
 * Shared across all providers (GitHub, Azure, future).
 *
 * Pipeline: detect affected platforms from the diff → load common + platform
 * rules → load trusted repository configuration → build the review prompt →
 * call the AI → validate and normalize findings → return for publishing.
 */
import { COMPANY_NAME, CODEBADGER_LOGO_URL, BOT_NAME } from "@/lib/branding";
import { scanDiff, parseUnifiedDiffFiles } from "./rules-scanner";
import { detectPlatforms, extractFilePaths, isGeneratedFile, type Platform, type DetectedPlatform } from "./platform-detector";
import { loadRuleBundle, loadRepositoryConfig, formatPlatforms, type RuleBundle } from "./rule-loader";
import { buildReviewPrompt } from "./prompt-builder";
import { normalizeFindings } from "./findings";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

export async function runAIReview(
  diff: string,
  pr: { title: string; user?: { login?: string }; body?: string | null },
  repoRoot: string = process.cwd()
): Promise<{
  summary: string;
  verdict: string;
  findings: any[];
  platform: Platform;
  platforms: DetectedPlatform[];
  ruleBundle: RuleBundle;
}> {
  const startedAt = Date.now();

  // 1. Detect affected platforms from changed files (diff), boosted by manifests.
  const filePaths = extractFilePaths(diff).filter((f) => !isGeneratedFile(f));
  const detection = detectPlatforms(filePaths);
  console.log(
    `[review] detected platforms: ${formatPlatforms(detection.platforms)}${detection.fallbackUsed ? " (fallback)" : ""} — files: ${filePaths.length}`
  );

  // 2. Load common + platform rules and trusted repository configuration.
  //    Instruction indexes resolve against the changed files, so only the
  //    concerns this diff actually touches are inlined into the prompt.
  const repoConfig = loadRepositoryConfig(repoRoot);
  const ruleBundle = loadRuleBundle(repoRoot, detection, repoConfig, filePaths);

  // 3. Build the deterministic review prompt.
  const { systemPrompt, userPrompt } = buildReviewPrompt({
    detection,
    rules: ruleBundle.text,
    ruleFiles: [...ruleBundle.commonRuleFiles, ...ruleBundle.platformRuleFiles, ...ruleBundle.repoRuleFiles],
    repoConfig,
    pr,
    diff,
    companyName: COMPANY_NAME,
  });

  // 4. Call the AI review engine (retry with exponential backoff for transient
  //    failures: 429 rate limits and 5xx model overload). Free-tier Gemini
  //    quotas recover on the scale of tens of seconds — the retry budget and
  //    delays are sized for that, and Retry-After is honored when present.
  const MAX_RETRIES = 5;
  let res: Response | null = null;
  let lastError = "";
  let lastStatus = 0;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
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

    lastStatus = res.status;
    lastError = await res.text().catch(() => "");
    const isTransient = [429, 500, 502, 503, 504].includes(res.status);
    if (!isTransient || attempt === MAX_RETRIES) {
      if (lastStatus === 429) {
        throw new Error(
          `Gemini quota exhausted (429 persisted after ${MAX_RETRIES} retries). ` +
            `Free-tier keys have low per-minute/per-day limits — wait a few minutes, reduce review frequency, or use a paid key. ${lastError.slice(0, 300)}`
        );
      }
      throw new Error(`Gemini ${lastStatus}: ${lastError.slice(0, 500)}`);
    }

    // Honor Retry-After when Gemini sends it; otherwise exponential backoff
    // (2s, 4s, 8s, 16s, 32s) with jitter. Capped at 60s per wait.
    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const backoffMs = Math.pow(2, attempt + 1) * 1000;
    const jitterMs = Math.floor(Math.random() * 800);
    const delayMs = Math.min(
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : backoffMs + jitterMs,
      60_000
    );
    console.warn(`[gemini] ${res.status} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
    await new Promise((r) => setTimeout(r, delayMs));
  }

  if (!res || !res.ok) throw new Error(`Gemini failed after ${MAX_RETRIES} retries: ${lastError}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) parsed = JSON.parse(match[1]);
    else {
      const first = text.indexOf("{");
      const last = text.lastIndexOf("}");
      if (first >= 0 && last > first) parsed = JSON.parse(text.slice(first, last + 1));
      else throw new Error("Invalid JSON from AI");
    }
  }

  // 5. Validate and normalize findings: tag platform, drop generated files,
  //    deduplicate identical findings across platforms.
  const findings = normalizeFindings(parsed.findings || [], detection.platforms);

  console.log(`[review] AI review finished in ${Date.now() - startedAt}ms — findings: ${findings.length}`);
  return {
    ...parsed,
    findings,
    platform: detection.primary,
    platforms: detection.platforms,
    ruleBundle,
  };
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
  const scannerFindings = scanDiff(parseUnifiedDiffFiles(diff));
  const aiResult = await runAIReview(diff, fakePr);
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

  const platformLabel = aiResult.platforms?.length
    ? aiResult.platforms.map((p: DetectedPlatform) => `${p.name} ${p.confidence.toFixed(2)}`).join(", ")
    : aiResult.platform || "unknown";

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
    `<sub>Reviewed by **${COMPANY_NAME}** · Platform: **${platformLabel}** · AI: Gemini · Scanner: ${
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
