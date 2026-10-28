# PHP Review Rules

Platform detection signals: `composer.json`, `.php` files.

This file is the **loading index** for PHP review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/php/`:

- .github/instructions/php/php.instructions.md — language correctness: strict comparisons, error handling, untrusted deserialization, coercion traps
- .github/instructions/php/frameworks.instructions.md — Laravel/Symfony: authorization, mass assignment, ORM N+1, queues, CSRF
- .github/instructions/php/testing.instructions.md — PHPUnit/Pest behavior assertions with the project's stack

## Baseline rules (always loaded)

1. Never interpolate user input into SQL — use prepared statements (PDO / ORM).
2. Escape all output for its context (`htmlspecialchars` for HTML); never disable framework escaping.
3. No hardcoded secrets — use environment variables.
4. Validate all request input (params, bodies, files) before use.
5. File uploads: validate type/size, store outside webroot with random names, never trust client filenames.
6. Use password_hash/password_verify — never md5/sha1 for passwords.
7. Disable debug mode in production configs; never expose stack traces to users.
8. Serialize safely: never `unserialize()` untrusted data.
9. Commands: never pass user input to `exec`/`shell_exec`/backticks; use `escapeshellarg` if unavoidable.
10. Follow PSR-12 coding style and the framework's conventions (Laravel/Symfony).
11. Type-hint parameters and return types on new methods.
12. CSRF protection on state-changing routes; auth middleware on protected routes.
13. Test: PHPUnit tests for new logic; cover error paths.

Severity guide:
- **critical**: SQL injection, XSS, hardcoded secrets, unsafe deserialization, missing auth on mutating routes.
- **high**: missing CSRF, missing input validation, debug mode enabled, path traversal.
- **medium**: naming violations, missing type hints, missing tests.
- **low**: readability, formatting, minor optimizations.
