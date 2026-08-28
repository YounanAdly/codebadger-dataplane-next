# Common Code Quality Rules

These rules apply to every pull request regardless of platform.

- Follow the language's standard naming conventions (check the detected platform's style guide).
- Follow the project's existing code style; do not mix styles within one change.
- No dead code: commented-out blocks, unused variables, unused imports, unreachable branches.
- Keep functions small and single-purpose; extract duplicated logic into shared helpers.
- Prefer explicit, typed signatures over `any` / `dynamic` / `object` where the language offers typing.
- Public APIs (exported functions, classes, components) need documentation of intent, parameters, and return values.
- Do not leave debug logging (`console.log`, `print`, `println!`, `fmt.Println`) in production code paths.
- Magic numbers and repeated string literals should be named constants.
- Error paths are code too: every failure mode must be handled explicitly, never swallowed silently.
- Prefer composition over inheritance; avoid deep nesting (more than 3 levels of conditionals/loops).
