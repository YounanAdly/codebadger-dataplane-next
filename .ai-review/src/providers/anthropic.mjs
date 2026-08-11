// Anthropic Claude adapter (production target).
// Uses the Messages REST API directly to avoid extra deps.
// Env: ANTHROPIC_API_KEY.

export class AnthropicProvider {
  constructor() {
    this.name = 'anthropic';
    this.apiKey = process.env.ANTHROPIC_API_KEY;
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set.');
    }
  }

  async review({ system, user, model, temperature, maxOutputTokens }) {
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
    // content is an array of blocks; concatenate text blocks
    return (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');
  }
}
