// OpenAI + Azure OpenAI adapters.

export class OpenAIProvider {
  name: string;
  apiKey: string;

  constructor() {
    this.name = 'openai';
    this.apiKey = process.env.OPENAI_API_KEY || '';
    if (!this.apiKey) throw new Error('OPENAI_API_KEY is not set.');
  }

  async review({ system, user, model, temperature, maxOutputTokens }: { system: string; user: string; model: string; temperature?: number; maxOutputTokens?: number }) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
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
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}

export class AzureOpenAIProvider {
  name: string;
  apiKey: string;
  endpoint: string;
  deployment: string;

  constructor() {
    this.name = 'azure-openai';
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/+$/, '');
    this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT || '';
    if (!this.apiKey || !this.endpoint || !this.deployment) {
      throw new Error(
        'AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT must all be set.',
      );
    }
  }

  async review({ system, user, temperature, maxOutputTokens }: { system: string; user: string; temperature?: number; maxOutputTokens?: number }) {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=2024-08-01-preview`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        temperature,
        max_tokens: maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AzureOpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }
}
