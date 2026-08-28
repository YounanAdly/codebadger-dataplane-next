---
description: "Use when Kotlin code throws, catches, maps, or presents errors. Enforces typed error handling without swallowing failures and without forcing new error frameworks."
applyTo: "**/*.kt"
---

# Error Handling (Android / Kotlin)

## Scope

Applies to exception handling, error mapping (including HTTP/db errors), and error presentation.

## Hard rules

1. **No swallowed exceptions**: empty catch blocks or catches that only `return` hide real failures. Handle, map, or rethrow.
2. **`CancellationException` is rethrown** in coroutine catch blocks — swallowing it breaks structured concurrency cancellation.
3. **No raw exception text to users**: `e.message` into a Toast/Snackbar leaks internals and isn't localized — map through the project's message resources.
4. **No `print`/`println`/`Log` raw in production paths for user-facing failures** — use the project's logging (Timber or equivalent) consistent with build-type gating.

## Review rules

- Typed errors: if the project defines sealed error/failure types, new throwing code maps into them; introducing parallel string-flag errors is a finding.
- Catch specificity: `catch (e: IOException)` where that's what can occur; blanket `catch (e: Exception)` around large blocks is a finding (masks bugs).
- UI presents loading/success/error consistently with the project's pattern and offers recovery (retry) where the project does.
- Crash/global handlers (default `Thread.UncaughtExceptionHandler`, coroutine `CoroutineExceptionHandler`, Firebase Crashlytics hooks) — new code plugs into them rather than adding parallel handlers.
- `runCatching` usage is reviewed like try/catch (it also catches CancellationException in coroutine contexts — flag when misused there).

## Positive recommendations

- Map low-level errors (IOException, HttpException, SQLiteException) into domain errors at the data-layer boundary the project owns.
- Log with operation context (endpoint/action) without logging secrets or PII.

## Anti-patterns to flag

```kotlin
// BAD — swallowed
try { repo.sync() } catch (e: Exception) { }

// BAD — CancellationException swallowed inside coroutine
try { work() } catch (e: Exception) { showError(e) } // breaks cancellation

// BAD — raw exception to user
Toast.makeText(ctx, e.message, LENGTH_SHORT).show()
```

## Preserve existing conventions

- If the project uses Either/Result wrappers consistently, review within that idiom — don't demand try/catch rewrites (or vice versa).
- New code plugs into the project's centralized error funnel instead of duplicating handling per call site.
