// src/lib/reviewer-core/findings.ts
/**
 * Finding normalization shared by the AI pipeline.
 */
import { isGeneratedFile, platformForFile, type DetectedPlatform } from "./platform-detector.ts";

const SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);

/**
 * Validate and normalize AI findings: tag platform, drop generated files,
 * deduplicate identical findings (same underlying issue), clamp severity.
 */
export function normalizeFindings(findings: any[], detected: DetectedPlatform[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const f of findings) {
    if (!f || !f.file || !f.title) continue;
    if (isGeneratedFile(f.file)) continue;
    if (!SEVERITIES.has(f.severity)) f.severity = "info";
    if (!f.platform) f.platform = platformForFile(f.file, detected) || detected[0]?.name || "generic";
    const key = `${f.file}::${f.line}::${f.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}
