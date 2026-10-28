---
description: "Use when a Go change builds or consumes HTTP services: handlers, middleware, clients. Enforces timeouts, bounded work, and safe error responses."
applyTo: "**/*.go"
---

# Go HTTP Services

## Scope

Applies to `net/http` (or router-framework) handlers, middleware, and outbound HTTP clients in Go. Applies only where the change actually touches HTTP code.

## Hard rules

1. **Servers have timeouts**: `ReadTimeout`/`WriteTimeout`/`IdleTimeout` (or `ReadHeaderTimeout` + handler-level `TimeoutHandler`) — a new server with no timeouts on a public port is a slowloris finding.
2. **Handlers bound their work**: request bodies limited (`http.MaxBytesReader`/`LimitReader`), list endpoints paginated per the project, heavy work deferred to the project's queue — unbounded reads/queries on public routes are findings.
3. **Mutating handlers authorize** (middleware or explicit check per the project) before touching state.

## Review rules

- `resp.Body.Close()` on every outbound call and body read with limits; outbound clients carry `http.Client{Timeout: …}` or per-request contexts — `http.DefaultClient` for long calls is a finding.
- Handler errors map to the project's JSON error shape/status codes — internal error strings (`err.Error()` of a driver) to clients are findings.
- Middleware ordering (auth, logging, recovery) consistent with the project; panic recovery on public handlers where the project recovers.
- Graceful shutdown: `Shutdown(ctx)` wired to SIGTERM where the project does it; new servers in tests/services follow the pattern.
- `r.Context()` flows into DB/cache calls inside handlers so cancellations propagate.
- Redirect/open-proxy hygiene: `http.Redirect` targets validated when influenced by input.

## Anti-patterns to flag

```go
// BAD — no timeouts anywhere
srv := &http.Server{Addr: ":8080", Handler: mux}

// BAD — unbounded outbound call on the request path
resp, err := http.Get(userURL)

// BAD — leaks internals
http.Error(w, err.Error(), 500)
```

## Preserve existing conventions

- Follow the project's router (chi/gin/echo/stdlib) and client wrappers; review consistency, not ideology.
