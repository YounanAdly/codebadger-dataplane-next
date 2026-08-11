// Azure DevOps platform adapter.

const API_VERSION = '7.1-preview.1';

export class AzurePlatform {
  name: string;
  token: string;
  collectionUri: string;
  project: string;
  repoId: string;
  prId: string;

  constructor() {
    this.name = 'azure';
    this.token = process.env.SYSTEM_ACCESSTOKEN || '';
    this.collectionUri = (process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI || '').replace(/\/+$/, '');
    this.project = process.env.SYSTEM_TEAMPROJECT || '';
    this.repoId = process.env.BUILD_REPOSITORY_ID || '';
    this.prId = process.env.SYSTEM_PULLREQUEST_PULLREQUESTID || '';

    if (!this.token) throw new Error('SYSTEM_ACCESSTOKEN not set.');
    if (!this.collectionUri) throw new Error('SYSTEM_TEAMFOUNDATIONCOLLECTIONURI not set.');
    if (!this.project) throw new Error('SYSTEM_TEAMPROJECT not set.');
    if (!this.repoId) throw new Error('BUILD_REPOSITORY_ID not set.');
    if (!this.prId) throw new Error('SYSTEM_PULLREQUEST_PULLREQUESTID not set.');
  }

  async #ado(path: string, init: any = {}) {
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

  async postSummary(markdown: string) {
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
    } catch (err: any) {
      console.warn(`[ai-review] azure: sticky summary lookup failed, posting fresh thread: ${err.message}`);
    }

    await this.#ado(`/pullRequests/${this.prId}/threads`, {
      method: 'POST',
      body: JSON.stringify({
        comments: [{ parentCommentId: 0, content: body, commentType: 1 }],
        status: 1,
      }),
    });
  }

  async postInlineComments({ comments }: { comments: any[] }) {
    const initialCount = comments.length;

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
          console.log(`[ai-review] azure: skipped ${skipped} inline comment(s) already posted in a prior run`);
        }
      } catch (err: any) {
        console.warn(`[ai-review] azure: dedup fetch failed, posting all comments: ${err.message}`);
      }
    }

    if (comments.length === 0) {
      console.log(
        initialCount === 0
          ? '[ai-review] azure: no findings; skipping inline review'
          : `[ai-review] azure: all ${initialCount} finding(s) already present; skipping duplicate review`,
      );
      return;
    }

    for (const c of comments) {
      try {
        const thread: any = {
          comments: [{ parentCommentId: 0, content: c.body, commentType: 1 }],
          status: 1,
          threadContext: {
            filePath: c.path.startsWith('/') ? c.path : `/${c.path}`,
            rightFileStart: { line: c.line, offset: 1 },
            rightFileEnd: { line: c.endLine || c.line, offset: 1 },
          },
        };
        await this.#ado(`/pullRequests/${this.prId}/threads`, {
          method: 'POST',
          body: JSON.stringify(thread),
        });
      } catch (err: any) {
        console.warn(`[ai-review] azure: skipped inline comment on ${c.path}:${c.line} — ${err.message}`);
      }
    }
  }

  async #listAllThreads() {
    const res = await this.#ado(`/pullRequests/${this.prId}/threads`);
    return res.value || [];
  }

  async updatePrTitle(_prNumber: number, newTitle: string) {
    await this.#ado(`/pullRequests/${this.prId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: newTitle }),
    });
  }
}
