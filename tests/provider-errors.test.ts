import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetries } from "../src/lib/reviewer-core/provider-request.ts";
import { allProvidersFailed, localReviewFailure } from "../src/lib/reviewer-core/provider-errors.ts";

test("exhausted Gemini high-demand retries produce a safe, retryable local-review error", async () => {
  let calls = 0;
  const privateDetail = "private-provider-response-with-source-code";
  let failure: unknown;
  try {
    await fetchWithRetries("gemini", async () => {
      calls++;
      return Response.json({ error: { code: 503, message: privateDetail } }, { status: 503 });
    }, { wait: async () => {} });
  } catch (error) { failure = error; }
  assert.equal(calls, 6);
  assert.ok(failure instanceof Error && "status" in failure);
  const combined = allProvidersFailed([{ provider: "gemini", message: failure.message, status: failure.status as number }]);
  const response = localReviewFailure(combined);
  assert.equal(response.status, 503);
  assert.equal(response.body.errorCode, "AI_PROVIDER_UNAVAILABLE");
  assert.match(response.body.error, /high demand.*again/);
  assert.ok(!JSON.stringify(response).includes(privateDetail));
});

test("mixed provider failures and unexpected errors keep private details out of local-review responses", () => {
  const mixed = allProvidersFailed([
    { provider: "gemini", message: "private high-demand detail", status: 503 },
    { provider: "openai", message: "private authentication detail", status: 401 },
  ]);
  for (const error of [mixed, new Error("private source and provider credentials")]) {
    const response = localReviewFailure(error);
    assert.equal(response.status, 502);
    assert.equal(response.body.errorCode, "AI_REVIEW_FAILED");
    assert.ok(!JSON.stringify(response).includes("private"));
  }
});
