---
description: "Use when writing or reviewing any Dart code. Enforces language-level best practices: null safety, typing, naming, readability, and effective-Dart idioms."
applyTo: "**/*.dart"
---

# Dart Language Rules

## Scope

Applies to every `.dart` file in the change: language-level quality only. Widget, state, and platform concerns are covered by their own instruction files.

## Hard rules

1. **Null safety is not optional.** No `!` force unwraps unless the value is provably non-null at that exact line (and prefer proving it with `if (x != null)`, `x?..`, or pattern matching instead).
2. **No `dynamic` unless the API boundary genuinely requires it.** Prefer concrete types, generics, or `Object?` with explicit casts.
3. **No silent catches.** `catch (e) {}` or `catch (e) { return; }` hides real failures — handle, log through the project's logging mechanism, or rethrow.
4. **Follow the project's analyzer config.** Rules in `analysis_options.yaml` are the baseline; do not suggest `// ignore:` comments without a written justification in the same PR.
5. **`late` requires proof of initialization before first read** (e.g. initialized in `initState`). Prefer nullable + explicit check if the proof is non-obvious.

## Review rules

- Prefer `final` for variables and fields that are not reassigned; prefer `const` where the value is compile-time constant.
- Immutable data models where practical: `@immutable` classes or `final` fields with `copyWith` — consistent with the project's existing model style.
- Naming follows [Effective Dart](https://dart.dev/guides/language/effective-dart): `lowerCamelCase` members, `PascalCase` types, `snake_case` files/libraries, `_` prefix for library-private.
- File granularity follows the project's existing convention (file name matching its main class, helpers/mixins co-located — as the project already does). Flag granularity only when it creates a meaningful maintainability problem (e.g. many unrelated top-level classes in one file while the rest of the project splits) or clearly breaks the project's own convention — never as a universal rule.
- Keep functions short and single-purpose; extract named helpers instead of deeply nested closures.
- Prefer pattern matching (`switch` expressions, `if-case`) over long `else-if` type-check chains on Dart ≥3 codebases.
- String interpolation over concatenation; collection literals over `List()` constructors; spread over `addAll`.

## Positive recommendations

- Use `Equatable`/`==`+`hashCode` overrides only when the project already does so for model equality.
- Prefer records or small data classes over tuples-of-dynamics in maps/lists.
- Use `sealed`/`base`/`final` class modifiers on new hierarchies when the project's SDK supports them and existing code does the same.

## Anti-patterns to flag

```dart
// BAD — force unwrap on an optional that can be null
final name = user!.name;

// BAD — dynamic propagates through the call site
dynamic result = jsonDecode(body);

// BAD — swallowed exception
try { await api.save(); } catch (_) {}

// BAD — mutable static/global state for "convenience"
var counter = 0;

// BAD — stringly-typed branching
if (type == 'premium') { ... } else if (type == 'basic') { ... }
// → prefer enums.
```

## Preserve existing conventions

- Do not flag legacy Dart idioms in files the change does not touch.
- If the project does not use a lint (e.g. cascade, patterns), suggest it only as a low-severity optional improvement, never as a blocking finding.
