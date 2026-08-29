// GitHub Models / Copilot inference endpoint.

import { getGithubToken } from '@/lib/control-plane';

export class GitHubModelsProvider {
  name: string;

  constructor() {
    this.name = 'copilot';
  }

  async review({ system, user, model, temperature, maxOutputTokens }: { system: string; user: string; model: string; temperature?: number; maxOutputTokens?: number }) {
    const token = await getGithubToken();
    if (!token) {
      throw new Error('GitHub token unavailable (required for GitHub Models provider).');
    }
    const res = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
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
