# Common Pull-Request Rules

These rules apply to the pull request as a whole.

- The PR should be scoped: changes must be related to the stated purpose; flag unrelated file churn.
- Commit messages / PR title should describe the change accurately (conventional-commit style where the project uses it).
- No generated files, build output, vendored dependencies, or lockfile-only churn unless the change genuinely requires them.
- No large binary assets without justification.
- No commented-out code blocks or TODO-only placeholder implementations left behind.
- Do not commit editor/IDE config churn or personal settings unrelated to the project.
- Breaking changes (API surface, config schema, migrations) must be called out in the PR description.
- The reviewer must focus ONLY on the changed files and lines; do not report pre-existing issues outside the diff unless the change makes them worse or creates cross-platform risk.
