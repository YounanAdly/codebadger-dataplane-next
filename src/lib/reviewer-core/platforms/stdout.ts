// Fallback platform for local runs.

import { spawnSync } from 'node:child_process';

export class StdoutPlatform {
  name: string;

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

  async postSummary(markdown: string) {
    console.log('\n===== SUMMARY =====\n');
    console.log(markdown);
  }

  async postInlineComments({ comments }: { comments: any[] }) {
    console.log(`\n===== INLINE COMMENTS (${comments.length}) =====\n`);
    for (const c of comments) {
      const range = c.endLine ? `${c.line}-${c.endLine}` : `${c.line}`;
      console.log(`--- ${c.path}:${range} ---`);
      console.log(c.body);
      console.log();
    }
  }

  async updatePrTitle(_prNumber: number, newTitle: string) {
    console.log(`\n===== WOULD UPDATE PR TITLE =====\n"${newTitle}"\n`);
  }
}

function run(cmd: string) {
  const [bin, ...args] = cmd.split(' ');
  const res = spawnSync(bin, args, { encoding: 'utf8' });
  return res.stdout || '';
}
