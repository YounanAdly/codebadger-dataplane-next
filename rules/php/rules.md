# PHP Review Rules

Apply when the pull request touches PHP code: `.php` files, `composer.json`.

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
