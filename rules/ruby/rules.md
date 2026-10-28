# Ruby Review Rules

Platform detection signals: `Gemfile`, `.rb` files, `.rubocop.yml`.

This file is the **loading index** for Ruby review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/ruby/`:

- .github/instructions/ruby/ruby.instructions.md — language correctness: exceptions, dynamic dispatch, mutation of shared state, coercion traps
- .github/instructions/ruby/rails.instructions.md — Rails: authorization, strong parameters, ActiveRecord N+1, jobs, migrations
- .github/instructions/ruby/testing.instructions.md — RSpec/Minitest behavior assertions with the project's stack

## Baseline rules (always loaded)

1. Never interpolate user input into SQL/ARel — use parameterized queries or ActiveRecord predicates.
2. Escape output in views; never mark user input `html_safe`.
3. No hardcoded secrets — use Rails credentials or environment variables.
4. Strong parameters: permit only expected attributes in controllers; no `permit!`.
5. Mass assignment: whitelist at the model/controller boundary.
6. Auth: verify authorization on new actions (policy objects / Pundit); deny by default.
7. Never `eval`, `send` with user-supplied method names, or `constantize` untrusted input.
8. Deserialization: never `Marshal.load`/`YAML.load` untrusted data (`safe_load` only).
9. Background jobs: make them idempotent, set retries and timeouts; don't pass large objects.
10. File handling: sanitize paths, validate upload types, don't trust filenames.
11. Follow Ruby style guide (RuboCop) and Rails conventions (skinny controllers, models as data+behavior).
12. Migrations: reversible, add indexes for new foreign keys, no data destruction without a plan.
13. Test with the project's existing framework (RSpec/Minitest); cover authorization and error paths.

Severity guide:
- **critical**: SQL injection, XSS via `html_safe`, hardcoded secrets, unsafe deserialization, missing auth.
- **high**: missing strong parameters, missing CSRF, irreversible migrations, unsafe `eval`/`send`.
- **medium**: naming violations, missing tests, missing indexes.
- **low**: readability, formatting, minor optimizations.
