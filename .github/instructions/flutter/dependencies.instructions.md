---
description: "Use when a Flutter change adds, upgrades, or removes packages in pubspec.yaml. Enforces justified dependencies with attention to maintenance and compatibility."
applyTo: "**/pubspec.yaml,**/pubspec.lock"
---

# Dependencies (Flutter)

## Scope

Applies to changes in `pubspec.yaml` (and lockfile churn): new packages, version bumps, removals.

## Review rules

1. **Every new dependency needs a justification.** The PR should make the need obvious; flag trivial additions (a package for one substring check, one toast, one date format) — the Dart SDK, Flutter, or an existing dependency already solves them.
2. **Check existing dependencies first.** If `dio` is present, adding `http` for one call is a finding. Duplicate-purpose packages (two state solutions, two DI solutions, two i18n packages) need strong justification.
3. **Maintenance health**: actively maintained, compatible with the project's Flutter/Dart SDK constraint, and not archived/abandoned. Flag long-unmaintained packages for new adoption.
4. **Version constraints**: additions follow the project's existing constraint style (`^x.y.z` carets vs. exact pins); upgrades that force SDK bumps or break other constraints are flagged with the affected packages named.
5. **License and size awareness**: flag GPL/unknown-license additions for commercial apps, and heavyweight packages pulled in for a single utility.
6. **Lockfile-only churn** (hundreds of `pubspec.lock` lines with no manifest change) is suspicious — likely an accidental `pub upgrade`.

## Positive recommendations

- Prefer Flutter-first/dev packages (`flutter_lints`, integration_test) sourced from the project's existing tooling.
- When removing a package, check for leftover imports/code and document the replacement.

## Anti-patterns to flag

```yaml
# BAD — a package for a trivial built-in
  sprintf: ^6.0.0        # string interpolation exists

# BAD — duplicate purpose
  provider: ^6.1.1       # project already uses riverpod everywhere
  get: ^4.6.6

# BAD — unrelated lockfile churn in a feature PR
```

## Preserve existing conventions

- Do not suggest replacing an existing, working dependency with a more popular one without a concrete deficiency (bugs, maintenance, incompatibility).
- Generated lockfile updates accompanying a justified manifest change are fine — no finding.
