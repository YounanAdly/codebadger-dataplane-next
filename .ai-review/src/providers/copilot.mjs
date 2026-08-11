// GitHub Models / Copilot inference endpoint.
// Uses the GITHUB_TOKEN present in every GitHub Actions run, so no extra secret is needed.
// Docs: https://models.inference.ai.azure.com/
// This is the target for "production" once the company moves off Gemini.

export class GitHubModelsProvider {
  constructor() {
    this.name = 'copilot';
    this.token = process.env.GITHUB_TOKEN;
    if (!this.token) {
      throw new Error('GITHUB_TOKEN is not set (required for GitHub Models provider).');
    }
  }

  async review({ system, user, model, temperature, maxOutputTokens }) {
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`GitHubModels ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
