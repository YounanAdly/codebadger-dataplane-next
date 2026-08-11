// Auto-detects GitHub Actions vs Azure DevOps and returns the right platform adapter.

export async function detectPlatform() {
  if (process.env.GITHUB_ACTIONS === 'true') {
    const { GitHubPlatform } = await import('./github');
    return new GitHubPlatform();
  }
  if (process.env.TF_BUILD === 'True' || process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI) {
    const { AzurePlatform } = await import('./azure');
    return new AzurePlatform();
  }
  const { StdoutPlatform } = await import('./stdout');
  return new StdoutPlatform();
}
