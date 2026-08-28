# .NET Review Rules

Apply when the pull request touches .NET code: `.cs` files, `.csproj`, `.sln`, `.razor`.

1. Never use string concatenation in SQL — use parameterized queries or EF Core.
2. No hardcoded secrets — use User Secrets, environment variables, or Azure Key Vault.
3. Implement `IDisposable` for unmanaged resources; use `using` declarations.
4. Never use `async void` — always `async Task`.
5. Use `ConfigureAwait(false)` in library code.
6. Use dependency injection — no manual singletons.
7. Enable nullable reference types — no `null!` suppressions.
8. Use `ILogger` — never `Console.WriteLine` in services.
9. Follow C# naming: PascalCase public members, `_camelCase` private fields.
10. Use records for DTOs; primary constructors where idiomatic (C# 12).
11. Use `IEnumerable` / `IAsyncEnumerable` for lazy sequences.
12. Test: xUnit + Moq for unit tests, `WebApplicationFactory` for integration.
13. Use `IHttpClientFactory` — not raw `new HttpClient()`.
14. Respect `.editorconfig` and analyzer rules — no suppressed warnings without justification.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, `async void`, path traversal, unencrypted sensitive storage.
- **high**: missing `IDisposable`, blocking async code, thread-safety issues, missing DI.
- **medium**: naming violations, missing XML docs, unused usings, missing tests.
- **low**: readability, formatting, minor optimizations.
