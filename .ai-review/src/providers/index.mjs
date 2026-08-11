// Chooses the right AI provider based on config.provider.
// Every adapter exports the same shape:
//   { name, review({ system, user, model, temperature, maxOutputTokens }): Promise<string /* raw text */> }

export async function createProvider(cfg) {
  switch (cfg.provider) {
    case 'gemini': {
      const { GeminiProvider } = await import('./gemini.mjs');
      return new GeminiProvider();
    }
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic.mjs');
      return new AnthropicProvider();
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai.mjs');
      return new OpenAIProvider();
    }
    case 'azure-openai': {
      const { AzureOpenAIProvider } = await import('./openai.mjs');
      return new AzureOpenAIProvider();
    }
    case 'copilot': {
      const { GitHubModelsProvider } = await import('./copilot.mjs');
      return new GitHubModelsProvider();
    }
    default:
      throw new Error(
        `Unknown AI_REVIEW_PROVIDER "${cfg.provider}". Expected: gemini | anthropic | openai | azure-openai | copilot`,
      );
  }
}
