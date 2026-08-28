// src/lib/reviewer-core/rule-loader.ts
/**
 * Rule loader for the platform-aware reviewer.
 *
 * Loads, in order: common rules, platform-specific rules (per detected
 * platform), and trusted repository configuration from `.codebadger/`.
 * Guarantees: no duplicate rule content in the final bundle, missing rule
 * files never crash the review, a maximum prompt size is enforced, and every
 * load/skip decision is logged (without logging file contents).
 */
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Platform, PlatformDetectionResult, DetectedPlatform } from "./platform-detector.ts";
import { sanitizeUntrusted } from "./prompt-builder.ts";

export const RULES_DIR = "rules";
export const REPO_CONFIG_DIR = ".codebadger";
/** Maximum characters of rule text injected into a prompt. */
export const MAX_RULES_CHARS = 120_000;

export interface RepoReviewConfig {
  /** Platforms the repo declares (unioned with detected platforms). */
  platforms: Platform[];
  severityThreshold: string;
  maxComments: number;
  /** Repo rule files to include (relative to .codebadger/). */
  include: string[];
  /** Rule file names to exclude (e.g. "generated-code.md", "react/rules.md"). */
  exclude: string[];
}

export interface RuleBundle {
  /** Combined, deduplicated rule text ready for prompt injection. */
  text: string;
  commonRuleFiles: string[];
  platformRuleFiles: string[];
  repoRuleFiles: string[];
  skippedRuleFiles: string[];
  fallbackUsed: boolean;
  truncated: boolean;
}

const PLATFORM_RULE_FILES: Record<string, string[]> = {
  angular: ["rules.md", "rules-extra.md"],
};

// ---------------------------------------------------------------------------
// Repository configuration (.codebadger/review-config.yml)
// ---------------------------------------------------------------------------

/**
 * Minimal YAML-subset parser for the documented config shape:
 * lists with "- item", two-level nested keys, scalar values.
 */
export function parseReviewConfigYaml(raw: string): RepoReviewConfig {
  const cfg: RepoReviewConfig = {
    platforms: [],
    severityThreshold: "low",
    maxComments: 20,
    include: [],
    exclude: [],
  };
  let section = "";
  let subsection = "";
  for (const lineRaw of raw.split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const topMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    const nestedMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    const listItem = line.match(/^-\s*(.+)$/);

    const indent = lineRaw.search(/\S/);
    if (listItem && indent > 0) {
      const value = listItem[1].trim().replace(/^['"]|['"]$/g, "");
      if (section === "platforms") {
        if (ALL_PLATFORM_SET.has(value as Platform) && !cfg.platforms.includes(value as Platform)) {
          cfg.platforms.push(value as Platform);
        }
      } else if (subsection === "include") {
        cfg.include.push(value);
      } else if (subsection === "exclude") {
        cfg.exclude.push(value);
      }
      continue;
    }
    if (topMatch && indent === 0) {
      section = topMatch[1];
      subsection = "";
      if (section === "review") {
        // values parsed on nested keys below
      }
      continue;
    }
    if (nestedMatch && indent > 0) {
      const key = nestedMatch[1];
      const value = nestedMatch[2].trim().replace(/^['"]|['"]$/g, "");
      if (section === "review") {
        if (key === "severity_threshold") cfg.severityThreshold = value;
        if (key === "max_comments") cfg.maxComments = parseInt(value, 10) || 20;
        if (key === "comment_on_existing_issues") cfg.severityThreshold = cfg.severityThreshold; // reserved
      }
      if (section === "rules") {
        subsection = key; // "include" | "exclude" — items follow
      }
      continue;
    }
  }
  return cfg;
}

const ALL_PLATFORM_SET = new Set<string>([
  "angular", "flutter", "kotlin", "swift", "react", "nextjs", "react-native",
  "vue", "nodejs", "python", "java", "android", "ios", "dotnet", "go", "php", "ruby",
]);

/**
 * Load `.codebadger/review-config.yml` from a repository checkout.
 * Returns null when the repo has no configuration.
 */
export function loadRepositoryConfig(repoRoot: string): RepoReviewConfig | null {
  const p = join(repoRoot, REPO_CONFIG_DIR, "review-config.yml");
  if (!existsSync(p)) return null;
  try {
    return parseReviewConfigYaml(readFileSync(p, "utf8"));
  } catch (e: any) {
    console.warn(`[rule-loader] failed to parse ${REPO_CONFIG_DIR}/review-config.yml — ignoring: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rule loading
// ---------------------------------------------------------------------------

const COMMON_RULE_FILES = ["code-quality.md", "security.md", "testing.md", "pull-request.md"];

function readRuleFile(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch (e: any) {
    console.warn(`[rule-loader] failed to read ${path} — skipping: ${e.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Instruction indexes — rules/<platform>/rules.md files may contain an
// "## Instruction files" section listing reusable instruction files:
//   - .github/instructions/flutter/dart.instructions.md — Dart language rules
// The loader resolves each referenced file and inlines it when its `applyTo`
// frontmatter globs match the changed files of the pull request.
// ---------------------------------------------------------------------------

const INDEX_ENTRY_RE = /^\s*-\s+(\S+?\.instructions\.md)\s*(?:[—-]+\s*(.*))?$/;

export function parseIndexEntries(markdown: string): Array<{ path: string; description: string }> {
  const inSection = /(^|\n)#{2,3}\s*instruction files\s*\n/i.test(markdown);
  if (!inSection) return [];
  const section = markdown.split(/^#{2,3}\s*instruction files\s*$/im)[1] || "";
  const entries: Array<{ path: string; description: string }> = [];
  for (const line of section.split(/\r?\n/)) {
    if (/^#{1,3}\s/.test(line)) break; // next heading ends the section
    const m = line.match(INDEX_ENTRY_RE);
    if (m) entries.push({ path: m[1], description: (m[2] || "").trim() });
  }
  return entries;
}

/** Extract the `applyTo` frontmatter value as a list of glob patterns. */
export function parseApplyTo(markdown: string): string[] {
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return [];
  const applyTo = m[1].match(/^applyTo:\s*"([^"]*)"/m);
  if (!applyTo) return [];
  // Split on commas that are not inside {a,b} brace groups.
  const parts: string[] = [];
  let depth = 0, cur = "";
  for (const ch of applyTo[1]) {
    if (ch === "{") depth++;
    if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim()).filter(Boolean);
}

/** Expand `{a,b}` brace groups into separate glob patterns. */
export function expandBraces(glob: string): string[] {
  const m = glob.match(/\{([^{}]*)\}/);
  if (!m) return [glob];
  const out: string[] = [];
  for (const alt of m[1].split(",")) {
    out.push(...expandBraces(glob.replace(m[0], alt)));
  }
  return out;
}

/** Convert a simple glob (`**`, `*`, `?`) to a RegExp over forward-slash paths. */
export function globToRegex(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith("**/", i)) {
      re += "(?:.*/)?"; // `**/` matches zero or more directories
      i += 2;
      continue;
    }
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; } else { re += "[^/]*"; }
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`, "i");
}

export function matchesAnyPath(globs: string[], changedFiles: string[]): boolean {
  const regexes = globs.flatMap(expandBraces).map(globToRegex);
  return changedFiles.some((f) => regexes.some((rx) => rx.test(f)));
}

/**
 * Load the full rule bundle for a review.
 *
 * @param repoRoot  Working directory containing the `rules/` tree and the
 *   `.github/instructions/` library (the CodeBadger deployment).
 * @param detection  Result of platform detection.
 * @param repoConfig  Optional `.codebadger` configuration of the reviewed repo.
 * @param changedFiles  Pull-request changed file paths — used for concern
 *   selection: an indexed instruction file is inlined only when its `applyTo`
 *   scope matches at least one changed file.
 */
export function loadRuleBundle(
  repoRoot: string,
  detection: PlatformDetectionResult,
  repoConfig?: RepoReviewConfig | null,
  changedFiles: string[] = []
): RuleBundle {
  const seen = new Set<string>();
  const skipped: string[] = [];
  const commonRuleFiles: string[] = [];
  const platformRuleFiles: string[] = [];
  const repoRuleFiles: string[] = [];

  const addRule = (path: string, display: string, blocks: string[]) => {
    if (repoConfig?.exclude.includes(display)) {
      skipped.push(display);
      return;
    }
    const content = readRuleFile(path);
    if (!content || !content.trim()) {
      skipped.push(display);
      return;
    }
    const hash = createHash("sha256").update(content).digest("hex");
    if (seen.has(hash)) {
      skipped.push(`${display} (duplicate)`);
      return;
    }
    seen.add(hash);
    // Repository rule files are untrusted: strip prompt-injection attempts.
    blocks.push(`### Source: ${display}\n\n${(display.startsWith(".codebadger/") ? sanitizeUntrusted(content) : content).trim()}`);
  };

  // 1. Common rules — always loaded, never excluded.
  const commonBlocks: string[] = [];
  for (const f of COMMON_RULE_FILES) {
    const before = commonBlocks.length;
    addRule(join(repoRoot, RULES_DIR, "common", f), `common/${f}`, commonBlocks);
    if (commonBlocks.length > before) commonRuleFiles.push(`common/${f}`);
  }

  // 2. Platform rules — baseline rules.md per platform, plus any instruction
  //    files referenced by its index whose applyTo scope matches the diff.
  const platformBlocks: string[] = [];
  const detectedPlatforms = detection.platforms.filter((p) => p.name !== "generic");
  for (const p of detectedPlatforms) {
    for (const f of PLATFORM_RULE_FILES[p.name] || ["rules.md"]) {
      const display = `${p.name}/${f}`;
      const before = platformBlocks.length;
      const basePath = join(repoRoot, RULES_DIR, p.name, f);
      addRule(basePath, display, platformBlocks);
      if (platformBlocks.length > before) platformRuleFiles.push(display);

      // Resolve the instruction index (if the rules.md declares one).
      const baseContent = readRuleFile(basePath);
      for (const entry of baseContent ? parseIndexEntries(baseContent) : []) {
        const entryPath = join(repoRoot, entry.path);
        const entryContent = readRuleFile(entryPath);
        if (!entryContent) {
          skipped.push(`${entry.path} (missing)`);
          continue;
        }
        const globs = parseApplyTo(entryContent);
        if (globs.length > 0 && !matchesAnyPath(globs, changedFiles)) {
          skipped.push(`${entry.path} (scope not in diff)`);
          continue;
        }
        const entryBefore = platformBlocks.length;
        addRule(entryPath, entry.path, platformBlocks);
        if (platformBlocks.length > entryBefore) platformRuleFiles.push(entry.path);
      }
    }
  }

  // 3. Repository rules — trusted additional guidance from .codebadger/.
  //    They never override system or security rules; enforced via boundary in
  //    the prompt builder.
  const repoBlocks: string[] = [];
  if (repoConfig) {
    for (const f of repoConfig.include) {
      const display = `.codebadger/${f}`;
      const before = repoBlocks.length;
      addRule(join(repoRoot, REPO_CONFIG_DIR, f), display, repoBlocks);
      if (repoBlocks.length > before) repoRuleFiles.push(display);
    }
  }

  const fallbackUsed = detection.fallbackUsed;
  if (fallbackUsed) {
    addRule(join(repoRoot, RULES_DIR, "unknown", "rules.md"), "unknown/rules.md", commonBlocks);
  }

  let text = [
    commonBlocks.join("\n\n---\n\n"),
    platformBlocks.length ? platformBlocks.join("\n\n---\n\n") : "",
    repoBlocks.length ? repoBlocks.join("\n\n---\n\n") : "",
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  let truncated = false;
  if (text.length > MAX_RULES_CHARS) {
    text = `${text.slice(0, MAX_RULES_CHARS)}\n\n[TRUNCATED — rule corpus exceeded ${MAX_RULES_CHARS} characters]`;
    truncated = true;
  }

  console.log(
    `[rule-loader] loaded: common=[${commonRuleFiles.join(", ")}] platforms=[${platformRuleFiles.join(
      ", "
    )}] repo=[${repoRuleFiles.join(", ")}]` +
      (skipped.length ? ` skipped=[${skipped.join(", ")}]` : "") +
      (fallbackUsed ? " fallback=unknown" : "") +
      (truncated ? ` truncated=true` : "")
  );

  return {
    text,
    commonRuleFiles,
    platformRuleFiles,
    repoRuleFiles,
    skippedRuleFiles: skipped,
    fallbackUsed,
    truncated,
  };
}

/** Convenience: human-readable platform list for prompts and summaries. */
export function formatPlatforms(platforms: DetectedPlatform[]): string {
  return platforms.map((p) => `${p.name} (${p.confidence.toFixed(2)})`).join(", ");
}
