import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { verifyLocalReviewSignature, normalizeLocalFindings } from "../src/lib/local-review-auth.ts";
import { parseUnifiedDiffFiles, scanDiff } from "../src/lib/reviewer-core/rules-scanner.ts";

test("signed local review requests are bound to the body, project, purpose, and timestamp", () => {
  const body = JSON.stringify({ diff: "test-diff" });
  const now = Date.now(), timestamp = String(Math.floor(now / 1000));
  const digest = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", "test-secret").update(`local-review:project-1:${timestamp}:${digest}`).digest("hex");
  const valid = { body, projectId: "project-1", timestamp, signature, expectedProjectId: "project-1", secret: "test-secret", now };
  assert.ok(verifyLocalReviewSignature(valid));
  assert.equal(verifyLocalReviewSignature({ ...valid, body: "modified" }), false);
  assert.equal(verifyLocalReviewSignature({ ...valid, projectId: "project-2" }), false);
  assert.equal(verifyLocalReviewSignature({ ...valid, now: now + 61_000 }), false);
  assert.equal(verifyLocalReviewSignature({ ...valid, secret: undefined }), false);
  assert.equal(verifyLocalReviewSignature({ ...valid, signature: "dashboard-cookie" }), false);
});

test("findings are bounded, deduplicated, ordered and scoped to submitted files", () => {
  const findings = normalizeLocalFindings([
    { file: "app.ts", line: 2, severity: "unknown", title: "Info", explanation: "Explain" },
    { file: "app.ts", line: 1, severity: "high", source: "scanner", title: "Fix" },
    { file: "app.ts", line: 1, severity: "high", title: "Fix" },
    { file: "outside.ts", severity: "critical", title: "Out of scope" },
    null,
  ], ["app.ts"]);
  assert.equal(findings.length, 2); assert.equal(findings[0].severity, "high"); assert.equal(findings[1].severity, "info");
  assert.equal(findings[0].source, "scanner");
});

test("scanner reviews filenames containing spaces with accurate locations", () => {
  const diff = "diff --git a/src/my component.ts b/src/my component.ts\n--- a/src/my component.ts\n+++ b/src/my component.ts\t\n@@ -0,0 +1 @@\n+@Input() value: string;\n";
  const files = parseUnifiedDiffFiles(diff);
  assert.equal(files[0].path, "src/my component.ts");
  const findings = scanDiff(files);
  assert.equal(findings[0].file, "src/my component.ts"); assert.equal(findings[0].line, 1);
});
