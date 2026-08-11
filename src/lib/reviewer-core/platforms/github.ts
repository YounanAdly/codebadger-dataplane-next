// GitHub Actions platform adapter.

import { readFile } from 'node:fs/promises';

const API = 'https://api.github.com';

export class GitHubPlatform {
  name: string;
  token: string;
  repo: string;

  constructor() {
    this.name = 'github';
    this.token = process.env.GITHUB_TOKEN || '';
    this.repo = process.env.GITHUB_REPOSITORY || ''; // "owner/repo"
    if (!this.token) throw new Error('GITHUB_TOKEN not set.');
    if (!this.repo) throw new Error('GITHUB_REPOSITORY not set.');
  }

  async #gh(path: string, init: any = {}) {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        authorization: `Bearer ${this.token}`,
        'user-agent': 'marafiq-ai-review',
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`GitHub ${init.method || 'GET'} ${path} → ${res.status}: ${err.slice(0, 500)}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async getContext() {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) throw new Error('GITHUB_EVENT_PATH missing — not a PR event.');
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    const pr = event.pull_request;
    if (!pr) throw new Error('This event has no pull_request payload.');

    return {
      prNumber: pr.number,
      prTitle: pr.title,
      prBody: pr.body || '',
      prAuthor: pr.user?.login,
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
    };
  }

  async postSummary(markdown: string, prNumber: number) {
    const marker = '<!-- marafiq-ai-review-summary -->';
    const body = `${marker}\n${markdown}`;
    const existing = await this.#gh(
      `/repos/${this.repo}/issues/${prNumber}/comments?per_page=100`,
    );
    const mine = (existing || []).find((c: any) => (c.body || '').startsWith(marker));
    if (mine) {
      await this.#gh(`/repos/${this.repo}/issues/comments/${mine.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      });
    } else {
      await this.#gh(`/repos/${this.repo}/issues/${prNumber}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
    }
  }

  async postInlineComments({ headSha, comments, prNumber, event }: { headSha: string; comments: any[]; prNumber: number; event?: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE' }) {
    const initialCount = comments.length;

    if (initialCount > 0) {
      try {
        const existing = await this.#listAllReviewComments(prNumber);
        const existingFps = new Set();
        const fpRe = /<!-- marafiq-ai-review-fp:([^\s>]+) -->/;
        for (const c of existing) {
          const m = fpRe.exec(c.body || '');
          if (m) existingFps.add(m[1]);
        }
        comments = comments.filter((c) => !c.fingerprint || !existingFps.has(c.fingerprint));
        const skipped = initialCount - comments.length;
        if (skipped > 0) {
          console.log(`[ai-review] github: skipped ${skipped} inline comment(s) already posted in a prior run`);
        }
      } catch (err: any) {
        console.warn(`[ai-review] github: dedup fetch failed, posting all comments: ${err.message}`);
      }
    }

    if (comments.length === 0) {
      console.log(
        initialCount === 0
          ? '[ai-review] github: no findings; skipping inline review'
          : `[ai-review] github: all ${initialCount} finding(s) already present; skipping duplicate review`,
      );
      return;
    }

    const payload = {
      commit_id: headSha,
      event: event || 'COMMENT',
      comments: comments.map((c) => {
        const base = { path: c.path, body: c.body, side: 'RIGHT' };
        if (c.endLine && c.endLine > c.line) {
          return { ...base, start_line: c.line, start_side: 'RIGHT', line: c.endLine };
        }
        return { ...base, line: c.line };
      }),
    };

    try {
      await this.#gh(`/repos/${this.repo}/pulls/${prNumber}/reviews`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.warn(`[ai-review] bulk review post failed, falling back to per-comment: ${err.message}`);
      for (const c of payload.comments) {
        try {
          await this.#gh(`/repos/${this.repo}/pulls/${prNumber}/reviews`, {
            method: 'POST',
            body: JSON.stringify({
              commit_id: headSha,
              event: 'COMMENT',
              comments: [c],
            }),
          });
        } catch (inner: any) {
          console.warn(`[ai-review] skipped comment on ${c.path}:${c.line} — ${inner.message}`);
        }
      }
    }
  }

  async #listAllReviewComments(prNumber: number) {
    const all: any[] = [];
    let page = 1;
    while (page < 20) {
      const batch = await this.#gh(
        `/repos/${this.repo}/pulls/${prNumber}/comments?per_page=100&page=${page}`,
      );
      if (!Array.isArray(batch) || batch.length === 0) break;
      all.push(...batch);
      if (batch.length < 100) break;
      page++;
    }
    return all;
  }

  async updatePrTitle(prNumber: number, newTitle: string) {
    await this.#gh(`/repos/${this.repo}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle }),
    });
  }
}
