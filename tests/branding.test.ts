import assert from "node:assert/strict";
import { test } from "node:test";
import { FINGERPRINT_REGEX, SUMMARY_MARKER, hasBotFooter, isSummaryComment } from "../src/lib/branding.ts";

test("summary comments are recognised before and after the rebrand", () => {
  assert.equal(SUMMARY_MARKER, "<!-- codrevia-ai-review-summary -->");
  assert.ok(isSummaryComment(`${SUMMARY_MARKER}\nbody`));
  assert.ok(isSummaryComment("<!-- codebadger-ai-review-summary -->\nbody"));
  assert.ok(isSummaryComment("<!-- marafiq-ai-review-summary -->\nbody"));
  assert.ok(!isSummaryComment("an ordinary comment"));
});

test("fingerprints and footers from both brands are recognised", () => {
  assert.equal(FINGERPRINT_REGEX.exec("<!-- codrevia-ai-review-fp:abc123 -->")?.[1], "abc123");
  assert.equal(FINGERPRINT_REGEX.exec("<!-- codebadger-ai-review-fp:abc123 -->")?.[1], "abc123");
  assert.ok(hasBotFooter("_AI reviewer — Codrevia AI Review_"));
  assert.ok(hasBotFooter("_AI reviewer — CodeBadger AI Review_"));
  assert.ok(hasBotFooter("<sub>Codrevia Reviewer — Codrevia</sub>"));
  assert.ok(hasBotFooter("<sub>CodeBadger Reviewer — CodeBadger</sub>"));
  assert.ok(!hasBotFooter("a human wrote this"));
});
