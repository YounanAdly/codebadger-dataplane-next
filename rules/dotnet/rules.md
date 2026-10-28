# .NET Review Rules

Platform detection signals: `.csproj`, `.sln`, `.cs`/`.razor` files.

This file is the **loading index** for .NET review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/dotnet/`:

- .github/instructions/dotnet/csharp.instructions.md — C# correctness: async/await, ConfigureAwait, disposal ownership, cancellation, LINQ discipline
- .github/instructions/dotnet/aspnet.instructions.md — ASP.NET Core & EF Core: authorization, DI lifetimes, N+1, transactions, bounded queries
- .github/instructions/dotnet/testing.instructions.md — xUnit/NUnit behavior assertions with the project's stack

## Baseline rules (always loaded)

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
12. Test with the project's existing stack (xUnit + Moq and `WebApplicationFactory` where already used); respect its analyzer configuration.
13. Use `IHttpClientFactory` — not raw `new HttpClient()`.
14. Respect `.editorconfig` and analyzer rules — no suppressed warnings without justification.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, `async void`, path traversal, unencrypted sensitive storage.
- **high**: missing `IDisposable`, blocking async code, thread-safety issues, missing DI.
- **medium**: naming violations, missing XML docs, unused usings, missing tests.
- **low**: readability, formatting, minor optimizations.
