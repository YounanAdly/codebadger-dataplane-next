import { isGeneratedFile } from "./reviewer-core/platform-detector.ts";

export function diffStats(diff: string): { changedLines: number; changedFiles: number } {
  let file = "";
  let changedLines = 0;
  const files = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/.+ b\/(.+)$/);
      file = match?.[1] || "";
      if (file && !isGeneratedFile(file)) files.add(file);
    } else if (line.startsWith("+++ b/")) {
      file = line.slice(6).trim();
      if (!isGeneratedFile(file)) files.add(file);
    } else if (line.startsWith("+++ /dev/null")) {
      // Keep the path from diff --git so deleted lines are counted.
    } else if (file && !isGeneratedFile(file) && ((line.startsWith("+") && !line.startsWith("+++")) || (line.startsWith("-") && !line.startsWith("---")))) {
      changedLines++;
    }
  }
  return { changedLines, changedFiles: files.size };
}

export function telemetryFindings(findings: Array<Record<string, unknown>>) {
  return findings.slice(0, 200).map((finding) => ({
    severity: ["critical", "high", "medium", "low", "info"].includes(String(finding.severity).toLowerCase())
      ? String(finding.severity).toLowerCase()
      : "info",
    category: String(finding.category || "general").slice(0, 80),
    source: finding.source === "scanner" ? "scanner" : "ai",
    ruleId: finding.scannerRuleId ? String(finding.scannerRuleId).slice(0, 120) : null,
    title: String(finding.title || "Untitled finding").slice(0, 300),
    file: finding.file ? String(finding.file).slice(0, 500) : null,
    line: typeof finding.line === "number" && Number.isInteger(finding.line) && finding.line > 0 ? finding.line : null,
  }));
}
