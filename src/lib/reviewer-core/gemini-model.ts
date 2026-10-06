// Google currently exposes Gemini 3.1 Pro through its preview API model ID.
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-pro-preview";
export const FALLBACK_GEMINI_MODEL = "gemini-2.5-pro";

export function isGeminiModelUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const failure = error as { status?: unknown; message?: unknown };
  const status = Number(failure.status);
  if (status === 404) return true;
  if (status !== 400 && status !== 403) return false;
  const message = String(failure.message || "");
  return /\bmodels?\b/i.test(message) &&
    /not found|not available|unavailable|not supported|not enabled|permission|access denied|region|location/i.test(message);
}

/** Honor an explicit model; only the built-in default may fall back on availability. */
export async function withGeminiModel<T>(
  request: (model: string) => Promise<T>,
  override = process.env.GEMINI_MODEL,
): Promise<T> {
  const explicitModel = override?.trim();
  try {
    return await request(explicitModel || DEFAULT_GEMINI_MODEL);
  } catch (error) {
    if (explicitModel || !isGeminiModelUnavailable(error)) throw error;
    console.warn(`[gemini] ${DEFAULT_GEMINI_MODEL} unavailable; trying ${FALLBACK_GEMINI_MODEL}.`);
    return request(FALLBACK_GEMINI_MODEL);
  }
}
