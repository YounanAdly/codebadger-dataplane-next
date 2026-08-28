# Unknown Platform — Fallback Review Rules

Use these rules when no platform reached the detection threshold. Do not make framework-specific claims without repository evidence.

1. No hardcoded secrets, API keys, tokens, or passwords in the diff.
2. Validate and sanitize all external input before use.
3. Database/file access must be parameterized or safely escaped — never built by string concatenation with user input.
4. Handle errors explicitly — no silently swallowed exceptions or empty catch blocks.
5. New endpoints, routes, or handlers must be authenticated and authorized where the application requires it.
6. No debug logging or commented-out code left in the change.
7. Follow the naming and style conventions already visible in the surrounding files.
8. Tests should cover changed behavior where a test framework is present in the repository.
9. Repeated logic should be extracted into shared helpers.
10. New third-party dependencies must be justified — flag unmaintained or excessive ones.
11. Documentation and comments must match the new behavior.
12. Only report findings supported by the actual diff — no speculation about frameworks or libraries not evidenced in the repository.
