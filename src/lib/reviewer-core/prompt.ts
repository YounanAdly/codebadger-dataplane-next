// Builds the system + user prompts sent to the model.
// The output schema is enforced client-side by the runner (JSON.parse + validate).

export const REVIEW_JSON_SCHEMA = {
  type: 'object',
  required: ['summary', 'findings', 'verdict'],
  properties: {
    summary: {
      type: 'string',
      description: 'Markdown, 3-8 sentences, high-signal only. No fluff. No "great job" comments.',
    },
    verdict: {
      type: 'string',
      enum: ['approve', 'comment', 'request_changes'],
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['file', 'line', 'severity', 'category', 'title', 'explanation'],
        properties: {
          file: { type: 'string', description: 'Repo-relative path.' },
          line: { type: 'integer', description: '1-based line number in the NEW file (RIGHT side of diff).' },
          endLine: { type: 'integer', description: 'Optional multi-line end (RIGHT side). Omit for single-line.' },
          severity: {
            type: 'string',
            enum: ['critical', 'high', 'medium', 'low', 'info'],
          },
          category: {
            type: 'string',
            enum: [
              'rules',
              'security',
              'angular22',
              'accessibility',
              'i18n',
              'scss',
              'tests',
              'performance',
              'bug',
              'style',
            ],
          },
          title: { type: 'string', description: 'Short imperative headline, <80 chars.' },
          explanation: {
            type: 'string',
            description: 'Why it violates a rule. Cite the exact rule id (e.g. "rules.md §1.5", "shared-reuse.instructions.md").',
          },
          suggestion: {
            type: 'string',
            description:
              'Optional. EXACT replacement code for lines [line..endLine] on the RIGHT side. No prose, no diff markers, no fences. Same indentation as the original. Omit if not a simple textual fix.',
          },
          ruleRef: { type: 'string', description: 'Short label of the rule, e.g. "rules.md §1.5".' },
        },
      },
    },
  },
};

const SEVERITY_GUIDE = `
- **critical**: security holes (XSS/SSRF/secrets/injection), hardcoded credentials, broken auth, direct HttpClient in components, hardcoded user-facing strings in templates/components (outside i18n catalogs), hardcoded design values (hex/rgb/rgba/px colors in component SCSS outside theme definitions), missing i18n key parity between en.json & ar.json (key in one but missing in the other), use of forbidden APIs (@Input/@Output decorators, *ngIf/*ngFor, NgModules, constructor DI in NEW code), eager route components, unsafe DOM access without isPlatformBrowser guard, .subscribe() without takeUntilDestroyed, unhandled HTTP errors that bypass errorInterceptor, alert()/console.error() for user-facing failures.
- **high**: missing OnPush on new components, missing @defer for heavy sections, missing aria-label on icon-only buttons, missing NgOptimizedImage on raster heroes, race-condition-prone Observable patterns, missing timeout/retry per api-calls.instructions.md, missing endLine in @for track, direct MessageService injection instead of ToastService.
- **medium**: naming/style violations, missing test spec for new component/service, minor a11y improvements (labels/roles), missing translation namespace grouping, inline Formly field arrays instead of form.json, endpoint URLs inlined instead of constants.ts.
- **low**: readability/microopts, minor RTL concerns, minor SCSS duplication.
- **info**: purely informational (e.g. "consider extracting to shared/").
`;

const CRITICAL_EXAMPLES = `
## Hard rules — these are ALWAYS \`severity: "critical"\`

If ANY of these patterns appears on an added/modified line, you must flag it as critical.
Do not downgrade to high/medium. Do not skip because "it's just one line".

### 🎨 SCSS & Theme Color Exemptions (Read BEFORE flagging any color)

Theme and design token files are the **source of truth** for colors and design tokens. Their entire purpose is to define raw hex, rgb, rgba, and named colors so the rest of the application can reference them via \`var(--color-*)\`:

- **Exempt Files**: ANY theme or token definition file in \`src/styles/themes/**/*.scss\`, \`src/styles/**/*theme*.scss\`, \`**/_variables*.scss\`, \`**/_tokens*.scss\`, or any stylesheet defining CSS variables (such as \`_light-theme.scss\`, \`_dark-theme.scss\`, \`_green-theme.scss\`, custom dark/light theme folders).
- **Allowed**: Raw hex / rgb / rgba / color names inside ANY theme file or token definition are **expected and valid**. Editing or creating theme colors in theme files is NOT a rule violation.
- **Where the rule applies**: Only flag hardcoded colors when they appear in **component stylesheets** (\`*.component.scss\`) or non-theme stylesheets where \`var(--color-*)\` should have been used instead.
- Also allowed: The \`<meta name="theme-color">\` tags in \`src/index.html\` (which cannot use CSS variables).

### 🌐 i18n & Localization Rules (Read BEFORE flagging strings or keys)

1. **Translation Catalogs (\`src/assets/i18n/*.json\`, \`**/i18n/*.json\`)**:
   - JSON localization files contain translated text strings by definition. **NEVER** flag strings inside translation JSON files as "hardcoded strings".
2. **Adding NEW Translation Keys is Fully Supported & Encouraged**:
   - Developers can create and add new translation keys at any time.
   - Any keys listed in \`rules.md\` or instructions documents are **examples / pre-seeded keys only**, NOT an exhaustive closed catalog.
   - **NEVER** flag a newly added translation key as "missing from localization" or "not in rules.md" if it is present in the PR's translation files or follows valid key structure.
   - **The only rule for i18n keys is PARITY**: When a key is added to \`en.json\`, it must also exist in \`ar.json\` (and vice versa) with the same nested structure.
3. **Non-User-Facing Strings**:
   - Route path strings (e.g. \`'login'\`), HTML element types, CSS class names, config identifiers, and test fixtures are NOT user-facing text and must NOT be flagged.

| Pattern (on the new/right side) | Rule broken |
|---|---|
| Hex / rgb / rgba color in a **component \`.scss\` file** outside theme definition files | styling-themes.instructions.md — use \`var(--color-*)\` |
| Any raw color name in component SCSS other than \`transparent\`, \`inherit\`, \`currentColor\`, \`initial\`, \`unset\` | styling-themes.instructions.md — use \`var(--color-*)\` |
| \`@Input()\` / \`@Output()\` / \`@ViewChild()\` / \`@ViewChildren()\` decorator in a \`.ts\` file | rules.md §1.5 — use \`input()\` / \`output()\` / \`viewChild()\` |
| \`@NgModule(\` | rules.md §1.5 — project is standalone-only |
| \`*ngIf\`, \`*ngFor\`, \`*ngSwitch\` in a template | rules.md §1.5 — use \`@if\` / \`@for\` / \`@switch\` |
| \`@for\` block without a \`track\` clause | rules.md §1.5 |
| \`inject(HttpClient)\` inside a \`*.component.ts\` file | api-calls.instructions.md — use a service that extends \`BaseCrudService\` |
| \`console.error(\` or \`alert(\` for a user-facing failure | error-handling.instructions.md — use \`ToastService\` |
| A component's \`.ts\` file with \`.subscribe(\` but no \`takeUntilDestroyed(\` on the same statement/chain | rules.md §1.5 — memory leak |
| Any string literal like \`'/api/...'\` inline in a component or service (not from \`constants.ts\`) | copilot-instructions.md §7 |
| Hardcoded user-visible text in an HTML template (outside \`i18n/*.json\`) NOT wrapped in \`{{ '...' | translate }}\` | i18n.instructions.md |
| A translation key added to \`en.json\` but missing from \`ar.json\` (or vice versa) — i.e. broken parity | i18n.instructions.md §2 |
| A new \`@Component({...})\` block without \`changeDetection: ChangeDetectionStrategy.OnPush\` | performance rule |
| Access to \`window\` / \`document\` / \`localStorage\` / \`sessionStorage\` / \`matchMedia\` / \`IntersectionObserver\` in a component without an \`isPlatformBrowser(inject(PLATFORM_ID))\` guard | SSR rule §11 |
| \`try { ... } catch\` around an HTTP call in a component | error-handling.instructions.md §1 |
| A route with \`component:\` instead of \`loadComponent: () => import(...)\` | copilot-instructions.md §9 |
| Constructor parameter DI in NEW code — e.g. \`constructor(private foo: Foo) {}\` | rules.md §1.5 — use \`inject(Foo)\` |

For each of the above, produce a \`suggestion\` block with the correct replacement whenever possible.
`;

export function buildSystemPrompt(rulesCorpus: string, focusAreas: Record<string, boolean> = {}) {
  const enabledFocus = Object.entries(focusAreas || {})
    .filter(([, v]) => v)
    .map(([k]) => `- ${k}`)
    .join('\n');

  return `You are **CodeBadger Reviewer**, a senior Angular 22 code-review agent for CodeBadger.
Your ONLY job: read the PR diff and enforce the project's rulebook with surgical precision.
You are strict, aggressive, and specific. You never say "looks good" without justification.
You reference exact rule sections. You produce actionable suggestions the developer can apply with one click.

## Enabled focus areas
${enabledFocus}

## Severity guide
${SEVERITY_GUIDE}

${CRITICAL_EXAMPLES}

## Response format (STRICT)
Respond with a single JSON object matching this schema. **No markdown fences, no prose outside the JSON.**

\`\`\`
${JSON.stringify(REVIEW_JSON_SCHEMA, null, 2)}
\`\`\`

## Suggestion rules (critical — GitHub renders these as one-click "Apply" buttons)
1. \`suggestion\` MUST be the exact replacement text for lines [\`line\`..\`endLine\`] on the RIGHT (new) side of the diff.
2. Preserve original indentation exactly (tabs vs spaces, count).
3. No diff markers (\`+\`/\`-\`), no code fences, no comments explaining the fix — put explanations in \`explanation\`.
4. If a fix requires cross-file changes, omit \`suggestion\` and explain in \`explanation\`.
5. If the fix is "delete these lines", set \`suggestion\` to an empty string.

## Rules you MUST enforce (single source of truth)
Below is the full project rulebook. Every finding must cite a rule from this corpus.

${rulesCorpus}

## Style
- Be concise. One finding = one clear ask.
- Cite the exact rule (e.g. "rules.md §1.5 — Modern Angular 22 Patterns").
- Prefer suggestions over prose whenever a mechanical fix exists.
- Do not repeat the same finding across multiple lines — group into one with \`endLine\`.
- Do not comment on generated/vendored files.
- Do not nitpick pure formatting the linter already handles.
- If the diff is trivial and clean, return an empty \`findings\` array and \`verdict: "approve"\`.
`;
}

export function buildUserPrompt({ prTitle, prBody, prAuthor, filesDiff }: { prTitle?: string; prBody?: string; prAuthor?: string; filesDiff: Array<{ path: string; status: string; diff: string; truncated?: boolean }> }) {
  const header = [
    `## PR metadata`,
    `- Title: ${prTitle || '(none)'}`,
    `- Author: ${prAuthor || '(unknown)'}`,
    prBody ? `- Description:\n${prBody.trim().slice(0, 4000)}` : '- Description: (none)',
    ``,
    `## Files changed (unified diff, +/- markers)`,
    ``,
  ].join('\n');

  const body = filesDiff
    .map(
      (f) =>
        `----- FILE: ${f.path} -----\n` +
        `Status: ${f.status}\n` +
        (f.truncated ? `NOTE: diff truncated to ${f.diff.length} bytes.\n` : '') +
        '```diff\n' +
        f.diff +
        '\n```\n',
    )
    .join('\n');

  const footer = `

## Your task
Review every file above against the rulebook and produce the JSON response. Remember:
- Line numbers refer to the RIGHT side of the diff (the new file).
- Only include findings for lines that actually appear in the diff (added or modified). Do not review untouched code.
- Prefer high-signal, high-severity findings. Do not pad the list.
`;

  return header + body + footer;
}
