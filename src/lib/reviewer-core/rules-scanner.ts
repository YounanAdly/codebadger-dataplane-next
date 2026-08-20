// @ts-nocheck
// Deterministic pre-scanner.
//
// Regex-based catcher for the "black and white" rule violations that must NEVER
// slip past a review, regardless of what the AI model says. Every finding this
// module emits has severity=critical and category=<the offended rule>.
//
// This is the belt-and-suspenders layer: if the LLM misses it, the scanner
// still forces the CI check to fail.
//
// NOTE: Color/token rules (hex, rgb, rgba, named colors in SCSS) are handled
// by the AI layer because mapping a color to the correct CSS variable requires
// reading the full theme token table in rules.md. The scanner only catches
// syntactic violations that regex can determine with 100% accuracy.

/**
 * Rule table.
 * Each rule has:
 *   test(line, filePath) → boolean
 *   filePattern: RegExp (only run rule on matching paths)
 *   title, explanation, ruleRef, category
 *   suggestion?: (match, line) => string   // optional exact replacement text
 */
const RULES = [
  // ── Angular 22 forbidden APIs ─────────────────────────────────────────
  {
    id: "ng-input-decorator",
    filePattern: /\.ts$/i,
    match: (line) => (/@Input\s*\(/.test(line) ? { hit: "@Input()" } : null),
    build: () => ({
      title: "`@Input()` decorator — use `input()` signal function",
      category: "angular22",
      ruleRef: "rules.md §1.5 · shared-reuse.instructions.md",
      explanation:
        "New Angular 22 code must use `input()` / `input.required<T>()` — **never** the `@Input()` decorator. See `rules.md §1.5 → Component API`.",
    }),
  },
  {
    id: "ng-output-decorator",
    filePattern: /\.ts$/i,
    match: (line) => (/@Output\s*\(/.test(line) ? { hit: "@Output()" } : null),
    build: () => ({
      title: "`@Output()` decorator — use `output<T>()` function",
      category: "angular22",
      ruleRef: "rules.md §1.5",
      explanation:
        "New code must use `output<T>()` — **never** `@Output()` + `EventEmitter`. See `rules.md §1.5`.",
    }),
  },
  {
    id: "ng-viewchild-decorator",
    filePattern: /\.ts$/i,
    match: (line) =>
      /@ViewChild(?:ren)?\s*\(/.test(line) ? { hit: "@ViewChild()" } : null,
    build: () => ({
      title: "`@ViewChild()` decorator — use `viewChild()` signal query",
      category: "angular22",
      ruleRef: "rules.md §1.5",
      explanation:
        "New code must use `viewChild()` / `viewChildren()` — never the decorator form.",
    }),
  },
  {
    id: "ng-module",
    filePattern: /\.ts$/i,
    match: (line) =>
      /@NgModule\s*\(/.test(line) ? { hit: "@NgModule()" } : null,
    build: () => ({
      title: "`@NgModule` — project is standalone-only",
      category: "angular22",
      ruleRef: "rules.md §1.5 · copilot-instructions.md",
      explanation:
        "No NgModules. Every new component/directive/pipe is standalone. Root config already lives in `app.config.ts`.",
    }),
  },
  {
    id: "ng-if-for",
    filePattern: /\.html$/i,
    match: (line) => {
      const m = line.match(
        /\*(ngIf|ngFor|ngSwitch|ngSwitchCase|ngSwitchDefault)\b/
      );
      return m ? { hit: `*${m[1]}` } : null;
    },
    build: ({ hit }) => ({
      title: `\`${hit}\` — use built-in control flow (\`@if\` / \`@for\` / \`@switch\`)`,
      category: "angular22",
      ruleRef: "rules.md §1.5 → Templates",
      explanation:
        "Templates must use Angular 22 built-in control flow blocks (`@if`, `@else`, `@for` with `track`, `@switch`). Structural directives like `*ngIf` / `*ngFor` are forbidden in new/edited templates.",
    }),
  },

  // ── Error handling ────────────────────────────────────────────────────
  {
    id: "console-error",
    filePattern: /^src\/app\/.*\.ts$/i,
    match: (line) =>
      /\bconsole\.error\s*\(/.test(line) ? { hit: "console.error(" } : null,
    build: () => ({
      title: "`console.error()` for user-facing failure is forbidden",
      category: "rules",
      ruleRef: "error-handling.instructions.md",
      explanation:
        "Route errors through `errorInterceptor` + `ToastService` — never `console.error()` for user-facing failures. See `error-handling.instructions.md`.",
    }),
  },
  {
    id: "alert-call",
    filePattern: /^src\/app\/.*\.ts$/i,
    match: (line, filePath) => {
      if (/\.spec\.ts$/i.test(filePath)) return null;
      const m = line.match(/(?:^|[^.\w])alert\s*\(/);
      return m ? { hit: "alert(" } : null;
    },
    build: () => ({
      title: "`alert()` is forbidden — use `ToastService`",
      category: "rules",
      ruleRef: "error-handling.instructions.md",
      explanation:
        "Use `ToastService.success/info/warn/error(translationKey)` — never `window.alert()`.",
    }),
  },

  // ── Direct HTTP + endpoints ───────────────────────────────────────────
  {
    id: "httpclient-in-component",
    filePattern: /\.component\.ts$/i,
    match: (line) =>
      /inject\s*\(\s*HttpClient\s*\)/.test(line)
        ? { hit: "inject(HttpClient)" }
        : null,
    build: () => ({
      title:
        "`HttpClient` injected in a component — use a service extending `BaseCrudService`",
      category: "rules",
      ruleRef: "api-calls.instructions.md · rules.md",
      explanation:
        "Components must never talk to `HttpClient` directly. Create/reuse a feature service that extends `BaseCrudService<T>` and call it from the component.",
    }),
  },
  {
    id: "inline-endpoint",
    filePattern: /^src\/app\/.*\.ts$/i,
    match: (line) => {
      // Skip constants.ts itself and environment files
      if (line.includes("environment.") || line.includes("constants.ts"))
        return null;
      const m = line.match(/['"`](\/api\/[^\s'"`]+)['"`]/);
      return m ? { hit: m[1] } : null;
    },
    build: ({ hit }) => ({
      title: `Inline endpoint \`${hit}\` — move it to \`src/app/constants.ts\``,
      category: "rules",
      ruleRef: "copilot-instructions.md → Core Principles §7",
      explanation:
        "Endpoints must come from `src/app/constants.ts`, not inlined as string URLs. Add a named constant there and import it here.",
    }),
  },

  // ── Subscription safety ───────────────────────────────────────────────
  {
    id: "destroy-subject",
    filePattern: /^src\/app\/.*\.ts$/i,
    match: (line) => {
      const m = line.match(
        /private\s+(?:readonly\s+)?destroy\$\s*=\s*new\s+Subject/
      );
      return m ? { hit: "destroy$ = new Subject()" } : null;
    },
    build: () => ({
      title:
        "Manual `destroy$` Subject — use `takeUntilDestroyed(inject(DestroyRef))`",
      category: "angular22",
      ruleRef: "rules.md §1.5 → DI & lifecycle",
      explanation:
        "Manual `destroy$: Subject<void>` teardown is forbidden. Use `takeUntilDestroyed(inject(DestroyRef))` for every `.subscribe()`.",
    }),
  },

  // ── Constructor DI (Angular 22 forbidden) ─────────────────────────────
  {
    id: "constructor-di",
    filePattern: /\.ts$/i,
    match: (line) => {
      // Match constructor parameter properties: constructor(private foo: Foo)
      const m = line.match(/constructor\s*\([^)]*private\s+\w+\s*:\s*\w+/);
      return m ? { hit: "constructor DI" } : null;
    },
    build: () => ({
      title: "Constructor DI — use `inject()`",
      category: "angular22",
      ruleRef: "rules.md §1.5",
      explanation:
        "New code must use `inject(Foo)` — never constructor parameter injection.",
    }),
  },
];

// ── PR Scope Validation ───────────────────────────────────────────────
// Maps PR title keywords → expected file path patterns.
// If the PR title contains a keyword, ALL changed files should match at least
// one of the associated path patterns (or be globally-allowed infra files).

const MODULE_MAP = {
  "contact-us": ["src/app/public/contact-us/", "src/assets/i18n/"],
  contactus: ["src/app/public/contact-us/", "src/assets/i18n/"],
  contact_us: ["src/app/public/contact-us/", "src/assets/i18n/"],
  complaint: ["src/app/public/complaint", "src/assets/i18n/"],
  complaints: ["src/app/public/complaint", "src/assets/i18n/"],
  "service-request": ["src/app/public/service-request/", "src/assets/i18n/"],
  servicerequest: ["src/app/public/service-request/", "src/assets/i18n/"],
  service_request: ["src/app/public/service-request/", "src/assets/i18n/"],
  dashboard: ["src/app/public/dashboard/", "src/assets/i18n/"],
  login: ["src/app/public/login/", "src/assets/i18n/"],
  auth: [
    "src/app/shared/services/auth/",
    "src/app/public/login/",
    "src/app/public/create-account/",
    "src/assets/i18n/",
  ],
  home: ["src/app/public/home/", "src/assets/i18n/"],
  "about-us": ["src/app/public/about-us/", "src/assets/i18n/"],
  aboutus: ["src/app/public/about-us/", "src/assets/i18n/"],
  about_us: ["src/app/public/about-us/", "src/assets/i18n/"],
  inquiry: ["src/app/public/inquiry/", "src/assets/i18n/"],
  notification: ["src/app/public/notifications/", "src/assets/i18n/"],
  notifications: ["src/app/public/notifications/", "src/assets/i18n/"],
  "media-center": ["src/app/public/media-center/", "src/assets/i18n/"],
  mediacenter: ["src/app/public/media-center/", "src/assets/i18n/"],
  media_center: ["src/app/public/media-center/", "src/assets/i18n/"],
  faq: ["src/app/public/faq/", "src/assets/i18n/"],
  profile: ["src/app/public/my-profile/", "src/assets/i18n/"],
  "my-profile": ["src/app/public/my-profile/", "src/assets/i18n/"],
  myprofile: ["src/app/public/my-profile/", "src/assets/i18n/"],
  my_profile: ["src/app/public/my-profile/", "src/assets/i18n/"],
  i18n: ["src/assets/i18n/"],
  translate: ["src/assets/i18n/"],
  theme: ["src/styles/themes/", "src/styles/global.theme.scss"],
  themes: ["src/styles/themes/", "src/styles/global.theme.scss"],
  "shared-component": ["src/app/shared/components/", "src/assets/i18n/"],
  shared_component: ["src/app/shared/components/", "src/assets/i18n/"],
  sharedcomponent: ["src/app/shared/components/", "src/assets/i18n/"],
  "shared-service": ["src/app/shared/services/", "src/assets/i18n/"],
  shared_service: ["src/app/shared/services/", "src/assets/i18n/"],
  sharedservice: ["src/app/shared/services/", "src/assets/i18n/"],
  formly: ["src/app/shared/formly/", "src/assets/i18n/"],
  interceptor: ["src/app/shared/interceptors/", "src/assets/i18n/"],
  interceptors: ["src/app/shared/interceptors/", "src/assets/i18n/"],
  guard: ["src/app/shared/guards/", "src/assets/i18n/"],
  guards: ["src/app/shared/guards/", "src/assets/i18n/"],
  config: ["src/app/app.config.ts", "src/app/app.routes.ts", "src/main.ts"],
  routing: ["src/app/app.routes.ts", "src/app/public/", "src/assets/i18n/"],
  route: ["src/app/app.routes.ts", "src/app/public/", "src/assets/i18n/"],
  "service-details": ["src/app/public/service-details/", "src/assets/i18n/"],
  servicedetails: ["src/app/public/service-details/", "src/assets/i18n/"],
  service_details: ["src/app/public/service-details/", "src/assets/i18n/"],
  "create-account": ["src/app/public/create-account/", "src/assets/i18n/"],
  createaccount: ["src/app/public/create-account/", "src/assets/i18n/"],
  create_account: ["src/app/public/create-account/", "src/assets/i18n/"],
  "not-found": ["src/app/public/not-found/", "src/assets/i18n/"],
  notfound: ["src/app/public/not-found/", "src/assets/i18n/"],
  not_found: ["src/app/public/not-found/", "src/assets/i18n/"],
  "request-details": ["src/app/public/request-details/", "src/assets/i18n/"],
  requestdetails: ["src/app/public/request-details/", "src/assets/i18n/"],
  request_details: ["src/app/public/request-details/", "src/assets/i18n/"],
  "account-summary": ["src/app/public/account-summary/", "src/assets/i18n/"],
  accountsummary: ["src/app/public/account-summary/", "src/assets/i18n/"],
  account_summary: ["src/app/public/account-summary/", "src/assets/i18n/"],
  loader: [
    "src/app/shared/components/loader.",
    "src/app/shared/services/loader.service.ts",
    "src/assets/i18n/",
  ],
  toast: ["src/app/shared/services/toast.service.ts", "src/assets/i18n/"],
  seo: ["src/app/shared/services/seo.service.ts", "src/assets/i18n/"],
  motion: [
    "src/app/shared/services/motion.service.ts",
    "src/app/shared/directives/",
    "src/assets/i18n/",
  ],
  animation: [
    "src/app/shared/services/motion.service.ts",
    "src/app/shared/directives/",
    "src/assets/i18n/",
  ],
  "scroll-reveal": [
    "src/app/shared/directives/scroll-reveal.directive.ts",
    "src/assets/i18n/",
  ],
  scrollreveal: [
    "src/app/shared/directives/scroll-reveal.directive.ts",
    "src/assets/i18n/",
  ],
  "auto-animate": [
    "src/app/shared/directives/auto-animate.directive.ts",
    "src/assets/i18n/",
  ],
  autoanimate: [
    "src/app/shared/directives/auto-animate.directive.ts",
    "src/assets/i18n/",
  ],
  button: ["src/app/shared/components/button.component.ts", "src/assets/i18n/"],
  card: [
    "src/app/shared/components/card.component.ts",
    "src/app/shared/components/service-offering-card/",
    "src/assets/i18n/",
  ],
  otp: ["src/app/shared/components/otp-model/", "src/assets/i18n/"],
  modal: [
    "src/app/shared/components/otp-model/",
    "src/app/shared/components/success-alert/",
    "src/assets/i18n/",
  ],
  header: ["src/app/layouts/header/", "src/assets/i18n/"],
  footer: ["src/app/layouts/footer/", "src/assets/i18n/"],
  skeleton: ["src/app/shared/components/skeleton-loader/", "src/assets/i18n/"],
  filter: ["src/app/shared/components/filter-dropdown/", "src/assets/i18n/"],
  dropdown: [
    "src/app/shared/components/filter-dropdown/",
    "src/app/shared/formly/custom-components/drop-down/",
    "src/assets/i18n/",
  ],
  map: ["src/app/shared/components/maps.type.ts", "src/assets/i18n/"],
  media: [
    "src/app/public/media-center/",
    "src/app/shared/components/media-center-section/",
    "src/assets/i18n/",
  ],
  regulation: [
    "src/app/shared/components/regulations-section/",
    "src/assets/i18n/",
  ],
  "faq-section": ["src/app/shared/components/faq-section/", "src/assets/i18n/"],
  "service-about": [
    "src/app/shared/components/service-about-section/",
    "src/assets/i18n/",
  ],
  service_about: [
    "src/app/shared/components/service-about-section/",
    "src/assets/i18n/",
  ],
  serviceabout: [
    "src/app/shared/components/service-about-section/",
    "src/assets/i18n/",
  ],
  language: ["src/app/shared/services/language.service.ts", "src/assets/i18n/"],
  font: ["src/app/shared/services/font-size.service.ts", "src/styles/"],
  test: ["src/app/.*.spec.ts$", "src/app/.*.test.ts$"],
  spec: ["src/app/.*.spec.ts$", "src/app/.*.test.ts$"],
  pipeline: [".github/workflows/", "azure-pipelines"],
  workflow: [".github/workflows/", "azure-pipelines"],
  ci: [".github/workflows/", "azure-pipelines", ".ai-review/"],
  cd: [".github/workflows/", "azure-pipelines"],
  docker: ["Dockerfile", "docker-compose", ".dockerignore"],
  deploy: [".github/workflows/", "azure-pipelines", "Dockerfile"],
  build: ["angular.json", "tsconfig", "package.json", "src/main.ts"],
  package: ["package.json", "package-lock.json"],
  dependency: ["package.json", "package-lock.json"],
  readme: ["README.md"],
  doc: ["README.md", ".github/instructions/", "rules.md"],
  docs: ["README.md", ".github/instructions/", "rules.md"],
  instruction: [".github/instructions/", "rules.md"],
  rules: [
    "rules.md",
    ".github/instructions/",
    ".github/copilot-instructions.md",
  ],
  copilot: [".github/copilot-instructions.md", ".github/instructions/"],
  reviewer: [".ai-review/"],
  "ai-review": [".ai-review/"],
  ai_review: [".ai-review/"],
};

/** Files / paths that are allowed in ANY PR regardless of title keywords. */
const ALWAYS_ALLOWED_PATTERNS = [
  /^\.github\//,
  /^\.ai-review\//,
  /src\/assets\/i18n\//,
  /src\/styles\/themes\//,
  /package\.json/,
  /package-lock\.json/,
  /yarn\.lock/,
  /pnpm-lock\.yaml/,
  /README/i,
  /CHANGELOG/i,
  /LICENSE/i,
  /\.env\./,
  /proxy\.conf\.json/,
  /angular\.json/,
  /tsconfig/,
  /\.editorconfig/,
  /\.gitignore/,
  /\.prettier/,
  /\.eslint/,
  /karma\.conf/,
  /jest\.config/,
  /nginx\.conf/,
  /Dockerfile/,
  /docker-compose/,
  /\.dockerignore/,
];

/**
 * Validate that a PR's title matches its file scope.
 * If the title contains a known module keyword, every changed file should
 * belong to that module (or be globally-allowed infra files).
 *
 * @param {{ prTitle: string, files: Array<{path: string}> }} params
 * @returns {Array<Finding>}
 */
export function validateScope({ prTitle, files }) {
  const title = (prTitle || "").toLowerCase();
  const findings = [];

  // Find all module keywords that appear in the PR title
  const matchedModules = Object.entries(MODULE_MAP).filter(([keyword]) =>
    title.includes(keyword.toLowerCase())
  );

  if (matchedModules.length === 0) {
    // No known keyword in title — let the AI judge scope
    return findings;
  }

  // Collect all allowed path patterns from matched modules
  const allowedPatterns = matchedModules.flatMap(([, paths]) =>
    paths.map((p) => new RegExp(p.replace(/\//g, "\\/"), "i"))
  );

  // Find files that don't match any allowed pattern AND aren't globally allowed
  const unrelated = files.filter((f) => {
    const path = f.path || f;

    // Always allowed infra/meta files
    if (ALWAYS_ALLOWED_PATTERNS.some((pat) => pat.test(path))) return false;

    // Must match at least one module-specific pattern
    return !allowedPatterns.some((pat) => pat.test(path));
  });

  if (unrelated.length > 0) {
    const moduleNames = matchedModules.map(([name]) => name).join(" / ");
    findings.push({
      file: "(pr-scope)",
      line: 1,
      severity: "high",
      source: "scanner",
      scannerRuleId: "pr-scope-mismatch",
      category: "rules",
      title: `PR scope warning: "${prTitle}" may include unrelated files`,
      explanation:
        `This PR title suggests it's about **${moduleNames}**, but ${unrelated.length} file(s) appear unrelated:\n\n` +
        unrelated.map((f) => "  - `" + (f.path || f) + "`").join("\n") +
        `\n\n**Guideline**: Keep PRs focused on one feature/area. If these files are genuinely related, update the PR title to reflect the broader scope. Otherwise, split into separate PRs.`,
      ruleRef: "copilot-instructions.md → Core Principles",
    });
  }

  return findings;
}

function isScssComment(trimmed) {
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*")
  );
}

/**
 * @param {Array<{path: string, diff: string}>} files
 * @returns {Array<Finding>}
 */

// ── PR Title Auto-Suggestion ──────────────────────────────────────────
// When a PR title is generic (no keyword match in MODULE_MAP), suggest
// a descriptive title based on the changed files.

const TITLE_PATTERNS = [
  { pattern: /^src\/app\/public\/([^/]+)\//, prefix: "feat: update" },
  {
    pattern: /^src\/app\/shared\/components\/([^/]+)\//,
    prefix: "feat: update shared",
  },
  { pattern: /^src\/app\/shared\/services\/([^/]+)\//, prefix: "feat: update" },
  { pattern: /^src\/app\/shared\/formly\//, prefix: "feat: update formly" },
  {
    pattern: /^src\/app\/shared\/interceptors\//,
    prefix: "feat: update interceptors",
  },
  { pattern: /^src\/app\/shared\/guards\//, prefix: "feat: update guards" },
  { pattern: /^src\/app\/layouts\//, prefix: "feat: update layout" },
  { pattern: /^src\/styles\//, prefix: "style: update theme" },
  { pattern: /^src\/assets\/i18n\//, prefix: "i18n: update translations" },
  { pattern: /\.spec\.ts$/, prefix: "test: add/update tests for" },
  { pattern: /package\.json$/, prefix: "chore: update dependencies" },
  { pattern: /angular\.json$/, prefix: "chore: update angular config" },
  { pattern: /tsconfig/, prefix: "chore: update typescript config" },
  { pattern: /\.github\/workflows\//, prefix: "ci: update workflow" },
  { pattern: /azure-pipelines/, prefix: "ci: update pipeline" },
  { pattern: /Dockerfile/, prefix: "chore: update docker" },
  { pattern: /README/, prefix: "docs: update readme" },
  { pattern: /rules\.md$/, prefix: "docs: update rules" },
  { pattern: /copilot-instructions/, prefix: "docs: update instructions" },
  { pattern: /\.instructions\.md$/, prefix: "docs: update instructions" },
];

/**
 * Suggest a descriptive PR title based on changed files.
 * Only triggers when the current title is generic (no MODULE_MAP keyword match).
 *
 * @param {{ prTitle: string, files: Array<{path: string}> }} params
 * @returns {Array<Finding>}
 */
// Broadened generic-title detection: catches short titles, conventional-prefix-only,
// vague single verbs, and common lazy phrasings that give no signal about scope.
const GENERIC_TITLE_PATTERNS = [
  /^(test|wip|temp|tmp|fix|update|updates|changes|change|pr|draft|foo|bar|baz|misc|stuff|things|refactor|cleanup|patch|hotfix|revert)$/,
  /^(fix|feat|feature|chore|docs|style|refactor|test|ci|build|perf|hotfix|revert)\s*(\([^)]*\))?\s*[:!\-]?\s*$/,
  /^(fix|feat|chore|docs|style|refactor|perf)\s*(\([^)]*\))?\s*[:!\-]?\s*(stuff|things|bug|bugs|issue|issues|update|updates|changes|change|misc|small|minor|typo|typos|nit|nits|wip|tmp)$/,
  /^\.+$/,
  /^-+$/,
];

function isGenericTitle(title) {
  if (!title || title.length < 5) return true;
  return GENERIC_TITLE_PATTERNS.some((r) => r.test(title));
}

export function suggestPrTitle({ prTitle, files }) {
  const title = (prTitle || "").toLowerCase().trim();
  const findings = [];

  const isGeneric = isGenericTitle(title);
  const hasKnownKeyword = Object.keys(MODULE_MAP).some((kw) =>
    title.includes(kw.toLowerCase())
  );

  // Only skip when the title is BOTH descriptive AND references a real module
  // (e.g. "fix login redirect" — keyword `login` + not generic).
  if (hasKnownKeyword && !isGeneric) return findings;

  // Collect unique areas from changed files
  const areas = new Set();
  for (const f of files) {
    const path = f.path || f;
    for (const { pattern, prefix } of TITLE_PATTERNS) {
      const m = path.match(pattern);
      if (m) {
        const areaName = m[1]
          ? m[1]
              .replace(/-/g, " ")
              .replace(/\.component$/, "")
              .replace(/\.service$/, "")
          : path
              .split("/")
              .pop()
              .replace(/\.[^.]+$/, "");
        areas.add(`${prefix} ${areaName}`);
        break;
      }
    }
  }

  if (areas.size === 0 && !isGeneric) return findings;

  let suggested;
  if (areas.size === 1) {
    suggested = Array.from(areas)[0];
  } else if (areas.size > 1) {
    // Multiple areas — list them
    const prefixes = new Set(Array.from(areas).map((a) => a.split(":")[0]));
    if (prefixes.size === 1) {
      // Same prefix for all — combine
      const prefix = Array.from(prefixes)[0];
      const names = Array.from(areas).map((a) =>
        a.split(":")[1].trim().replace("update ", "").replace("shared ", "")
      );
      suggested = `${prefix}: update ${names.join(" & ")}`;
    } else {
      // Mixed prefixes — use generic
      const names = Array.from(areas).map((a) => a.split(":")[1].trim());
      suggested = `feat: update ${names.join(" & ")}`;
    }
  } else {
    // No areas matched but title is generic
    suggested = "feat: update [describe your changes]";
  }

  findings.push({
    file: "(pr-title)",
    line: 1,
    severity: "medium",
    source: "scanner",
    scannerRuleId: "pr-title-suggestion",
    category: "style",
    title: `Suggested PR title: "${suggested}"`,
    suggestedTitle: suggested,
    explanation:
      `The current PR title "${prTitle || "(empty)"}" is too generic. ` +
      `Based on the ${files.length} changed file(s), consider renaming to:\n\n` +
      `**${suggested}**\n\n` +
      `This makes the PR purpose clear, helps reviewers understand scope at a glance, ` +
      `and enables automatic scope validation.`,
    ruleRef: "copilot-instructions.md → Core Principles",
  });

  return findings;
}

/**
 * Parse a raw unified diff (as returned by the GitHub/Azure diff endpoints)
 * into per-file chunks — the shape scanDiff expects: [{ path, diff }].
 * Without this, passing the raw string to scanDiff iterates its characters
 * and `f.diff` is undefined (crash: "reading 'split'").
 */
export function parseUnifiedDiffFiles(diff) {
  if (!diff) return [];
  const out = [];
  const parts = diff.split(/(?=^diff --git )/m);
  for (const part of parts) {
    if (!part.startsWith("diff --git")) continue;
    let path;
    const plus = part.match(/^\+\+\+ (?:b\/)?(\S+)/m);
    if (plus && plus[1] !== "/dev/null") path = plus[1];
    if (!path) {
      const head = part.match(/^diff --git a\/\S+ b\/(\S+)/m);
      if (head) path = head[1];
    }
    out.push({ path: path || "(unknown)", diff: part });
  }
  return out;
}

export function scanDiff(files) {
  const findings = [];
  for (const f of files) {
    const added = extractAddedLines(f.diff);
    for (const { lineNumber, content } of added) {
      for (const rule of RULES) {
        if (!rule.filePattern.test(f.path)) continue;
        const match = rule.match(content, f.path);
        if (!match) continue;
        const built = rule.build(match);
        findings.push({
          file: f.path,
          line: lineNumber,
          severity: "critical",
          source: "scanner",
          scannerRuleId: rule.id,
          category: built.category,
          title: built.title,
          explanation: built.explanation,
          ruleRef: built.ruleRef,
        });
      }
    }
  }
  return findings;
}

/**
 * Parse a unified diff and yield each ADDED line with its 1-based line number
 * in the NEW file (right side).
 */
function extractAddedLines(diff) {
  const lines = diff.split("\n");
  const added = [];
  let newLineNo = 0;
  for (const line of lines) {
    if (line.startsWith("@@")) {
      const m = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (m) newLineNo = parseInt(m[1], 10) - 1;
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) {
      newLineNo++;
      added.push({ lineNumber: newLineNo, content: line.slice(1) });
    } else if (line.startsWith("-")) {
      // deleted from old — does not advance new-file line counter
    } else {
      // context line
      newLineNo++;
    }
  }
  return added;
}
