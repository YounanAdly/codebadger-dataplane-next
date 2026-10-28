# Language Review Fixtures — Expected Findings

Evaluation dataset for Codrevia's non-Flutter rulesets, kept separate from the rules so
future rule changes can be regression-tested against the same expectations. Every diff
is a realistic multi-file pull request (not a synthetic one-liner).

| Fixture | Platforms detected | Purpose |
|---------|--------------------|---------|
| `mixed-web.diff` | react + nodejs | React/TSX + Node.js defects; per-file platform tagging |
| `mixed-python-sql.diff` | python + sql | Python API + destructive migration; API/data-integrity coverage |
| `swift.diff` | ios | Pure-Swift PR (no Xcode manifest in diff) still reaches the iOS ruleset |
| `rust.diff` | rust | Rust pack coverage (unsafe, panics, unwraps, detached spawns) |
| `clean-mixed.diff` | react + nodejs + sql | Valid implementations that must not be flagged |

## `mixed-web.diff` — must be flagged

| # | Location | Defect | Rule source | Severity |
|---|----------|--------|-------------|----------|
| W1 | `src/components/CommentList.tsx:15` | `dangerouslySetInnerHTML` with unsanitized `c.bodyHtml` (XSS) | `rules/react/rules.md` 1 | critical |
| W2 | `src/components/CommentList.tsx:15` | Mapped `<li>` without a stable `key` | `rules/react/rules.md` 3 | high (per React severity guide: "missing key props on large lists" is critical when lists are large/stateful) |
| W3 | `src/components/CommentList.tsx:7-10` | `useEffect` fetch ignores `postId` (`[]` deps → stale results), no error state | `rules/react/rules.md` 7 | high |
| W4 | `server.js:9,10` | SQL built by string interpolation of `req.body` (injection) | `rules/nodejs/rules.md` 2 + `rules/common/security.md` | critical |
| W5 | `server.js:8` | Mutating endpoint without authentication/authorization | `rules/nodejs/rules.md` 4 | critical |
| W6 | `server.js:8` | `Math.random()` used to mint a security token | `rules/nodejs/rules.md` 8 | critical |
| W7 | `server.js:12` | `err.stack` returned to the client (internal error exposure) | `rules/nodejs/rules.md` 6 | high |

## `mixed-python-sql.diff` — must be flagged

| # | Location | Defect | Rule source | Severity |
|---|----------|--------|-------------|----------|
| P1 | `app/api/orders.py:12` | f-string SQL with interpolated parameters (injection) | `rules/python/rules.md` 2 | critical |
| P2 | `app/api/orders.py:15` | `pickle.loads()` on untrusted request body (unsafe deserialization) | `rules/python/rules.md` 1 | critical |
| P3 | `app/api/orders.py:17` | Bare `except:` that also swallows the filtering bug | `rules/python/rules.md` 6 | high |
| P4 | `db/migrations/004_orders.sql:2` | `DROP TABLE` destructive migration without a documented, reversible plan | `rules/sql/rules.md` 2 | critical |
| P5 | `db/migrations/004_orders.sql:1` | `NOT NULL`-less column added without the backfill plan the next migration must provide (informational unless paired with code assuming non-null) | `rules/sql/rules.md` 3 | low/info |

## `swift.diff` — must be flagged (platform: ios)

| # | Location | Defect | Rule source | Severity |
|---|----------|--------|-------------|----------|
| S1 | `App/Sources/OrderService.swift:4` | Hardcoded live API key in source | `rules/ios/rules.md` 2 + `common/security.md` | critical |
| S2 | `App/Sources/OrderService.swift:9,11` | Force unwraps `URL(string:)!`, `data!`, and `try!` on fallible network paths | `rules/ios/rules.md` 1 + ios swift instructions | critical/high |
| S3 | `App/Sources/OrderService.swift:9` | Cleartext `http://` endpoint | `rules/ios/rules.md` 12 (ATS) + `common/security.md` | critical |
| S4 | `App/Sources/OrderService.swift:5,8` | Repeating `Timer` never invalidated; closure captures `self` context strongly → timer retains its target | `rules/ios/rules.md` 3 + ios memory-management instructions | high |
| S5 | `App/Sources/OrderService.swift:11` | Decode failure crashes the app (`try!`) instead of surfacing an error | ios swift error-handling instructions | high |

## `rust.diff` — must be flagged (platform: rust)

| # | Location | Defect | Rule source | Severity |
|---|----------|--------|-------------|----------|
| R1 | `src/handler.rs:7` | `unsafe` pointer write with no safety justification, aliasing the locked `Mutex` | `rules/rust/rules.md` 3 | critical |
| R2 | `src/handler.rs:6,8` | `unwrap()` on lock poisoning and on untrusted `raw.parse()` — panics on the request path | `rules/rust/rules.md` 1–2 | critical/high |
| R3 | `src/handler.rs:10-13` | Detached thread spawn with no join/shutdown path on a request handler | `rules/rust/rules.md` 7 | high |

## `clean-mixed.diff` — must NOT be flagged

| # | Location | Valid implementation | Rule that must stay silent |
|---|----------|----------------------|----------------------------|
| C1 | `src/components/CommentList.tsx:25` | Stable `key={c.id}`, text-only rendering (no `dangerouslySetInnerHTML`) | react rules 1, 3 |
| C2 | `src/components/CommentList.tsx:8,19` | `AbortController` cleanup + `[postId]` deps (no stale fetch) | react rules 7 |
| C3 | `src/components/CommentList.tsx:16,21` | Error state with `role="alert"` | react rule 7 |
| C4 | `server.js:8` | `requireUser` middleware before the mutating handler | nodejs rule 4 |
| C5 | `server.js:10-12` | Request body validated before use; 400 on malformed input | nodejs rule 1 |
| C6 | `server.js:15` | Parameterized SQL (`VALUES (?, ?, ?)`) | nodejs rule 2 |
| C7 | `server.js:13` | `crypto.randomUUID()` for the token | nodejs rule 8 |
| C8 | `server.js:19-20` | Internal error logged server-side; client gets a safe message | nodejs rule 6 |
| C9 | `db/migrations/004_orders.sql` | Additive-only migration with a documented backfill plan | sql rules 2–3 |

## Deterministic layer expectations

None of these fixtures trigger the deterministic scanner: its only language-specific
rules are Angular (`.ts`/`.html` project rules) and Flutter (`dart-tls-bypass`,
`android-cleartext-traffic`); these diffs contain no line those rules can match with
100% accuracy. Language-level defects here (SQLi, XSS, unsafe deserialization, panics)
are contextual and belong to the AI layer — asserted via the pipeline integration test
with a stubbed model boundary.
