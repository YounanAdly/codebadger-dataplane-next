// Loads config.json and every rules/instruction markdown listed in it.
// Everything is read once at boot so we can build a single big system prompt.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Keep rule loading inside a fixed set of bundled files. A dynamic path from
// config.json makes the production bundler trace the whole project and would
// also allow a changed config to read unrelated server files.
const RULE_READERS: Record<string, () => Promise<string>> = {
  'rules.md': () => readFile(join(process.cwd(), 'rules.md'), 'utf8'),
  '.github/copilot-instructions.md': () => readFile(join(process.cwd(), '.github/copilot-instructions.md'), 'utf8'),
  '.github/instructions/angular/accessibility.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/accessibility.instructions.md'), 'utf8'),
  '.github/instructions/angular/api-calls.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/api-calls.instructions.md'), 'utf8'),
  '.github/instructions/angular/error-handling.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/error-handling.instructions.md'), 'utf8'),
  '.github/instructions/angular/formly-forms.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/formly-forms.instructions.md'), 'utf8'),
  '.github/instructions/angular/i18n.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/i18n.instructions.md'), 'utf8'),
  '.github/instructions/angular/shared-reuse.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/shared-reuse.instructions.md'), 'utf8'),
  '.github/instructions/angular/styling-themes.instructions.md': () => readFile(join(process.cwd(), '.github/instructions/angular/styling-themes.instructions.md'), 'utf8'),
};

export async function loadConfig() {
  const configPath = join(process.cwd(), 'config.json');
  const raw = await readFile(configPath, 'utf8');
  const cfg = JSON.parse(raw);

  // Env overrides so CI can flip provider/model without editing config.json
  const provider = (process.env.AI_REVIEW_PROVIDER || cfg.provider || 'gemini').toLowerCase();
  const model = process.env.AI_REVIEW_MODEL || cfg.model?.[provider] || cfg.model?.gemini;

  const envAutoUpdate = process.env.AI_REVIEW_AUTO_UPDATE_TITLE;
  const autoUpdatePrTitle =
    envAutoUpdate === '1' ? true :
    envAutoUpdate === '0' ? false :
    cfg.autoUpdatePrTitle !== false;

  return {
    ...cfg,
    provider,
    model,
    autoUpdatePrTitle,
    dryRun: process.env.AI_REVIEW_DRY_RUN === '1',
    soft: process.env.AI_REVIEW_SOFT === '1',
  };
}

export async function loadRuleCorpus(cfg: any) {
  const parts: string[] = [];
  for (const rel of cfg.rulesFiles || []) {
    const readRule = RULE_READERS[rel];
    if (!readRule) {
      console.warn(`[ai-review] unrecognized rules file, skipping: ${rel}`);
      continue;
    }
    try {
      const body = await readRule();
      parts.push(`\n\n===== ${rel} =====\n\n${body.trim()}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      console.warn(`[ai-review] rules file missing, skipping: ${rel}`);
    }
  }
  return parts.join('\n');
}
