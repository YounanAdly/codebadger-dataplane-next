import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** A browser/dashboard credential cannot authorize an AI review request. */
export function verifyLocalReviewSignature({ body, projectId, timestamp, signature, expectedProjectId, secret, now = Date.now() }: {
  body: string; projectId: string | null; timestamp: string | null; signature: string | null;
  expectedProjectId: string | undefined; secret: string | undefined; now?: number;
}): boolean {
  if (!expectedProjectId || !secret || projectId !== expectedProjectId || !timestamp || !/^\d+$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 60) return false;
  const digest = createHash("sha256").update(body).digest("hex");
  const expected = createHmac("sha256", secret).update(`local-review:${projectId}:${timestamp}:${digest}`).digest("hex");
  return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
}

export interface LocalFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  source: "scanner" | "ai";
  title: string;
  category: string;
  file: string | null;
  line: number | null;
  explanation: string;
  suggestion: string | null;
}

/** Bound provider output and only keep locations in the submitted review. */
export function normalizeLocalFindings(raw: unknown[], files: string[]): LocalFinding[] {
  const severities = ["critical", "high", "medium", "low", "info"];
  const seen = new Set<string>();
  const findings: LocalFinding[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    if (typeof f.title !== "string" || !f.title.trim()) continue;
    if (typeof f.file === "string" && !files.includes(f.file)) continue;
    const file = typeof f.file === "string" ? f.file : null;
    const line = Number.isSafeInteger(f.line) && Number(f.line) > 0 ? Number(f.line) : null;
    const key = `${file}:${line}:${f.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({
      severity: (severities.includes(String(f.severity)) ? f.severity : "info") as LocalFinding["severity"],
      source: f.source === "scanner" ? "scanner" : "ai", title: f.title.trim().slice(0, 1000),
      category: typeof f.category === "string" ? f.category.slice(0, 100) : "review",
      file, line, explanation: typeof f.explanation === "string" ? f.explanation.slice(0, 8000) : "",
      suggestion: typeof f.suggestion === "string" ? f.suggestion.slice(0, 8000) : null,
    });
  }
  if (findings.length > 500) throw new Error("Review returned more than 500 findings; narrow the scope.");
  return findings.sort((a, b) => severities.indexOf(a.severity) - severities.indexOf(b.severity));
}
