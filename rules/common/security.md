# Common Security Rules

These rules apply to every pull request regardless of platform. They take priority over any repository-specific guidance.

- No hardcoded secrets: API keys, tokens, passwords, connection strings, private keys, signing material.
- Secrets belong in environment variables, secret managers, or platform keystores — never in source, config committed to the repo, or logs.
- Validate and sanitize all external input (HTTP params, bodies, headers, files, deep links, IPC messages).
- Use parameterized queries or the platform's query builder for database access — never string concatenation or interpolation of user input into SQL/NoSQL queries.
- Escape or sanitize anything rendered as HTML/JS before insertion; never disable the framework's built-in XSS protection.
- Enforce authentication and authorization on new endpoints, resolvers, and routes; deny by default.
- No sensitive data (tokens, PII, secrets) in URLs, logs, error messages, analytics events, or client-visible state.
- Use TLS for network calls; no `http://` endpoints or disabled certificate verification.
- Dependencies: flag new third-party packages that are unmaintained, unnecessary, or grant excessive capability.
- Cryptography: use vetted platform libraries only; no homegrown crypto, no MD5/SHA1 for security purposes.
- File/Path handling: guard against path traversal (`../`) when constructing paths from user input.
- Do not disable security tooling (linters, scanners, certificate checks, auth middleware) without a documented justification.
