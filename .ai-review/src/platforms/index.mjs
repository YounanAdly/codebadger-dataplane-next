// Auto-detects GitHub Actions vs Azure DevOps and returns the right platform adapter.
// Every adapter exports:
//   { name, getContext(): Promise<{ prNumber, prTitle, prBody, prAuthor, baseSha, headSha }>,
//     postSummary(markdown): Promise<void>,
//     postInlineComments(comments): Promise<void>  // comments: [{ path, line, endLine?, body }]
//   }

export async function detectPlatform() {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const { GitHubPlatform } = await import('./github.mjs');
    return new GitHubPlatform();
  }
  if (process.env.TF_BUILD === 'True' || process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI) {
    const { AzurePlatform } = await import('./azure.mjs');
    return new AzurePlatform();
  }
  // Local / unknown — fall back to a stdout-only "platform" so devs can test without CI.
  const { StdoutPlatform } = await import('./stdout.mjs');
  return new StdoutPlatform();
}
