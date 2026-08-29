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

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.7-flash";

// ── AI provider chain ────────────────────────────────────────────────────────
// Reviews try the primary provider (AI_PROVIDER, default gemini) first; if its
// key is missing or its quota/transient budget is exhausted, the next
// configured provider takes over. Free-tier keys drain fast when several
// projects share one key — a fallback keeps reviews flowing on whichever
// provider still has headroom.

interface AiPrompt {
  system: string;
  user: string;
}

const PROVIDER_MODELS: Record<string, string> = {
  gemini: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  openai: process.env.OPENAI_MODEL || "gpt-4o",
  anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
  "azure-openai": process.env.AZURE_OPENAI_MODEL || "gpt-4o",
};

function providerConfigured(name: string): boolean {
  switch (name) {
    case "gemini":
      return !!process.env.GEMINI_API_KEY;
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    case "azure-openai":
      return !!(
        process.env.AZURE_OPENAI_API_KEY &&
        process.env.AZURE_OPENAI_ENDPOINT &&
        process.env.AZURE_OPENAI_DEPLOYMENT
      );
    default:
      return false;
  }
}

function providerChain(): string[] {
  const primary = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const all = ["gemini", "openai", "anthropic", "azure-openai"];
  const configured = all.filter(providerConfigured);
  return [primary, ...configured.filter((n) => n !== primary)].filter((n) =>
    providerConfigured(n)
  );
}

/**
 * Transient-status retry wrapper: 429/5xx with exponential backoff + jitter
 * and Retry-After support. Gemini gets a longer budget (free tier throttles
 * hardest); total wait stays well under the function's 300s window.
 */
async function fetchWithRetries(
  provider: string,
  doFetch: () => Promise<Response>
): Promise<Response> {
  const maxRetries = provider === "gemini" ? 5 : 3;
  let lastStatus = 0;
  let lastError = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await doFetch();
    if (res.ok) return res;

    lastStatus = res.status;
    lastError = await res.text().catch(() => "");
    const isTransient = [429, 500, 502, 503, 504].includes(lastStatus);
    if (!isTransient || attempt === maxRetries) break;

    const retryAfterHeader = Number(res.headers.get("retry-after"));
    const backoffMs = Math.pow(2, attempt + 1) * 1000;
    const jitterMs = Math.floor(Math.random() * 800);
    const delayMs = Math.min(
      Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
        ? retryAfterHeader * 1000
        : backoffMs + jitterMs,
      60_000
    );
    console.warn(
      `[${provider}] ${lastStatus} — retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`
    );
    await new Promise((r) => setTimeout(r, delayMs));
  }

  if (lastStatus === 429) {
    throw new Error(
      `${provider} quota exhausted (429 persisted after ${maxRetries} retries). ` +
        `Free-tier keys have low per-minute/per-day limits — wait, reduce review frequency, or use a paid key. ${lastError.slice(0, 300)}`
    );
  }
  throw new Error(`${provider} ${lastStatus}: ${lastError.slice(0, 500)}`);
}

async function callProvider(name: string, p: AiPrompt): Promise<string> {
  switch (name) {
    case "gemini": {
      const res = await fetchWithRetries(name, () =>
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${PROVIDER_MODELS.gemini}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: p.system }] },
              contents: [{ role: "user", parts: [{ text: p.user }] }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
              },
            }),
          }
        )
      );
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
    case "openai": {
      const res = await fetchWithRetries(name, () =>
        fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: PROVIDER_MODELS.openai,
            temperature: 0.1,
            max_tokens: 8192,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: p.system },
              { role: "user", content: p.user },
            ],
          }),
        })
      );
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    case "anthropic": {
      const res = await fetchWithRetries(name, () =>
        fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY || "",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: PROVIDER_MODELS.anthropic,
            max_tokens: 8192,
            temperature: 0.1,
            system: p.system,
            messages: [{ role: "user", content: p.user }],
          }),
        })
      );
      const data = await res.json();
      return (
        (data.content || [])
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n") || ""
      );
    }
    case "azure-openai": {
      const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || "").replace(/\/+$/, "");
      const res = await fetchWithRetries(name, () =>
        fetch(
          `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version=2024-08-01-preview`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "api-key": process.env.AZURE_OPENAI_API_KEY || "",
            },
            body: JSON.stringify({
              temperature: 0.1,
              max_tokens: 8192,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: p.system },
                { role: "user", content: p.user },
              ],
            }),
          }
        )
      );
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    }
    default:
      throw new Error(`Unknown AI provider "${name}"`);
  }
}

/** Try the provider chain in order; fail only when every provider failed. */
async function callAiReview(p: AiPrompt): Promise<{ text: string; provider: string }> {
  const chain = providerChain();
  if (chain.length === 0) {
    throw new Error(
      "No AI provider configured — set GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or the Azure OpenAI variables."
    );
  }
  const failures: string[] = [];
  for (const name of chain) {
    try {
      const text = await callProvider(name, p);
      if (!text.trim()) throw new Error("empty response");
      return { text, provider: name };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ai] provider "${name}" failed → trying next: ${message}`);
      failures.push(`${name}: ${message}`);
    }
  }
  throw new Error(`All AI providers failed → ${failures.join(" | ")}`.slice(0, 1500));
}

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

  // 4. Call the AI review engine through the provider chain (primary provider
  //    first, then fallbacks on missing keys / exhausted quota / transient 5xx).
  const { text, provider } = await callAiReview({
    system: systemPrompt,
    user: userPrompt,
  });
  console.log(`[ai] review generated via "${provider}"`);

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
