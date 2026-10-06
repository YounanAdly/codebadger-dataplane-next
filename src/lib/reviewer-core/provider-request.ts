interface RetryOptions {
  model?: string;
  wait?: (milliseconds: number) => Promise<void>;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function geminiQuota(body: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = {}; }
  const error = record(record(parsed).error);
  const message = text(error.message) || body;
  const details = Array.isArray(error.details) ? error.details.map(record) : [];
  const violations = details.flatMap((detail) =>
    Array.isArray(detail.violations) ? detail.violations.map(record) : []
  );
  const zero = violations.some((violation) =>
    violation.quotaValue === 0 || violation.quotaValue === "0"
  ) || /\blimit:\s*0(?:\s|,|$)/i.test(message);
  const daily = error.code === "quota_exceeded" || violations.some((violation) =>
    /per[_\s-]?day|daily/i.test(`${text(violation.quotaId)} ${text(violation.quotaMetric)}`)
  ) || /requests?perday|tokens?perday|per[_\s-]day|daily quota/i.test(message);
  const labels = violations.map((violation) => {
    const name = text(violation.quotaId) || text(violation.quotaMetric);
    const limit = violation.quotaValue;
    const model = text(record(violation.quotaDimensions).model);
    return [name, model && `model=${model}`,
      (typeof limit === "string" || typeof limit === "number") && `limit=${limit}`]
      .filter(Boolean).join(", ").slice(0, 300);
  }).filter(Boolean);
  const retryDelayMs = details.reduce((longest, detail) => {
    const match = text(detail.retryDelay).match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Math.max(longest, Math.ceil(Number(match[1]) * 1000)) : longest;
  }, 0);
  return { zero, daily, retryDelayMs,
    detail: labels.length ? labels.slice(0, 3).join("; ") : message.replace(/\s+/g, " ").slice(0, 500) };
}

function retryAfterMs(header: string | null): number {
  if (!header?.trim()) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds * 1000));
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

/** Retry temporary failures, but stop immediately for daily or unallocated quota. */
export async function fetchWithRetries(
  provider: string,
  doFetch: () => Promise<Response>,
  options: RetryOptions = {},
): Promise<Response> {
  const maxRetries = provider === "gemini" ? 5 : 3;
  const wait = options.wait || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let waitedMs = 0;
  let lastStatus = 0;
  let lastError = "";
  let attempts = 0;
  let requestedDelayMs = 0;
  let quota: ReturnType<typeof geminiQuota> | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await doFetch();
    attempts++;
    if (res.ok) return res;

    lastStatus = res.status;
    lastError = await res.text().catch(() => "");
    quota = provider === "gemini" && lastStatus === 429 ? geminiQuota(lastError) : undefined;
    if (quota?.zero || quota?.daily) break;
    const isTransient = [429, 500, 502, 503, 504].includes(lastStatus);
    if (!isTransient) break;

    requestedDelayMs = Math.max(retryAfterMs(res.headers.get("retry-after")), quota?.retryDelayMs || 0);
    if (attempt === maxRetries) break;
    const delayMs = requestedDelayMs || Math.pow(2, attempt + 1) * 1000 + Math.floor(Math.random() * 800);
    // Never retry sooner than Google asks; leave time for the review to finish.
    if (delayMs > 60_000 || waitedMs + delayMs > 120_000) break;
    console.warn(`[${provider}] ${lastStatus} — retrying in ${delayMs}ms (retry ${attempt + 1}/${maxRetries})`);
    await wait(delayMs);
    waitedMs += delayMs;
  }

  if (lastStatus === 429) {
    const name = options.model ? `${provider} (${options.model})` : provider;
    const reason = quota?.zero ? "has no allocated quota" : quota?.daily ? "daily quota exhausted" : "rate limit exceeded";
    const action = quota?.zero
      ? "Choose a model with available quota in AI Studio or enable billing."
      : quota?.daily
        ? "Wait for the daily reset at midnight Pacific Time, choose a model with remaining quota, or enable billing."
        : `Wait${requestedDelayMs ? ` at least ${Math.ceil(requestedDelayMs / 1000)}s` : " for quota to recover"} before retrying; reduce review size or frequency.`;
    throw Object.assign(new Error(
      `${name} ${reason} (429; ${attempts} request attempt${attempts === 1 ? "" : "s"}). ${action} ${quota?.detail || lastError.slice(0, 500)}`
    ), { status: lastStatus });
  }
  throw Object.assign(new Error(`${provider} ${lastStatus}: ${lastError.slice(0, 500)}`), { status: lastStatus });
}
