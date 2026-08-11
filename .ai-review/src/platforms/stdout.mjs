// Fallback platform for local runs.
// Prints everything to stdout so you can test the reviewer with `npm run review:dry`.

import { spawnSync } from 'node:child_process';

export class StdoutPlatform {
  constructor() {
    this.name = 'stdout';
  }

  async getContext() {
    const headSha = process.env.AI_REVIEW_HEAD_SHA || run('git rev-parse HEAD');
    const baseSha = process.env.AI_REVIEW_BASE_SHA || run('git merge-base HEAD origin/main').trim() || run('git rev-parse HEAD~1');
    return {
      prNumber: 0,
      prTitle: '(local review)',
      prBody: '',
      prAuthor: run('git config user.name').trim(),
      baseSha: baseSha.trim(),
      headSha: headSha.trim(),
    };
  }

  async postSummary(markdown) {
    console.log('\n===== SUMMARY =====\n');
    console.log(markdown);
  }

  async postInlineComments({ comments }) {
    console.log(`\n===== INLINE COMMENTS (${comments.length}) =====\n`);
    for (const c of comments) {
      const range = c.endLine ? `${c.line}-${c.endLine}` : `${c.line}`;
      console.log(`--- ${c.path}:${range} ---`);
      console.log(c.body);
      console.log();
    }
  }

  async updatePrTitle(_prNumber, newTitle) {
    console.log(`\n===== WOULD UPDATE PR TITLE =====\n"${newTitle}"\n`);
  }
}

function run(cmd) {
  const [bin, ...args] = cmd.split(' ');
  const res = spawnSync(bin, args, { encoding: 'utf8' });
  return res.stdout || '';
}
