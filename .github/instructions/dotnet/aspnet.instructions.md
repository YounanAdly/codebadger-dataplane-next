---
description: "Use when a change touches ASP.NET Core endpoints, middleware, DI, or EF Core. Applies only where the framework is actually used."
applyTo: "**/*.cs"
---

# ASP.NET Core & EF Core Rules

## Scope

Applies when the change touches controllers/minimal APIs, middleware, DI registrations, or EF Core usage. Non-web .NET code yields to the C# pack.

## Hard rules

1. **Every mutating endpoint authorizes** (`[Authorize]`, policies, or filter per the project) before touching state — a new POST/PUT/DELETE endpoint with no auth in its chain is a critical finding.
2. **Model state validated**: request DTOs with the project's validation (`DataAnnotations`/FluentValidation/manual) — raw `Request.Form`/`RouteData` access into business logic is a finding where the project validates elsewhere.
3. **SQL never built by interpolation** (`FromSqlRaw($"...")` with variables) — `FromSqlInterpolated`/parameters/EF LINQ only.
4. **DI lifetimes are coherent**: a scoped service injected into a singleton (captive dependency) is a finding; `DbContext` is scoped and never shared across requests.

## Review rules

- EF Core query discipline: N+1 from lazy-loading in loops (`Include`/projection per the project); `AsNoTracking()` on read-only queries where the project uses it; client-side evaluation (`Where` on non-db props pulling whole tables) flagged with evidence; `SaveChangesAsync` awaited.
- Transactions: multi-step writes use `TransactionScope`/`BeginTransaction`/the project's unit-of-work; partial writes on error are findings.
- Middleware order matches intent (auth before endpoints, CORS before routing per the project template); new endpoints registered before `UseAuthentication`/`UseAuthorization` are findings.
- Background work: `IHostedService`/`BackgroundService` with cancellation-token loops and try/catch per iteration; `Task.Run` fire-and-forget in request handlers is a finding (work dies with the request/scope).
- Configuration: secrets from configuration providers, not literals; `IOptions<T>` validated per the project.
- Pagination/limits on list endpoints; unbounded `ToList()` on user-facing queries is a finding.
- Error responses: `ProblemDetails`/project error middleware — no raw exception text to clients.

## Anti-patterns to flag

```csharp
// BAD — captive dependency: DbContext shared across all requests
services.AddSingleton<OrderCache>(); // ctor takes AppDbContext (scoped)

// BAD — interpolation into raw SQL
_context.Database.ExecuteSqlRaw($"DELETE FROM carts WHERE id = {id}");

// BAD — unbounded query to a list endpoint
return await _db.Orders.ToListAsync();
```

## Preserve existing conventions

- Follow the project's .NET version and existing patterns (controllers vs minimal APIs, repository vs direct DbContext) — review consistency, not ideology.
