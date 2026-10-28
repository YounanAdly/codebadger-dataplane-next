// tests/flutter-review-integration.test.ts
// Level 3/4 evaluation: run the REAL production review pipeline
// (executeReview → detectPlatforms → loadRuleBundle → buildReviewPrompt →
// AI call → normalizeFindings → verdict) over the Flutter fixture diffs.
//
// The only stubbed seam is the network boundary (globalThis.fetch returning a
// canned Gemini response): no live model key is required, and everything on the
// Codrevia side — detection, rule loading, prompt assembly, finding
// normalization, dedup, and verdict computation — is the unmodified production
// code path. Live-model Level 3/5 runs are documented in
// docs/flutter-rules-audit.md (blocked: no AI provider credentials in this
// environment).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { executeReview } = require("../src/lib/reviewer-core/ai-review.ts");
const { normalizeLocalFindings } = require("../src/lib/local-review-auth.ts");

const fixtureDir = path.join(process.cwd(), "tests", "fixtures", "flutter-review");
const readDiff = (name) => fs.readFileSync(path.join(fixtureDir, name), "utf8").replace(/\r\n/g, "\n");

const geminiResponse = (review) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(review) }] } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/** Stub fetch, capture the prompts sent to the model, return a canned review. */
function stubModel(review, calls = []) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options?.body || "{}") });
    return geminiResponse(review);
  };
  return () => {
    globalThis.fetch = original;
  };
}

describe("flutter review pipeline — production executeReview over fixtures", () => {
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

  test("positive fixture: defects detected, verdict request_changes, findings normalized", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      {
        summary: "Multiple critical security and lifecycle defects.",
        verdict: "request_changes",
        prTitle: "feat: add profile screen",
        findings: [
          { file: "lib/profile_screen.dart", line: 32, title: "setState after await without mounted check", severity: "high", category: "bug" },
          { file: "lib/profile_screen.dart", line: 32, title: "setState after await without mounted check", severity: "high", category: "bug" }, // dup
          { file: "lib/profile_screen.dart", line: 22, title: "Theme.of(context) in initState throws", severity: "blocker", category: "bug" }, // bad severity
          { file: "lib/profile.freezed.dart", line: 1, title: "generated noise", severity: "critical" }, // generated file
          { file: "lib/api_client.dart", line: 5, title: "Hardcoded API key in source", severity: "critical", category: "security" }, // platform tag added
        ],
      },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("positive.diff"),
        fakePr: { title: "feat: add profile screen", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });

      // Rulebook reached the model: baseline + every updated instruction concern.
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      for (const expectedRuleText of [
        "Flutter Review Rules",
        "Listeners are removed symmetrically",
        "PopScope",
        "usesCleartextTraffic",
        "TextScaler",
        "HTTP clients are reused or closed",
        "Inherited-widget lookups do not happen in `initState`",
      ]) {
        assert.ok(systemPrompt.includes(expectedRuleText), `system prompt missing: ${expectedRuleText}`);
      }
      assert.match(systemPrompt, /- flutter — confidence 1\.00/);
      assert.match(calls[0].url, /generativelanguage\.googleapis\.com/);

      // Deterministic scanner layer fired on the two known criticals.
      const scannerFindings = result.scannerFindings;
      assert.deepEqual(
        scannerFindings.map((f) => `${f.file}:${f.line}:${f.scannerRuleId}`).sort(),
        [
          "android/app/src/main/AndroidManifest.xml:5:android-cleartext-traffic",
          "lib/api_client.dart:9:dart-tls-bypass",
        ]
      );

      // AI findings were normalized: generated files dropped, severity clamped,
      // duplicates removed, platform tagged.
      const aiFindings = result.aiResult.findings;
      assert.equal(aiFindings.length, 3);
      assert.ok(!aiFindings.some((f) => f.file.endsWith(".freezed.dart")));
      const initStateFinding = aiFindings.find((f) => f.title.includes("initState"));
      assert.equal(initStateFinding.severity, "info");
      const apiKeyFinding = aiFindings.find((f) => f.title.includes("API key"));
      assert.equal(apiKeyFinding.platform, "flutter");

      // Client-side verdict: any critical/high (scanner criticals here) blocks.
      assert.equal(result.verdict, "request_changes");
      assert.equal(result.allFindings.length, 5);
      assert.ok(result.summaryMd.includes("Codrevia"));
    } finally {
      restoreFetch();
    }
  });

  test("negative fixture: clean code produces no findings and never auto-approves", async () => {
    const calls = [];
    const restoreFetch = stubModel(
      { summary: "No defects found.", verdict: "approve", prTitle: "feat: profile screen", findings: [] },
      calls
    );
    try {
      const result = await executeReview({
        diff: readDiff("negative.diff"),
        fakePr: { title: "feat: profile screen", user: { login: "dev" }, body: null },
        renderComment: () => "",
      });
      assert.equal(result.scannerFindings.length, 0);
      assert.equal(result.aiResult.findings.length, 0);
      assert.equal(result.allFindings.length, 0);
      assert.equal(result.verdict, "comment", "the pipeline must not auto-approve, even on clean diffs");
      const systemPrompt = calls[0].body.systemInstruction.parts[0].text;
      assert.ok(systemPrompt.includes("Flutter Review Rules"));
      assert.ok(systemPrompt.includes("PopScope"));
    } finally {
      restoreFetch();
    }
  });

  test("local-review normalization bounds and scopes merged findings to submitted files", () => {
    const findings = normalizeLocalFindings(
      [
        { file: "lib/api_client.dart", line: 9, severity: "critical", source: "scanner", title: "TLS certificate validation disabled", category: "security", explanation: "x" },
        { file: "lib/api_client.dart", line: 9, severity: "critical", source: "ai", title: "TLS certificate validation disabled", category: "security", explanation: "x" }, // dup triple
        { file: "lib/profile.freezed.dart", line: 1, severity: "high", title: "generated", explanation: "x" }, // not in submitted files
        { file: "lib/profile_screen.dart", severity: "weird", title: "No line", explanation: "x" },
      ],
      ["lib/api_client.dart", "lib/profile_screen.dart"]
    );
    assert.equal(findings.length, 2);
    assert.equal(findings[0].severity, "critical");
    assert.equal(findings[0].source, "scanner");
    assert.equal(findings[1].severity, "info");
    assert.equal(findings[1].line, null);
  });
});
