type ProviderFailure = { provider: string; message: string; status?: number };

/** Keep private diagnostics on the server and carry an explicit outage code. */
export function allProvidersFailed(failures: ProviderFailure[]): Error {
  const unavailable = failures.length > 0 && failures.every((failure) => failure.status === 503);
  return Object.assign(new Error(`All AI providers failed → ${failures.map((failure) => `${failure.provider}: ${failure.message}`).join(" | ")}`.slice(0, 1500)), {
    status: unavailable ? 503 : 502,
    code: unavailable ? "AI_PROVIDER_UNAVAILABLE" : "AI_REVIEW_FAILED",
  });
}

export function localReviewFailure(error: unknown) {
  const unavailable = error instanceof Error && "code" in error && error.code === "AI_PROVIDER_UNAVAILABLE";
  return {
    status: unavailable ? 503 : 502,
    body: unavailable
      ? { error: "The AI provider is temporarily unavailable or experiencing high demand. Try the review again in a few minutes.", errorCode: "AI_PROVIDER_UNAVAILABLE" }
      : { error: "Local review failed. Check the configured AI provider.", errorCode: "AI_REVIEW_FAILED" },
  };
}
