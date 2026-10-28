# Flutter Rules Audit, Enhancement & Validation — Codrevia Data Plane

Date: 2026-10-28
Scope: the Flutter/Dart review ruleset of the Codrevia review data plane
(`rules/flutter/`, `.github/instructions/flutter/`, the rule-loading pipeline in
`src/lib/reviewer-core/`, and the deterministic pre-scanner), with end-to-end
validation against a dedicated evaluation fixture.

---

## 1. How the review pipeline actually works (verified, not assumed)

Traced execution path — `POST /api/webhook` (GitHub), `POST /api/azure-webhook`
(Azure DevOps), and `POST /api/local-review` (CLI) all funnel into the same
production core, `executeReview()` in `src/lib/reviewer-core/ai-review.ts`:

1. `parseUnifiedDiffFiles(diff)` → per-file chunks; `scanDiff()` runs the
   deterministic pre-scanner over added lines (belt-and-suspenders layer; the
   verdict is computed client-side so the model cannot suppress it).
2. `extractFilePaths(diff)` (generated files such as `*.g.dart` / `*.freezed.dart`
   excluded) → `detectPlatforms()` scores each platform independently from
   changed-file evidence (manifests weight 5, sources weight 2, doubled for
   changed files; threshold 0.4; multi-platform results are legitimate).
3. `loadRuleBundle()` assembles the rulebook, in order:
   common rules (`rules/common/*.md`, always) → per detected platform the
   baseline `rules/<platform>/rules.md` → any instruction file indexed under
   `## Instruction files` in that baseline, inlined **only when its `applyTo`
   frontmatter globs match the changed files** → trusted repo config
   (`.codrevia/` or legacy `.codebadger/`) → project rules from the reviewed
   repository (`.ai-review/**`, sanitized against prompt injection, budgeted).
   Deduplication is content-hash based; a 120k-char prompt budget is enforced
   with platform rules truncated first; every load/skip decision is logged.
4. `buildReviewPrompt()` deterministically emits system prompt (rulebook,
   severity guide, response schema) + user prompt (PR metadata + diff, 150k cap).
5. Provider chain (Gemini → OpenAI → Anthropic → Azure OpenAI) with
   quota-aware retries; JSON response parsed defensively.
6. `normalizeFindings()`: drops generated files, clamps severity to
   critical/high/medium/low/info, tags platform, dedupes on file::line::title.
7. Verdict: `request_changes` if any merged finding is critical/high, else
   `comment` — the AI's own verdict is never trusted.

Flutter detection specifics: `pubspec.yaml`/`pubspec.lock`/`.metadata` (weight 5),
`.dart` files (weight 2). A Flutter PR that also touches
`android/**` or `ios/**` correctly loads the android/ios platform rulesets
alongside the flutter ruleset (verified in the fixture run).

Severity model: the product uses `critical | high | medium | low | info`
(the task brief's "Critical/Warning/Suggestion" maps to this model; rule files
correctly avoid hardcoding severities except where the scanner layer is
critical by construction).

## 2. Audit of the existing Flutter ruleset

The 16 indexed instruction files were each evaluated against the ten criteria
(correctness, coverage, clarity, actionability, specificity, false positives,
false negatives, duplication, severity, compatibility).

### Already strong — preserved unchanged

- `dart.instructions.md`, `state-management.instructions.md`,
  `architecture.instructions.md`, `performance.instructions.md`,
  `testing.instructions.md`, `localization.instructions.md`,
  `styling-themes.instructions.md`, `dependencies.instructions.md`,
  `platform-integration.instructions.md`, `error-handling.instructions.md`,
  `async.instructions.md` — modern Dart 3 / current-Flutter guidance,
  evidence-based conditions, explicit exceptions ("Preserve existing
  conventions"), no pattern mandates. These satisfy the brief's anti-false-positive
  requirements and stay as-is.
- Engine behaviors verified good: hash dedup, budget enforcement, applyTo scope
  selection, project-rule sanitization, path confinement (symlink-safe),
  generated-file exclusion from both detection and findings, client-side verdict.

### Findings and actions taken

| ID | Finding | Criterion violated | Action |
|----|---------|--------------------|--------|
| A1 | Baseline `rules/flutter/rules.md` restated instruction-file topics in harsher absolute form ("No `dynamic` types", "Use `Keys` on items…", "All user-visible strings must use intl") that contradict the nuanced exceptions in the instruction files (e.g. `jsonDecode` boundaries, single-locale projects). Since the baseline always loads, this re-imposed false-positive-prone absolutes on every Flutter PR. | duplication, false positives | Baseline rewritten as a compact always-on safety net that explicitly defers to instruction-file exceptions ("takes precedence"). Absolutes removed; all 16 index entries preserved. |
| A2 | Listener lifecycle gap: `addListener`/`removeListener` symmetry and `WidgetsBindingObserver` removal were not covered anywhere. | coverage / false negatives | `widgets.instructions.md` hard rule 2 added + anti-pattern examples. |
| A3 | Inherited-widget lookups (`Theme.of`, `MediaQuery.of`, `Provider.of`) inside `initState` (a real crash: `dependOnInheritedWidget…` assertion) were not covered. | coverage | `widgets.instructions.md` hard rule 5 added + example. |
| A4 | Manifest-level cleartext not covered even though `security.instructions.md` already applies to `AndroidManifest.xml`/`Info.plist`: `android:usesCleartextTraffic="true"` and iOS `NSAppTransportSecurity`/`NSAllowsArbitraryLoads` were unflagged. | coverage / false negatives | Security hard rule 3 extended; XML anti-pattern examples added. |
| A5 | Pop interception guidance missing; `WillPopScope` is deprecated in current Flutter (`PopScope`/`onPopInvokedWithResult` are the modern APIs). | correctness / currency | `navigation.instructions.md` review rule 6 added, phrased version-safely (untouched legacy uses are not findings). |
| A6 | HTTP client lifecycle missing: per-call `http.Client()`/`HttpClient()` never closed leaks sockets. | coverage | `api-calls.instructions.md` rule 8 added ("reused or closed", respecting existing project idioms). |
| A7 | Accessibility file referenced deprecated `textScaleFactor` (deprecated since Flutter 3.16 in favor of `TextScaler`/`MediaQuery.textScalerOf`). | correctness / currency | Reworded to `MediaQuery.textScalerOf` / `TextScaler`. |
| A8 | The deterministic scanner (`rules-scanner.ts`) had only Angular rules; Flutter deployments got no belt-and-suspenders layer at all. | coverage | Two 100%-regex-accuracy rules added: `dart-tls-bypass` (critical) and `android-cleartext-traffic` (critical, debug-manifest and test paths exempt). Both mirror the AI rules and cannot suppress each other. |
| A9 | `ai-review.ts` used the `@/` alias and extensionless relative imports, which made the production review function untestable under the repo's own Node test runner (no path-alias resolution, ESM requires explicit extensions). | testability of the pipeline | Import specifiers normalized to relative + `.ts` form (zero behavior change; `tsc --noEmit` passes). This enabled the new Level 3/4 tests against the real `executeReview`. |

### Accepted, documented (no change)

- `platform-integration.instructions.md` applies to all `**/*.dart` although its
  text says to apply only when integration is touched. Channel code can appear in
  any lib path, so no glob can scope it better; the file self-limits. Wasted
  prompt budget is small and bounded.
- `validateScope()` / `suggestPrTitle()` in `rules-scanner.ts` and the legacy
  prompt modules (`prompt.ts`, `platform-prompts.ts`) are Angular-era and not
  invoked by any production route (only re-exported). Left untouched to avoid
  unrelated refactors; flagged for future cleanup.
- Detection is PR-scoped by design: a manifest-only PR in a Flutter repo detects
  `android` but not `flutter`. Deployers can boost via the `manifests` parameter
  or repo config; a realistic Flutter PR includes Dart/pubspec changes, which
  the fixture confirms.

## 3. Verification of technical recommendations

Checked against current Flutter/Dart knowledge: `PopScope`/`onPopInvokedWithResult`
replaces deprecated `WillPopScope`; `TextScaler`/`MediaQuery.textScalerOf`
replaces deprecated `textScaleFactor`; `mounted`/`context.mounted` across async
gaps; `Uri.https` and `HttpClient.connectionTimeout`; `flutter_secure_storage`
as the canonical secure-store example. No deprecated API is prescribed as the
*fix* anywhere in the rule set. The two new scanner rules encode only syntactic
facts (attribute string, callback returning literal `true`).

## 4. Evaluation fixture and quality measurement

`tests/fixtures/flutter-review/` holds the dataset (documented case-by-case in
`expected-findings.md`): `positive.diff` — a 4-file Flutter PR containing 11
documented defects (TLS bypass, cleartext manifest, hardcoded API key, plaintext
token storage, setState-after-await without `mounted`, swallowed exception,
inherited lookup in `initState`, undisposed controller/subscription, dropped
future, per-call unclosed `HttpClient`, cleartext `http://` endpoint); and
`negative.diff` — a clean PR with 10 documented valid implementations that must
not be flagged (proper dispose symmetry, mounted guards, `PopScope`, shared
client with timeout, typed parsing, secure storage, justified dependency).

Measured on this dataset with the production pipeline:

| Metric | Result |
|--------|--------|
| Deterministic true positives | 2/2 (P1 TLS bypass at `lib/api_client.dart:9`, P2 cleartext manifest at line 5) with exact file/line, severity critical |
| Deterministic false positives | 0 (negative diff → 0 scanner findings; validating callbacks, test files, debug manifests, and Angular diffs all verified clean) |
| Pipeline findings normalization | generated-file finding dropped, invalid severity clamped to info, duplicate removed, platform tagged `flutter` (all asserted) |
| Verdict accuracy | positive → `request_changes`; negative → `comment` (never auto-approves, AI verdict ignored) |
| Rule coverage of the fixture | 11/11 positive cases and 10/10 negative cases have a corresponding rule loaded into the prompt (asserted on the captured system prompt) |
| Duplicate findings | 0 remaining after normalization |
| Prompt-budget sanity | full-concern Flutter PR loads 15+ instruction files with `truncated=false` |

## 5. Tests executed

Command: `npm test` (Node built-in test runner) and `npx tsc --noEmit`.

| Suite | Result |
|-------|--------|
| `tests/reviewer-core.test.ts` (existing regression) | 65 tests — all pass (1 environment skip: file-symlink test on Windows) |
| `tests/flutter-rules.test.ts` (new, Level 1+2 + scanner) | 18 tests — all pass |
| `tests/flutter-review-integration.test.ts` (new, Level 3/4) | 3 tests — all pass |
| Other existing suites (branding, gemini-model, local-review, provider-errors, provider-request, review-telemetry) | all pass |
| **Total** | **86 tests: 85 pass, 0 fail, 1 pre-existing skip** |
| `npx tsc --noEmit` | exit 0 |

Level summary:

- **Level 1 — rule validation:** index/disk sync, frontmatter validity, glob
  compilation, representative-path matching, baseline content — automated.
- **Level 2 — rule-engine selection:** scope-selection matrix (lib-only,
  test-only, pubspec-only, manifest, .arb), cross-platform isolation (React PR
  loads zero flutter rules), multi-platform union, prompt budget — automated.
- **Level 3 — AI review evaluation:** executed against the real production
  pipeline with the model boundary stubbed; live-model evaluation is **blocked**
  (see below).
- **Level 4 — integration:** the full `executeReview` flow (diff → detection →
  rule loading → prompt → AI call → parse → normalize → verdict → summary) —
  automated over both fixture diffs.
- **Level 5 — end-to-end via a running server:** **blocked.**

### Blocked tests and exactly what they need

1. **Live-model Level 3** (does the real model obey the new rules?): set
   `GEMINI_API_KEY` (or `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/Azure variables) in
   the data-plane environment, then POST `tests/fixtures/flutter-review/positive.diff`
   through the pipeline (`executeReview` or the CLI → `/api/local-review`) and
   compare findings against `expected-findings.md`. Nothing else is required —
   the dataset and the expected matrix are already in the repository.
2. **Level 5 staging run**: a deployed data plane with `PROJECT_ID`,
   `WEBHOOK_SECRET`, and a provider key; sign the local-review request as
   `src/lib/local-review-auth.ts` specifies (HMAC-SHA256 over
   `local-review:<project>:<timestamp>:<sha256(body)>`, ±60 s) and verify the
   dashboard/control-plane output. No production deployment, repositories, or
   releases were touched.

## 6. Files created or modified

**Modified**

- `rules/flutter/rules.md` — baseline rewritten as a non-duplicative safety net; index intact (A1)
- `.github/instructions/flutter/widgets.instructions.md` — listener/observer symmetry, initState inherited-lookup rule (A2, A3)
- `.github/instructions/flutter/security.instructions.md` — manifest cleartext/ATS coverage (A4)
- `.github/instructions/flutter/navigation.instructions.md` — PopScope over deprecated WillPopScope (A5)
- `.github/instructions/flutter/api-calls.instructions.md` — HTTP client lifecycle (A6)
- `.github/instructions/flutter/accessibility.instructions.md` — TextScaler wording (A7)
- `src/lib/reviewer-core/rules-scanner.ts` — `dart-tls-bypass`, `android-cleartext-traffic` (A8)
- `src/lib/reviewer-core/ai-review.ts` — import specifiers made explicit/relative for testability (A9)

**Created**

- `tests/flutter-rules.test.ts` — Level 1/2 + deterministic scanner tests
- `tests/flutter-review-integration.test.ts` — Level 3/4 production-pipeline tests
- `tests/fixtures/flutter-review/positive.diff`, `negative.diff`, `expected-findings.md` — evaluation dataset (kept separate from the rules)
- `docs/flutter-rules-audit.md` — this report

## 7. Remaining gaps and next-iteration recommendations

1. **Live-model calibration** (blocked above): run the fixture through a real
   model, tune wording for any missed P-cases, and add the observed severities
   to `expected-findings.md` as the regression baseline.
2. **Golden-prompt snapshots**: snapshot `loadRuleBundle` + `buildReviewPrompt`
   output hashes per scenario to catch accidental rule-regression in review.
3. **Scanner growth**: additional 100%-accuracy candidates can be added later
   (e.g. `Modulo(`-style channel-name mismatch heuristics are *not* 100% —
   prefer keeping the scanner minimal and high-precision as currently done).
4. **Legacy cleanup** (out of scope here): remove or wire up dead Angular-era
   exports (`validateScope`, `suggestPrTitle`, `prompt.ts`, `platform-prompts.ts`)
   after confirming no external consumer uses `reviewer-core/index.ts`.
5. **Detection boosts**: consider passing repository manifests into
   `detectPlatforms` from the webhook flows so manifest-only PRs in known-Flutter
   repos keep the flutter ruleset.
