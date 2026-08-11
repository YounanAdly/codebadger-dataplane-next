// Loads config.json and every rules/instruction markdown listed in it.
// Everything is read once at boot so we can build a single big system prompt.

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

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
    const abs = join(process.cwd(), rel);
    if (!existsSync(abs)) {
      console.warn(`[ai-review] rules file missing, skipping: ${rel}`);
      continue;
    }
    const body = await readFile(abs, 'utf8');
    parts.push(`\n\n===== ${rel} =====\n\n${body.trim()}`);
  }
  return parts.join('\n');
}
