// GitHub Models / Copilot inference endpoint.

export class GitHubModelsProvider {
  name: string;
  token: string;

  constructor() {
    this.name = 'copilot';
    this.token = process.env.GITHUB_TOKEN || '';
    if (!this.token) {
      throw new Error('GITHUB_TOKEN is not set (required for GitHub Models provider).');
    }
  }

  async review({ system, user, model, temperature, maxOutputTokens }: { system: string; user: string; model: string; temperature?: number; maxOutputTokens?: number }) {
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
