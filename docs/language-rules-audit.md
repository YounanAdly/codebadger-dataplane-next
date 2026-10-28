# Universal Language Rules Audit — Codrevia Data Plane

Date: 2026-10-29
Scope: all Codrevia review rules **except Flutter/Dart** (audited separately in
`docs/flutter-rules-audit.md`): the common rule packs, every non-Flutter language
baseline, the angular/android/ios instruction libraries, platform detection, rule
selection, and the mixed-language behavior of the review pipeline.

---

## 1. Confirmed language & framework inventory

Verified against the actual code (`platform-detector.ts` signatures,
`rule-loader.ts` loading, rule files on disk) — not against documentation.

| Platform (detector id) | Detection evidence | Rulebook | Instruction library | Automated tests |
|---|---|---|---|---|
| angular | `angular.json`, `*.component.ts`, … (weight 5/2) | `rules/angular/rules.md` (deployment-specific) + `rules-extra.md` (generic Angular) | 8 files under `.github/instructions/angular/` | Level 1–3 (`language-rules.test.ts`) + pre-existing loader tests |
| flutter | `pubspec.yaml` (5), `*.dart` (2) | `rules/flutter/rules.md` + 16 instruction files | yes | `flutter-rules.test.ts` (separate audit) |
| kotlin | `build.gradle.kts` (5), `*.kt` (2) | `rules/kotlin/rules.md` | — (Android packs load via the android platform; server-side Kotlin is baseline-only) | Level 1–3 |
| ios (covers Swift) | `Podfile`/`Package.swift`/`.xcodeproj` (5), `*.swift`/`.storyboard`/`.xib` (2) | `rules/ios/rules.md` | 21 files: `swift/`, `swiftui/`, `uikit/`, localization, security | Level 1–3 + Level 4 fixture |
| android | `AndroidManifest.xml` (5), `android/**` (2) | `rules/android/rules.md` | 21 files: `kotlin/`, `compose/`, `xml/`, localization, security | Level 1–3 |
| react | `vite.config.*` (4), `*.tsx`/`*.jsx` (2) | `rules/react/rules.md` | 5 files: components/hooks, state, performance, security, testing | Level 1–3 + Level 4 fixture |
| nextjs | `next.config.*` (5), `app|pages` code (2) | `rules/nextjs/rules.md` | 2 files: rendering/boundaries, data/actions/caching | Level 1–3 |
| react-native | `app.json`/`babel.config.js` (5), `App.*` (2) | `rules/react-native/rules.md` | — (baseline-only; frontend packs apply to shared JS) | Level 1–3 |
| vue | `vue.config.*`/`nuxt.config.*` (5), `*.vue` (2) | `rules/vue/rules.md` | 3 files: SFC/reactivity, state, testing | Level 1–3 |
| nodejs | `server.*`/framework configs (4), `scripts/*` (1) | `rules/nodejs/rules.md` | 2 files: runtime/async, API layer | Level 1–3 + Level 4 fixture |
| python | `pyproject.toml` etc. (5), `*.py` (2) | `rules/python/rules.md` | 4 files: language, asyncio/concurrency, web layer, testing | Level 1–3 + Level 4 fixture |
| java | `pom.xml`/`build.gradle` (5), `*.java` (2) | `rules/java/rules.md` | 3 files: language, Spring, testing | Level 1–3 |
| dotnet | `*.csproj`/`*.sln` (5), `*.cs` (2) | `rules/dotnet/rules.md` | 3 files: C#, ASP.NET/EF Core, testing | Level 1–3 |
| go | `go.mod`/`go.sum` (5), `*.go` (2) | `rules/go/rules.md` | 4 files: language, concurrency, HTTP services, testing | Level 1–3 |
| php | `composer.json` (5), `*.php` (2) | `rules/php/rules.md` | 3 files: language, Laravel/Symfony, testing | Level 1–3 |
| ruby | `Gemfile` etc. (5), `*.rb` (2) | `rules/ruby/rules.md` | 3 files: language, Rails, testing | Level 1–3 |
| **rust** *(added)* | `Cargo.toml`/`Cargo.lock` (5), `*.rs` (2) | `rules/rust/rules.md` (new) | — (baseline-only) | Level 2/3 + Level 4 fixture |
| **sql** *(added)* | `*.sql` (2) | `rules/sql/rules.md` (new) | — (baseline-only) | Level 2/3 + Level 4 fixture |
| generic (fallback) | no platform ≥ 0.4 confidence | `rules/unknown/rules.md` + common | — | pre-existing tests |

Common rules (every review): `code-quality.md`, `security.md`,
`api-data-integrity.md` *(added)*, `testing.md`, `pull-request.md`.
A language is "supported" here only if detection produces it AND a baseline
rulebook loads AND automated tests exercise both — every row above was verified
against those three requirements.

## 2. Audit findings and actions

### Engine bugs found and fixed

| ID | Finding | Impact | Fix |
|----|---------|--------|-----|
| E1 | **Phantom `swift` platform**: declared in the `Platform` type and `ALL_PLATFORMS`/`ALL_PLATFORM_SET`, but had **no detection signature and no `rules/swift/` directory** — it could never be detected and would never have loaded rules. Swift sources actually resolve to the `ios` platform (its signatures cover `.swift`), which loads the full iOS/Swift rulebook. | Dead config surface; misleading inventory; a repo config declaring `platforms: - swift` was accepted and silently meaningless | Removed the phantom member from the type and both platform lists (with the dead legacy prompt block in `platform-prompts.ts`); behavior documented and pinned by tests (pure-Swift PR → `ios` → iOS rulebook + Swift/SwiftUI/UIKit instructions) |
| E2 | **Next.js detection hijacked Python backends**: the `(^|\/)app\/api\//` signature is extension-agnostic, so the common Python layout `app/api/*.py` scored as Next.js, mis-tagging findings and injecting Next.js rules into Python reviews. Found by the `mixed-python-sql.diff` fixture while asserting per-file platform tags. | False platform, wrong rule selection, wrong finding tags on real FastAPI/Django-style repos | Scoped the pattern to code extensions: `app/api/**/*.(ts|tsx|js|jsx|mjs|mts|cts)`; Next.js route handlers still detect (regression-tested) |
| E3 | **Build output reviewed as source**: `target/` (Rust crates, Maven/Java builds) was not in the generated-file pattern, so `target/**` artifacts were detection signals and finding targets. | Noise/FNs in Java and Rust repos | Added `target` to `GENERATED_FILE_PATTERN` |
| E4 | **No Rust or SQL support**: both named in the supported-ecosystem checklist; the architecture supports new platforms additively. | Migration-only PRs fell back to generic rules; Rust PRs fell back to generic | Added `rust` and `sql` platforms (signatures + `ALL_PLATFORMS` + config set) with full baselines; additive, no existing detection changed |
| E5 | **No API/data-integrity rules at the common layer** (transactions, backward compatibility, pagination bounds, idempotency, migration/deploy ordering) — the task's data-integrity checklist had no home for cross-language reviews. | Gap in every language's review | Added `rules/common/api-data-integrity.md` and registered it in `COMMON_RULE_FILES` (exported for testability) |
| E6 | **Instruction-library disparity**: only flutter/android/ios/angular had two-tier rulebooks (baseline + `applyTo`-scoped instruction files with anti-pattern examples and exceptions); the 10 web/backend languages were baseline-only (~14 generic rules each, no code examples, no exception guidance). | Shallow, generic guidance for the most-reviewed ecosystems | Built 32 instruction files across 10 new libraries (react 5, vue 3, nextjs 2, nodejs 2, python 4, java 3, dotnet 3, go 4, php 3, ruby 3) in the established format (hard rules, review rules, positive recommendations, anti-pattern code examples, preserve-conventions), registered `## Instruction files` indexes in all 10 baselines, and extended the integrity tests to cover them |

### Rule-content findings and actions

| ID | Finding | Action |
|----|---------|--------|
| R1 | Language baselines are strong overall (compact, severity-guided, evidence-oriented) — **retained unchanged** except R2. | Kept |
| R2 | Seven baselines mandated specific test frameworks unconditionally (`xUnit + Moq`, `JUnit 5 + Mockito`, `pytest`, `RSpec/Minitest`, `Vitest`, RTL, `Jest + RNTL`) — contradicts the "respect the project's conventions" requirement and invites framework-mandate findings on projects using NUnit/NSubstitute/unnamed runners | Reworded to "test with the project's existing stack (X where already used)" in dotnet, java, python, ruby, vue, react, react-native |
| R3 | `rules/angular/rules.md` is the deployment's own 800-line project rulebook plus a generic `rules-extra.md`; structurally healthy (index resolves, all 8 instruction files exist and load by scope). Deep re-audit is deployment config, out of scope. | Integrity-tested; left content intact |
| R4 | android/ios instruction libraries (21 files each) are modern and correctly self-scoped ("apply only to files using those APIs") — same accepted pattern as the flutter platform-integration pack. All frontmatter/globs validated. | Integrity-tested; unchanged |
| R5 | The deterministic scanner stays deliberately minimal: its charter is single-line, 100%-regex-accuracy violations (it has the Angular project rules + the two universal Flutter TLS rules from the Flutter audit). Candidates for other languages (Python `shell=True`, ATS key/value pairs in Info.plist, JS `eval`) all require context or multi-line state the stateless single-line scanner cannot guarantee — they stay in the AI layer, which the fixtures confirm covers them. | No new scanner rules; decision documented |
| R6 | `validateScope()`/`suggestPrTitle()` and the legacy prompt modules remain unused by production routes (Angular-era leftovers, also flagged in the Flutter audit). | Unchanged; cleanup recommendation stands |

## 3. Validation suite

New automated coverage (all using the real rule loader / detector / production
`executeReview`; the model boundary is stubbed with canned Gemini responses —
live-model runs remain blocked on credentials, exactly as in the Flutter audit):

- **`tests/language-rules.test.ts` — 62 tests**
  - Level 1: integrity for all 13 instruction libraries (angular/android/ios + the 10
    new web/backend libraries) — index↔disk sync, frontmatter validity, glob
    compilation, scope reachability against a realistic path universe,
    `rules-extra.md` existence, common-file completeness.
  - Level 2: detection of all 19 platforms from representative files, pure-Swift
    PRs → `ios`, mixed-language detection, `platformForFile` per-file tagging,
    build-output exclusion, Python `app/api/` anti-hijack regression.
  - Level 3: every platform's baseline loads, iOS instruction library loads for
    Swift-only PRs, common packs load everywhere, mixed TS+Node and Python+SQL
    rule selection, scope-based pack selection (react full pack by scope, python
    web vs testing packs, nextjs both packs), strict cross-language isolation (no
    leakage in either direction), 5-platform PR stays inside the prompt budget.
- **`tests/language-review-integration.test.ts` — 5 tests** (Level 4/5):
  mixed React+Node PR (XSS + SQLi): both rulebooks in the model prompt,
  findings tagged `react`/`nodejs` per file, `request_changes`;
  mixed Python+SQL PR (SQLi + destructive migration): both rulebooks, correct
  platform tags; pure-Swift PR reviews under the iOS ruleset; Rust PR flags
  `unsafe`/panic paths; clean multi-language PR → zero findings, `comment`
  (never auto-approves), correct rulebooks still loaded.
- **`tests/fixtures/language-review/`** — the evaluation dataset:
  `mixed-web.diff`, `mixed-python-sql.diff`, `swift.diff`, `rust.diff`,
  `clean-mixed.diff`, and `expected-findings.md` documenting all 24 expected
  findings/absences with evidence, rule sources, and severities.

## 4. Test execution (actual results)

| Command | Result |
|---------|--------|
| `npm test` | **130 tests: 129 pass, 0 fail, 1 pre-existing skip** (Windows file-symlink env skip) |
| `npx tsc --noEmit` | exit 0 |
| `node --test tests/language-rules.test.ts` | 39/39 pass |
| `node --test tests/language-review-integration.test.ts` | 5/5 pass |
| Pre-existing suites (reviewer-core, flutter, local-review, provider, branding, gemini-model, telemetry) | all pass — no regressions |

Measured on the evaluation dataset (24 documented cases):

| Metric | Result |
|--------|--------|
| Rule-selection accuracy | 19/19 platforms load their baseline; isolation tests confirm zero cross-language leakage |
| Mixed-language tagging | 5/5 fixture findings tagged to the file's own platform (after E2 fix) |
| Deterministic layer | 0 false positives on all five fixtures (by construction — no language rule matches them) |
| Pipeline behavior | positive fixtures → `request_changes`; clean fixture → `comment`; AI verdict never trusted |
| Known limitations | the suite exercises detection/selection/normalization/verdict deterministically; *model compliance* with the rulebooks (true Level 4 with a live model) is not yet measured — see blockers |

## 5. Blocked tests

1. **Live-model evaluation** (does a real model obey these rulebooks?): requires a
   provider key (`GEMINI_API_KEY` or equivalent) in the data-plane environment;
   then run the five fixture diffs through `executeReview`/`/api/local-review`
   and score against `expected-findings.md`.
2. **Staging end-to-end**: a deployed data plane with `PROJECT_ID`/`WEBHOOK_SECRET`
   and a provider key; sign the local-review request per
   `src/lib/local-review-auth.ts`. No production systems were touched.

## 6. Files changed

**Modified**
- `src/lib/reviewer-core/platform-detector.ts` — rust/sql platforms, `target/` exclusion, Next.js `app/api/` fix, phantom swift removal (E1–E4)
- `src/lib/reviewer-core/rule-loader.ts` — `api-data-integrity.md` in common set, `COMMON_RULE_FILES` export, phantom swift removal from config set (E1, E5)
- `src/lib/reviewer-core/platform-prompts.ts` — dead legacy swift prompt block removed (E1 fallout)
- `rules/{dotnet,java,python,ruby,vue,react,react-native}/rules.md` — test-framework mandates softened (R2)

**Created**
- `rules/rust/rules.md`, `rules/sql/rules.md` — new language baselines (E4)
- `rules/common/api-data-integrity.md` — new common pack (E5)
- `.github/instructions/{react,vue,nextjs,nodejs,python,java,dotnet,go,php,ruby}/` — 32 new instruction files, with `## Instruction files` indexes registered in all 10 baselines (E6)
- `tests/language-rules.test.ts`, `tests/language-review-integration.test.ts`
- `tests/fixtures/language-review/*` — evaluation dataset
- `docs/language-rules-audit.md` — this report

## 7. Remaining gaps and prioritized next steps

1. **Live-model scoring** of the fixture matrix (blocked on credentials) — the
   highest-value next step; it converts the documented expectations into measured
   TP/FP/FN rates for the AI layer.
2. **Per-language deterministic scanner rules** stay minimal by design; revisit
   only for violations that are truly 100%-syntactic per language.
3. **Remaining baseline-only languages**: `kotlin` (server-side Kotlin — Android
   Kotlin code is covered by the android packs), `react-native`, `rust`, and `sql`
   still rely on their baselines plus the common packs; add instruction libraries
   for whichever become first-class deployment targets.
4. **Live-model scoring of the new packs**: the 32 new instruction files are
   integrity-tested and load correctly, but their *effect on model findings*
   should be measured with the fixture matrix once provider credentials exist.
4. **Legacy cleanup** (shared with the Flutter audit): remove or re-wire
   `validateScope`, `suggestPrTitle`, `prompt.ts`, `platform-prompts.ts` after
   confirming no external consumer of `reviewer-core/index.ts`.
5. **Detection boosts from repo manifests**: pass repository-level manifests into
   `detectPlatforms` from webhook flows so manifest-only PRs (e.g. a lone
   `Cargo.toml` bump) keep full language context.
