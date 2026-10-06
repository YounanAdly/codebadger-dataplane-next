import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, withGeminiModel } from "../src/lib/reviewer-core/gemini-model.ts";

const apiError = (status: number, message: string) => Object.assign(new Error(message), { status });

test("unset or blank model override uses Gemini 3.1 Pro without needing configuration", async (t) => {
  const originalModel = process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MODEL;
  t.after(() => { if (originalModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = originalModel; });
  for (const override of [undefined, "", "   "]) {
    const calls: string[] = [];
    assert.equal(await withGeminiModel(async (model) => { calls.push(model); return "review"; }, override), "review");
    assert.deepEqual(calls, [DEFAULT_GEMINI_MODEL]);
  }
});

test("unavailable default model falls back to Gemini 2.5 Pro", async () => {
  for (const failure of [apiError(404, "Model not found"), apiError(403, "Model is not available in this region")]) {
    const calls: string[] = [];
    const result = await withGeminiModel(async (model) => {
      calls.push(model);
      if (model === DEFAULT_GEMINI_MODEL) throw failure;
      return "fallback review";
    }, "");
    assert.equal(result, "fallback review");
    assert.deepEqual(calls, [DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]);
  }
});

test("explicit overrides are honored and are not silently replaced", async () => {
  const failure = apiError(404, "Model not found");
  const calls: string[] = [];
  await assert.rejects(withGeminiModel(async (model) => { calls.push(model); throw failure; }, " custom-model "), (error) => error === failure);
  assert.deepEqual(calls, ["custom-model"]);
});

test("quota, authentication and service failures do not trigger a model fallback", async () => {
  for (const failure of [apiError(429, "Quota exhausted"), apiError(403, "Invalid API key"), apiError(400, "Bad generation parameters"), apiError(503, "Service unavailable")]) {
    let calls = 0;
    await assert.rejects(withGeminiModel(async () => { calls++; throw failure; }, ""), (error) => error === failure);
    assert.equal(calls, 1);
  }
});

test("an unavailable fallback remains a failed review", async () => {
  const failure = apiError(404, "Model not found");
  const calls: string[] = [];
  await assert.rejects(withGeminiModel(async (model) => { calls.push(model); throw failure; }, ""), (error) => error === failure);
  assert.deepEqual(calls, [DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]);
});
