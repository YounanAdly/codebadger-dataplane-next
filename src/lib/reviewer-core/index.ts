// CodeBadger AI Review Core Engine

export { loadConfig, loadRuleCorpus } from './config';
export { collectDiff } from './diff';
export { buildSystemPrompt, buildUserPrompt } from './prompt';
export { createProvider } from './providers';
export { detectPlatform } from './platforms';
export {
  runReview,
  findingsToComments,
  renderSummary,
  mergeFindings,
  computeVerdict,
  fingerprintOf,
} from './review-runner';
export { scanDiff, validateScope, suggestPrTitle } from './rules-scanner';
