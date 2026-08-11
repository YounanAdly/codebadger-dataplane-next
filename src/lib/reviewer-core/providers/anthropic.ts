// Anthropic Claude adapter.

export class AnthropicProvider {
  name: string;
  apiKey: string;

  constructor() {
    this.name = 'anthropic';
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set.');
    }
  }

  async review({ system, user, model, temperature, maxOutputTokens }: { system: string; user: string; model: string; temperature?: number; maxOutputTokens?: number }) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 500)}`);
    }
    const data = await res.json();
    return (data.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  }
}
