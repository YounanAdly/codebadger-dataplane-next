---
description: "Use when a change touches Node.js runtime code (backend services, workers, scripts). Enforces event-loop safety, async correctness, and process/resource hygiene. Skip for browser/frontend code."
applyTo: "**/*.js,**/*.ts,**/*.mjs,**/*.cjs"
---

# Node.js Runtime & Async

## Scope

Applies to server-side JavaScript/TypeScript: services, workers, scripts, CLIs. It does **not** apply to browser/frontend bundles — when a change is frontend-only, this file's rules yield to the frontend packs.

## Hard rules

1. **Every promise is awaited or error-handled**: floating `async` calls, `Promise.all` without rejection handling, and unhandled rejections (which crash the process) are findings. Intentional fire-and-forget uses `void`/`unawaited()` with an upstream error handler.
2. **The event loop is not blocked on request paths**: synchronous crypto, large JSON transforms, `fs.*Sync`, heavy regex, or tight loops in request handling are findings — move off-loop (async APIs, streams, worker threads) with evidence of payload size.
3. **Environment/process boundaries**: no secrets in client-shipped code, no `process.env` reads of undefined required vars without a startup guard, `process.exit` only in CLI/entry contexts.

## Review rules

- Streams are the default for large payloads: `JSON.parse` on unbounded bodies, `fs.readFile` of user uploads, and response buffering without limits are findings — cap sizes and prefer stream pipelines with `pipeline()` (which propagates errors and cleanup).
- Timers and intervals are cleared on shutdown/cancel paths; long-running services handle SIGTERM (drain, close servers/connections) where the project does graceful shutdown.
- Child processes: `execFile`/`spawn` with argument arrays over `exec` with string interpolation; user input never reaches a shell.
- EventEmitter/listener symmetry: `on` without `off`/`removeListener` on long-lived emitters leaks; `MaxListenersExceededWarning` sources are findings.
- Errors: `Error` objects with codes/context the project's error middleware understands; never `throw` non-Errors, never swallow in `.catch(() => {})`.
- Modules: dynamic `import(variable)` of user-influenced specifiers is a finding; keep CommonJS/ESM consistent with the project.
- Buffer/`toString` boundaries: encodings explicit (`buffer.toString("utf8")`), no implicit binary-to-string on user data.

## Anti-patterns to flag

```js
// BAD — unhandled rejection kills the process
process.on("boot"); asyncBoot(); // floating promise

// BAD — blocks the loop for the whole service
const users = JSON.parse(fs.readFileSync("users.json"));

// BAD — shell injection surface
exec(`convert ${req.body.file} out.png`);
```

## Preserve existing conventions

- The project's framework (Express/Fastify/Nest), module system, and logger are the baseline — review consistency, not ideology.
