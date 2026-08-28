# Node.js Review Rules

Apply when the pull request touches Node.js backend code: server files, API routes, scripts, `package.json` with server dependencies (express, fastify, nest, etc.).

1. Never trust client input: validate request params, bodies, headers, and query strings with a schema (zod, joi, class-validator, etc.).
2. Use parameterized queries for databases — never string interpolation into SQL/NoSQL.
3. No hardcoded secrets — use environment variables or a secret manager; never log secrets.
4. Auth: every new endpoint needs authentication + authorization checks; deny by default.
5. Async: always `await` promises or attach error handlers; unhandled rejections crash the process.
6. Never expose stack traces or internal errors to clients — map errors to safe responses.
7. Rate-limit and size-limit public endpoints; guard against unbounded loops and payloads.
8. Use `crypto.randomBytes`/`crypto.randomUUID` for tokens/ids — never `Math.random()` for security values.
9. Child processes / eval: never pass user input to `exec`, `eval`, or `Function`.
10. File handling: sanitize paths (path traversal), limit upload size and type.
11. Follow the project's module structure and error-handling middleware pattern.
12. Test: add/update tests for new endpoints and logic; integration-test the happy and error paths.

Severity guide:
- **critical**: SQL/command injection, hardcoded secrets, missing auth on mutating endpoints, RCE vectors (`eval`/`exec` with input).
- **high**: unhandled promise rejections, missing input validation, secrets in logs, missing rate limits.
- **medium**: missing tests, inconsistent error handling, missing types.
- **low**: readability, formatting, minor optimizations.
