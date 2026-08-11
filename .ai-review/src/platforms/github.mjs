  // GitHub Actions platform adapter.
  // Reads the PR context from GITHUB_EVENT_PATH and posts inline review comments
  // with ```suggestion blocks so users get the native "Apply suggestion" button.

  import { readFile } from 'node:fs/promises';

  const API = 'https://api.github.com';

  export class GitHubPlatform {
    constructor() {
      this.name = 'github';
      this.token = process.env.GITHUB_TOKEN;
      this.repo = process.env.GITHUB_REPOSITORY; // "owner/repo"
      if (!this.token) throw new Error('GITHUB_TOKEN not set.');
      if (!this.repo) throw new Error('GITHUB_REPOSITORY not set.');
    }

    async #gh(path, init = {}) {
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

    async postSummary(markdown, prNumber) {
      // Post/replace a single sticky summary comment identified by a hidden marker.
      const marker = '<!-- marafiq-ai-review-summary -->';
      const body = `${marker}\n${markdown}`;
      const existing = await this.#gh(
        `/repos/${this.repo}/issues/${prNumber}/comments?per_page=100`,
      );
      const mine = existing.find((c) => (c.body || '').startsWith(marker));
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

    /**
     * Posts a single "review" containing all inline comments so each one gets the
     * native "Apply suggestion" button.
     * @param {string} headSha commit SHA the comments attach to
     * @param {Array<{path, line, endLine?, body}>} comments
     * @param {number} prNumber
     * @param {'COMMENT'|'REQUEST_CHANGES'|'APPROVE'} event
     */
    async postInlineComments({ headSha, comments, prNumber, event }) {
      const initialCount = comments.length;

      // Cross-run dedup: skip any comment whose fingerprint was already posted in a prior
      // review on this PR. Prevents re-runs from stacking the same finding on the same line.
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
        } catch (err) {
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
      } catch (err) {
        // If a single comment references a line that isn't part of the diff, GitHub 422s
        // the whole review. Fall back to posting comments one at a time and swallow individual failures.
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
          } catch (inner) {
            console.warn(`[ai-review] skipped comment on ${c.path}:${c.line} — ${inner.message}`);
          }
        }
      }
    }

    async #listAllReviewComments(prNumber) {
      const all = [];
      let page = 1;
      // Safety cap: 20 pages × 100 = 2000 comments. Any PR exceeding that has bigger problems.
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

  async updatePrTitle(prNumber, newTitle) {
    await this.#gh(`/repos/${this.repo}/pulls/${prNumber}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle }),
    });
  }
}
