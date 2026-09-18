import assert from "node:assert/strict";
import { diffStats, telemetryFindings } from "../src/lib/review-telemetry.ts";

const diff = [
  "diff --git a/src/a.ts b/src/a.ts", "--- a/src/a.ts", "+++ b/src/a.ts", "@@ -1 +1 @@", "-old", "+new",
  "diff --git a/src/gone.ts b/src/gone.ts", "--- a/src/gone.ts", "+++ /dev/null", "@@ -1 +0,0 @@", "-deleted",
].join("\n");
assert.deepEqual(diffStats(diff), { changedLines: 3, changedFiles: 2 });
assert.deepEqual(telemetryFindings([{ severity: "HIGH", category: "security", source: "scanner", scannerRuleId: "S1", title: "Risk" }])[0], {
  severity: "high", category: "security", source: "scanner", ruleId: "S1", title: "Risk", file: null, line: null,
});
console.log("review telemetry: pass");
