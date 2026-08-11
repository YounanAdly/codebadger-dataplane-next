// Google Gemini adapter.
// Uses @google/generative-ai. Env: GEMINI_API_KEY.

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider {
  name: string;
  client: GoogleGenerativeAI;

  constructor() {
    this.name = 'gemini';
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set.');
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async review({ system, user, model, temperature, maxOutputTokens }: { system: string; user: string; model: string; temperature?: number; maxOutputTokens?: number }) {
    const generative = this.client.getGenerativeModel({
      model,
      systemInstruction: system,
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: 'application/json',
      },
    });

    const result = await generative.generateContent({
      contents: [{ role: 'user', parts: [{ text: user }] }],
    });

    const text = result.response.text();
    return text;
  }
}
