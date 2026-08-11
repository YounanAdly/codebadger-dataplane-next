# Marafiq AI Code Review

A CodeRabbit-style reviewer that reads this project's **`rules.md` + `.github/copilot-instructions.md` + `.github/instructions/*.md`** and enforces them on every pull request.

- Works on **both** GitHub Actions and Azure DevOps (auto-detects at runtime).
- Provider-agnostic: **Gemini** now, switch to **GitHub Copilot / Claude / Azure OpenAI** later by flipping one variable.
- Posts a **summary comment** + **inline suggestions** on the exact lines that break a rule.
- On GitHub, each suggestion renders with the native **"Apply suggestion"** button (one-click fix, no rebase).
- **Fails the PR check** on any `critical` finding — the reviewer becomes a required build gate.

---

## What it enforces

Everything already documented in your rulebook:

| Category | Source of truth |
|---|---|
| Rules compliance | [rules.md](../rules.md) + [.github/copilot-instructions.md](../.github/copilot-instructions.md) |
| Angular 22 modernness (signals, no NgModules, no `*ngIf`, `OnPush`, `input()`/`output()`, `takeUntilDestroyed`) | rules.md §1.5, shared-reuse.instructions.md |
| Reuse-first (search `shared/` before adding new components/services) | shared-reuse.instructions.md |
| API calls (httpResource/rxResource, no HttpClient in components, timeouts/retries) | api-calls.instructions.md |
| Error handling (errorInterceptor, ToastService, no `try/catch`/`console.error`/`alert`) | error-handling.instructions.md |
| Formly forms (JSON-driven, no inline field arrays) | formly-forms.instructions.md |
| i18n parity (every key in both `en.json` and `ar.json`, no hardcoded strings) | i18n.instructions.md |
| SCSS tokens (no hex/rgba, use `var(--color-*)`, RTL-safe) | styling-themes.instructions.md |
| Accessibility (WCAG AA, CDK primitives, aria-label on icon-only buttons) | accessibility.instructions.md |
| Security (OWASP Top 10, hardcoded secrets, XSS, SSRF, unsafe DOM) | built into the prompt |
| Performance (`@defer`, `NgOptimizedImage` priority LCP, unnecessary re-renders) | built into the prompt |
| Test coverage (missing `.spec.ts` for new components/services) | built into the prompt |

---

## Setup — GitHub (Actions)

1. Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `GEMINI_API_KEY` → your Gemini key
2. Optional variables (Settings → Variables tab):
   - `AI_REVIEW_PROVIDER` = `gemini` (default) — change later to `anthropic`, `copilot`, `openai`, `azure-openai`
   - `AI_REVIEW_SOFT` = `1` (soft rollout mode: comments but does not block merges). Remove once the team is used to it.
3. Merge this branch. On the **next pull request**, the workflow [`.github/workflows/ai-code-review.yml`](../.github/workflows/ai-code-review.yml) runs automatically.
4. Recommended: **Settings → Branches → Add rule → Require status checks to pass**, then tick **AI Code Review / review**.

That's it. No app install, no webhook, no marketplace subscription.

### Later: switch to GitHub Copilot / Claude in production

Two options, one-variable change:

- **GitHub Models (free, uses `GITHUB_TOKEN` automatically)** — no new secret required.
  Set variable `AI_REVIEW_PROVIDER=copilot`. Model defaults to `gpt-4o` — override with `AI_REVIEW_MODEL=Meta-Llama-3.1-70B-Instruct` etc.
- **Anthropic Claude direct** — add secret `ANTHROPIC_API_KEY`, set variable `AI_REVIEW_PROVIDER=anthropic`. Model defaults to `claude-sonnet-4-5`.
- **Azure OpenAI (enterprise)** — add secrets `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, set variable `AI_REVIEW_PROVIDER=azure-openai`.

No file edits needed. The workflow already forwards every secret; only the provider variable decides which one is used.

---

## Setup — Azure DevOps

1. **Pipelines → New pipeline → Existing YAML file** → pick [`azure-pipelines-ai-review.yml`](../azure-pipelines-ai-review.yml).
2. Once created, click **Edit → Variables** and add these (tick **Keep this value secret** for each):
   - `GEMINI_API_KEY` (current)
   - Later: `ANTHROPIC_API_KEY` / `AZURE_OPENAI_API_KEY` / `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_DEPLOYMENT`
3. **Edit → More actions → Triggers → YAML → Continue** and make sure **"Allow scripts to access the OAuth token"** is enabled on the agent job.
4. **Project settings → Repositories → your repo → Policies → Branch Policies → main → Build Validation → Add**:
   - Build pipeline: the one you just created
   - Trigger: Automatic
   - Policy requirement: Required
5. Done. Every PR now runs the reviewer.

### Switching providers in Azure DevOps

Edit the top of `azure-pipelines-ai-review.yml`:

```yaml
variables:
  AI_REVIEW_PROVIDER: 'anthropic'   # or 'azure-openai', 'openai', 'copilot'
  AI_REVIEW_SOFT: '0'
```

Add the matching secret variable in **Pipelines → Variables** and commit. That's the whole change.

> **Note on "Apply suggestion" buttons in Azure DevOps.** Azure DevOps does not currently render a one-click "apply" button for `` ```suggestion `` blocks like GitHub does. The reviewer still emits them so devs can copy-paste, and the moment Microsoft ships native suggestion support (or you enable a Marketplace extension that does), it will Just Work with zero code change.

---

## Local testing (no CI needed)

```bash
cd .ai-review
cp .env.example .env         # then fill in GEMINI_API_KEY
npm install

# Compare current HEAD against origin/main and print findings to stdout.
# Nothing is posted anywhere — safe to run repeatedly.
npm run review:dry
```

Optional env overrides for local runs:

```bash
AI_REVIEW_BASE_SHA=<sha> AI_REVIEW_HEAD_SHA=<sha> npm run review:dry
```

---

## Configuration

Edit [`config.json`](./config.json) to change defaults without touching code:

- `provider` — default provider if `AI_REVIEW_PROVIDER` env is not set
- `model` — per-provider model choice
- `temperature`, `maxOutputTokens`
- `failOnSeverity` — which severities fail the CI check (default: `["critical"]`)
- `maxFilesPerReview`, `maxDiffBytesPerFile`, `maxTotalDiffBytes` — safety caps for huge PRs
- `skipPathPatterns` — paths never sent to the model (locks, dist, assets, images…)
- `focusAreas` — toggle each rule category on/off
- `rulesFiles` — which markdown files are stuffed into the system prompt

---

## Architecture

```
.ai-review/
├── package.json         · deps (@google/generative-ai only)
├── config.json          · knobs (see above)
├── .env.example         · env template for local runs
└── src/
    ├── index.mjs        · entry point: auto-detect platform + provider, orchestrate
    ├── config.mjs       · load config + rulebook
    ├── prompt.mjs       · system + user prompts, JSON schema for findings
    ├── diff.mjs         · git diff parser, per-file chunking, size guards
    ├── review-runner.mjs· call model → parse JSON → render ```suggestion comments
    ├── providers/
    │   ├── index.mjs    · factory (picks based on env)
    │   ├── gemini.mjs   · current
    │   ├── anthropic.mjs· future (Claude Sonnet 4.5)
    │   ├── openai.mjs   · OpenAI + Azure OpenAI
    │   └── copilot.mjs  · GitHub Models (uses GITHUB_TOKEN, no extra secret)
    └── platforms/
        ├── index.mjs    · factory (auto-detect GHA vs Azure DevOps)
        ├── github.mjs   · sticky summary + inline review with ```suggestion
        ├── azure.mjs    · PR thread + inline threadContext comments
        └── stdout.mjs   · local dry-run fallback

.github/workflows/ai-code-review.yml   · GitHub Actions
azure-pipelines-ai-review.yml          · Azure DevOps
```

---

## FAQ

**How does it know which platform it's running on?**
`process.env.GITHUB_ACTIONS === 'true'` → GitHub. `process.env.TF_BUILD === 'True'` → Azure DevOps. Anything else → prints to stdout so `npm run review:dry` works locally.

**How much does a review cost?**
Gemini `gemini-2.5-pro` charges per input+output token. A typical PR (10 files, ~300 changed lines) is roughly 20–40k input tokens + 2–4k output. Expect **cents per PR** on Gemini and **~$0.15 per PR** on Claude Sonnet 4.5. Free on GitHub Models.

**Can devs tell the bot to ignore a finding?**
Yes — GitHub reviewers can hit "Resolve conversation" like any human comment. On Azure DevOps, use the thread status dropdown. Findings are stateless per run, so a subsequent push may re-flag the same issue — that's intentional; the rule is the rule.

**Does it re-review after every push?**
Yes. The workflow runs on `synchronize` and cancels the previous run (`concurrency: cancel-in-progress: true`), so you always see comments for the latest commit.

**Does it review AI-generated code differently?**
No. Rules apply uniformly, whether the code came from a human, Copilot, or another AI.

**Can I disable it on a specific PR?**
Mark the PR as **Draft** — the workflow skips drafts. Ready-for-review triggers it again.

**Where do I file bugs about the reviewer itself?**
Open a GitHub issue in this repo. Include the PR number, the finding, and what should have happened.
