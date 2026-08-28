---
description: "Use when a Flutter change handles exceptions, failures, or error presentation. Enforces meaningful error states without swallowing exceptions and without forcing new error frameworks."
applyTo: "**/lib/**/*.dart,**/test/**/*.dart"
---

# Error Handling (Flutter)

## Scope

Applies to exception handling, error mapping, and error presentation (screens, dialogs, snackbars, state errors).

## Hard rules

1. **No swallowed exceptions.** Empty `catch` blocks or catches that only `return` hide real failures. Handle, propagate, or log through the project's logging mechanism.
2. **No bare `catch` on `Error` types unintentionally**: `catch (e)` catches everything including programming errors (`TypeError`, `RangeError`). Catch specific exception types where the project defines them, or use `on Exception catch`.
3. **No `print()`** for errors (or anything else) — use the project's logger.
4. **User-facing errors are meaningful and localized** — raw exception text like `FormatException: ...` must not reach the UI.

## Review rules

- Domain-specific errors: if the project defines typed exceptions/failures (e.g. `NetworkFailure`, `AuthFailure`), new code maps errors into them instead of introducing parallel string-based error flags.
- Every screen that loads data presents an error state consistent with the project's pattern (error widget, snackbar, inline banner) and offers recovery (retry) where the project does.
- Async error paths are handled: every `await` that can throw inside UI-triggered code either catches, or the project's global handler (e.g. `FlutterError.onError`, `runZonedGuarded`) owns it — and zone handlers must not be duplicated per call site.
- Preserve existing error-handling patterns: don't introduce a new result/either type or error framework alongside the project's existing one.
- Distinguish expected failures (offline, 404) from bugs (unhandled `TypeError`) — the UI/UX treatment differs, and conflating them hides crashes.

## Positive recommendations

- Wrap third-party/plugin calls at the boundary where the project already wraps them (channel/plugin wrappers), converting platform exceptions into project errors.
- Include enough context when logging (operation, endpoint/user action) without logging secrets or full payloads.

## Anti-patterns to flag

```dart
// BAD — swallowed
try { await repo.sync(); } catch (_) {}

// BAD — raw exception text to the user
Snackbar.show(SnackBar(content: Text(e.toString())));

// BAD — FutureBuilder with no error branch
return FutureBuilder(future: load(), builder: (c, s) => s.hasData ? A() : Spinner());

// BAD — catching programming errors to "fix" a crash
try { items[index]; } catch (e) { return; } // fix the bounds bug instead
```

## Preserve existing conventions

- If the project has a centralized error funnel (interceptor, zone, bloc observer), new code plugs into it — do not add per-call duplicate handling for cases the funnel already covers.
