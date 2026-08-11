// Azure DevOps platform adapter.
// Uses the Git REST API to read PR context and post PR comment threads.
// Azure DevOps has no native "apply suggestion" button, but we render the fix as a
// ```suggestion code block so devs can copy-paste (and, if you switch to GitHub
// Advanced Security integration or Azure DevOps Suggestions, it will Just Work).

const API_VERSION = '7.1-preview.1';

export class AzurePlatform {
  constructor() {
    this.name = 'azure';
    this.token = process.env.SYSTEM_ACCESSTOKEN;
    this.collectionUri = (process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI || '').replace(/\/+$/, '');
    this.project = process.env.SYSTEM_TEAMPROJECT;
    this.repoId = process.env.BUILD_REPOSITORY_ID;
    this.prId = process.env.SYSTEM_PULLREQUEST_PULLREQUESTID;

    if (!this.token) throw new Error('SYSTEM_ACCESSTOKEN not set. Enable "Allow scripts to access OAuth token" in the pipeline.');
    if (!this.collectionUri) throw new Error('SYSTEM_TEAMFOUNDATIONCOLLECTIONURI not set.');
    if (!this.project) throw new Error('SYSTEM_TEAMPROJECT not set.');
    if (!this.repoId) throw new Error('BUILD_REPOSITORY_ID not set.');
    if (!this.prId) throw new Error('SYSTEM_PULLREQUEST_PULLREQUESTID not set — not running on a PR.');
  }

  async #ado(path, init = {}) {
    const url = `${this.collectionUri}/${encodeURIComponent(this.project)}/_apis/git/repositories/${this.repoId}${path}${path.includes('?') ? '&' : '?'}api-version=${API_VERSION}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AzureDevOps ${init.method || 'GET'} ${path} → ${res.status}: ${err.slice(0, 500)}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  async getContext() {
    const pr = await this.#ado(`/pullRequests/${this.prId}`);
    return {
      prNumber: Number(this.prId),
      prTitle: pr.title,
      prBody: pr.description || '',
      prAuthor: pr.createdBy?.displayName || pr.createdBy?.uniqueName,
      baseSha: pr.lastMergeTargetCommit?.commitId || process.env.SYSTEM_PULLREQUEST_TARGETBRANCH,
      headSha: pr.lastMergeSourceCommit?.commitId || process.env.SYSTEM_PULLREQUEST_SOURCECOMMITID,
    };
  }

  async postSummary(markdown) {
    // Sticky summary: patch our existing thread's first comment if we already posted one,
    // otherwise open a fresh thread. Prevents a new summary from stacking on every re-run.
    const marker = '<!-- marafiq-ai-review-summary -->';
    const body = `${marker}\n**🤖 Marafiq AI Review**\n\n${markdown}`;

    try {
      const threads = await this.#listAllThreads();
      for (const t of threads) {
        const first = (t.comments || [])[0];
        if (first && (first.content || '').includes(marker)) {
          await this.#ado(
            `/pullRequests/${this.prId}/threads/${t.id}/comments/${first.id}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ content: body, parentCommentId: 0 }),
            },
          );
          return;
        }
      }
    } catch (err) {
      console.warn(`[ai-review] azure: sticky summary lookup failed, posting fresh thread: ${err.message}`);
    }

    await this.#ado(`/pullRequests/${this.prId}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        comments: [{ parentCommentId: 0, content: body, commentType: 1 }],
        status: 1, // active
      }),
    });
  }

  async postInlineComments({ comments }) {
    const initialCount = comments.length;

    // Cross-run dedup: skip any comment whose fingerprint was already posted on this PR.
    if (initialCount > 0) {
      try {
        const threads = await this.#listAllThreads();
        const existingFps = new Set();
        const fpRe = /<!-- marafiq-ai-review-fp:([^\s>]+) -->/;
        for (const t of threads) {
          for (const c of (t.comments || [])) {
            const m = fpRe.exec(c.content || '');
            if (m) existingFps.add(m[1]);
          }
        }
        comments = comments.filter((c) => !c.fingerprint || !existingFps.has(c.fingerprint));
        const skipped = initialCount - comments.length;
        if (skipped > 0) {
          console.log(`[ai-review] azure: skipped ${skipped} thread(s) already posted in a prior run`);
        }
      } catch (err) {
        console.warn(`[ai-review] azure: dedup fetch failed, posting all comments: ${err.message}`);
      }
    }

    if (comments.length === 0) {
      console.log(
        initialCount === 0
          ? '[ai-review] azure: no findings; skipping inline threads'
          : `[ai-review] azure: all ${initialCount} finding(s) already present; skipping duplicates`,
      );
      return;
    }

    for (const c of comments) {
      const thread = {
        comments: [{ parentCommentId: 0, content: c.body, commentType: 1 }],
        status: 1, // active
        threadContext: {
          filePath: c.path.startsWith('/') ? c.path : `/${c.path}`,
          rightFileStart: { line: c.line, offset: 1 },
          rightFileEnd: { line: c.endLine && c.endLine > c.line ? c.endLine : c.line, offset: 1 },
        },
      };
      try {
        await this.#ado(`/pullRequests/${this.prId}/threads`, {
          method: 'POST',
          body: JSON.stringify(thread),
        });
      } catch (err) {
        console.warn(`[ai-review] skipped comment on ${c.path}:${c.line} — ${err.message}`);
      }
    }
  }

  async #listAllThreads() {
    const data = await this.#ado(`/pullRequests/${this.prId}/threads`);
    return (data && data.value) || [];
  }

  async updatePrTitle(_prNumber, newTitle) {
    // _prNumber is ignored — Azure PR id comes from the pipeline env (this.prId).
    await this.#ado(`/pullRequests/${this.prId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle }),
    });
  }
}
