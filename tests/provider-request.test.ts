import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchWithRetries } from "../src/lib/reviewer-core/provider-request.ts";

function quotaResponse(quotaId: string, quotaValue?: string, retryDelay = "55s") {
  return Response.json({ error: { code: 429, message: "Quota exceeded", details: [
    { "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{
      quotaId, quotaValue, quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
      quotaDimensions: { model: "gemini-3.8-flash" },
    }] },
    { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay },
  ] } }, { status: 429 });
}

test("daily exhaustion stops after one request even when Google includes a short retry delay", async () => {
  let calls = 0;
  await assert.rejects(fetchWithRetries("gemini", async () => {
    calls++; return quotaResponse("GenerateRequestsPerDayPerProjectPerModel-FreeTier", "20");
  }, { model: "gemini-3.8-flash", wait: async () => assert.fail("Daily quota must not be retried") }),
  (error: Error & { status?: number }) => {
    assert.equal(error.status, 429);
    assert.match(error.message, /gemini-3\.8-flash.*daily quota exhausted.*1 request attempt/);
    assert.match(error.message, /midnight Pacific Time/);
    assert.match(error.message, /GenerateRequestsPerDay.*limit=20/);
    return true;
  });
  assert.equal(calls, 1);
});

test("zero quota stops immediately and distinguishes unavailable quota from prior usage", async () => {
  for (const response of [
    () => quotaResponse("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "0"),
    () => Response.json({ error: { message: "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.1-pro-preview" } }, { status: 429 }),
  ]) {
    let calls = 0;
    await assert.rejects(fetchWithRetries("gemini", async () => { calls++; return response(); },
      { wait: async () => assert.fail("Zero quota must not be retried") }), /has no allocated quota/);
    assert.equal(calls, 1);
  }
});

test("temporary token throttling waits for RetryInfo and can succeed on the next request", async () => {
  let calls = 0;
  const delays: number[] = [];
  const response = await fetchWithRetries("gemini", async () => {
    if (++calls === 1) return quotaResponse("GenerateContentInputTokensPerModelPerMinute-FreeTier", "250000", "55.5s");
    return new Response("review");
  }, { wait: async (ms) => { delays.push(ms); } });
  assert.equal(await response.text(), "review");
  assert.equal(calls, 2);
  assert.deepEqual(delays, [55_500]);
});

test("missing quotaValue is not mistaken for zero quota and the longer retry hint is honored", async () => {
  let calls = 0;
  const delays: number[] = [];
  await fetchWithRetries("gemini", async () => {
    if (++calls > 1) return new Response("review");
    const response = quotaResponse("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", undefined, "10s");
    response.headers.set("retry-after", "25");
    return response;
  }, { wait: async (ms) => { delays.push(ms); } });
  assert.equal(calls, 2);
  assert.deepEqual(delays, [25_000]);
});

test("a long server delay stops the review without retrying earlier than instructed", async () => {
  let calls = 0;
  await assert.rejects(fetchWithRetries("gemini", async () => {
    calls++; return quotaResponse("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "5", "90s");
  }, { wait: async () => assert.fail("Cannot shorten Google's requested delay") }), /Wait at least 90s/);
  assert.equal(calls, 1);
});

test("repeated minute throttling respects the total wait budget", async () => {
  let calls = 0;
  const delays: number[] = [];
  await assert.rejects(fetchWithRetries("gemini", async () => {
    calls++; return quotaResponse("GenerateRequestsPerMinutePerProjectPerModel-FreeTier", "5", "60s");
  }, { wait: async (ms) => { delays.push(ms); } }), /rate limit exceeded.*3 request attempts/);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [60_000, 60_000]);
});

test("unstructured throttling stays bounded and reports its actual request count", async () => {
  let calls = 0;
  await assert.rejects(fetchWithRetries("gemini", async () => {
    calls++; return new Response("Too many requests", { status: 429 });
  }, { wait: async () => {} }), /rate limit exceeded.*6 request attempts.*Too many requests/);
  assert.equal(calls, 6);
});

test("authentication is not retried while temporary non-Gemini service failures can recover", async () => {
  let calls = 0;
  await assert.rejects(fetchWithRetries("gemini", async () => {
    calls++; return new Response("Invalid API key", { status: 403 });
  }, { wait: async () => assert.fail("Authentication must not be retried") }),
  (error: Error & { status?: number }) => error.status === 403);
  assert.equal(calls, 1);
  calls = 0;
  const response = await fetchWithRetries("openai", async () =>
    ++calls === 1 ? new Response("Unavailable", { status: 503 }) : new Response("review"),
  { wait: async () => {} });
  assert.equal(await response.text(), "review");
  assert.equal(calls, 2);
});
