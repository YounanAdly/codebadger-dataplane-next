// tests/language-review-integration.test.ts
// Level 4/5 evaluation: run the REAL production review pipeline
// (executeReview → detectPlatforms → loadRuleBundle → buildReviewPrompt →
// AI call → normalizeFindings → verdict) over the multi-language fixtures.
//
// Only the network boundary is stubbed (canned Gemini response); everything on
// the Codrevia side is the unmodified production code path. Live-model runs are
// documented in docs/language-rules-audit.md (blocked: no AI provider
// credentials in this environment).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { executeReview } = require("../src/lib/reviewer-core/ai-review.ts");

const fixtureDir = path.join(process.cwd(), "tests", "fixtures", "language-review");
const readDiff = (name) => fs.readFileSync(path.join(fixtureDir, name), "utf8").replace(/\r\n/g, "\n");

function stubModel(review, calls = []) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options?.body || "{}") });
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(review) }] } }] }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  };
  return () => {
    globalThis.fetch = original;
  };
}

describe("language review pipeline — production executeReview over fixtures", () => {
  let restoreEnv;
  before(() => {
    const saved = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      AI_PROVIDER: process.env.AI_PROVIDER,
      GEMINI_MODEL: process.env.GEMINI_MODEL,
    };
    process.env.GEMINI_API_KEY = "test-key";
    process.env.AI_PROVIDER = "gemini";
    delete process.env.GEMINI_MODEL;
    restoreEnv = () => {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    };
  });
  after(() => restoreEnv?.());

  test("mixed React + Node.js PR: both rulebooks reach the model, findings tagged per platform", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      {
        summary: "XSS in the comment list and SQL injection on the API.",
        verdict: "request_changes",
        prTitle: "feat: add comments",
        findings: [
          { file: "src/components/CommentList.tsx", line: 15, title: "Unsanitized HTML rendered via dangerouslySetInnerHTML", severity: "critical", category: "security" },
          { file: "server.js", line: 9, title: "SQL injection via interpolated request body", severity: "critical", category: "security" },
          { file: "server.js", line: 8, title: "Mutating endpoint has no authentication", severity: "critical", category: "security" },
        ],
      },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("mixed-web.diff"),
        fakePr: { title: "feat: add comments", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      for (const expected of [
        "React Review Rules",
        "Node.js Review Rules",
        "Common API & Data Integrity Rules",
        "Common Security Rules",
      ]) {
        assert.ok(systemPrompt.includes(expected), `system prompt missing: ${expected}`);
      }
      assert.ok(systemPrompt.includes("- react — confidence 0.40"));
      assert.ok(systemPrompt.includes("- nodejs — confidence 0.80"));

      const byFile = Object.fromEntries(result.allFindings.map((f) => [`${f.file}:${f.line}`, f]));
      assert.equal(byFile["src/components/CommentList.tsx:15"].platform, "react");
      assert.equal(byFile["server.js:9"].platform, "nodejs");
      assert.equal(result.verdict, "request_changes");
      assert.equal(result.scannerFindings.length, 0, "no deterministic rule matches these languages");
    } finally {
      restoreFetch();
    }
  });

  test("mixed Python + SQL PR: migration review rides on the sql ruleset with correct tagging", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      {
        summary: "SQL injection and unsafe deserialization; destructive migration.",
        verdict: "request_changes",
        prTitle: "feat: order search",
        findings: [
          { file: "app/api/orders.py", line: 12, title: "f-string SQL with interpolated parameters", severity: "critical", category: "security" },
          { file: "app/api/orders.py", line: 15, title: "pickle.loads on untrusted request body", severity: "critical", category: "security" },
          { file: "db/migrations/004_orders.sql", line: 2, title: "DROP TABLE without a reversible plan", severity: "critical", category: "bug" },
        ],
      },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("mixed-python-sql.diff"),
        fakePr: { title: "feat: order search", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      assert.ok(systemPrompt.includes("Python Review Rules"));
      assert.ok(systemPrompt.includes("SQL & Database Review Rules"));
      assert.ok(systemPrompt.includes("Destructive schema changes"));

      const migrationFinding = result.allFindings.find((f) => f.file.endsWith("004_orders.sql"));
      assert.equal(migrationFinding.platform, "sql");
      const pythonFinding = result.allFindings.find((f) => f.file.endsWith("orders.py"));
      assert.equal(pythonFinding.platform, "python");
      assert.equal(result.verdict, "request_changes");
    } finally {
      restoreFetch();
    }
  });

  test("pure-Swift PR without Xcode manifests still reviews under the iOS ruleset", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      {
        summary: "Hardcoded key, force unwraps, and a leaking timer.",
        verdict: "request_changes",
        prTitle: "feat: order polling",
        findings: [
          { file: "App/Sources/OrderService.swift", line: 4, title: "Hardcoded API key", severity: "critical", category: "security" },
          { file: "App/Sources/OrderService.swift", line: 11, title: "try! crashes on decode failure", severity: "high", category: "bug" },
        ],
      },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("swift.diff"),
        fakePr: { title: "feat: order polling", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      assert.ok(systemPrompt.includes("iOS Review Rules"));
      assert.ok(systemPrompt.includes("force unwraps"));
      for (const finding of result.allFindings) {
        assert.equal(finding.platform, "ios");
      }
      assert.equal(result.verdict, "request_changes");
    } finally {
      restoreFetch();
    }
  });

  test("Rust PR selects the rust ruleset and flags unsafe/panic paths", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      {
        summary: "Unjustified unsafe and request-path panics.",
        verdict: "request_changes",
        prTitle: "feat: visit tracking",
        findings: [
          { file: "src/handler.rs", line: 7, title: "unsafe pointer write without justification", severity: "critical", category: "bug" },
          { file: "src/handler.rs", line: 8, title: "unwrap on untrusted input panics the handler", severity: "high", category: "bug" },
        ],
      },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("rust.diff"),
        fakePr: { title: "feat: visit tracking", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      assert.ok(systemPrompt.includes("Rust Review Rules"));
      assert.ok(systemPrompt.includes("- rust — confidence 0.40"));
      assert.ok(result.allFindings.every((f) => f.platform === "rust"));
      assert.equal(result.verdict, "request_changes");
    } finally {
      restoreFetch();
    }
  });

  test("clean multi-language PR: no findings, correct rulebooks still loaded, no auto-approve", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      { summary: "No defects found.", verdict: "approve", prTitle: "feat: comments", findings: [] },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("clean-mixed.diff"),
        fakePr: { title: "feat: comments", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      for (const expected of ["React Review Rules", "Node.js Review Rules", "SQL & Database Review Rules"]) {
        assert.ok(systemPrompt.includes(expected), `clean PR rulebook missing: ${expected}`);
      }
      assert.equal(result.allFindings.length, 0);
      assert.equal(result.verdict, "comment");
    } finally {
      restoreFetch();
    }
  });
});
