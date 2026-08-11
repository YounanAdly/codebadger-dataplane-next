// Chooses the right AI provider based on config.provider.

export async function createProvider(cfg: { provider: string }) {
  switch (cfg.provider) {
    case 'gemini': {
      const { GeminiProvider } = await import('./gemini');
      return new GeminiProvider();
    }
    case 'anthropic': {
      const { AnthropicProvider } = await import('./anthropic');
      return new AnthropicProvider();
    }
    case 'openai': {
      const { OpenAIProvider } = await import('./openai');
      return new OpenAIProvider();
    }
    case 'azure-openai': {
      const { AzureOpenAIProvider } = await import('./openai');
      return new AzureOpenAIProvider();
    }
    case 'copilot': {
      const { GitHubModelsProvider } = await import('./copilot');
      return new GitHubModelsProvider();
    }
    default:
      throw new Error(
        `Unknown AI_REVIEW_PROVIDER "${cfg.provider}". Expected: gemini | anthropic | openai | azure-openai | copilot`,
      );
  }
}
