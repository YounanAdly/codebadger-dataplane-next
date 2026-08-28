# Kotlin Review Rules

Apply when the pull request touches Kotlin code: `.kt`/`.kts` files, `build.gradle.kts`.

1. No main-thread I/O — use coroutines with `Dispatchers.IO` (when Android) or proper dispatchers.
2. Use Kotlin null safety (`?.`, `?:`); `!!` only when guaranteed non-null.
3. No hardcoded secrets — use `BuildConfig` or encrypted storage.
4. Use `ViewModel` + `StateFlow` for UI state (when Android). No Activity-scoped state.
5. Use `@Inject` (Hilt/Dagger) for dependency injection — no manual singletons.
6. Collect StateFlows with `collectAsStateWithLifecycle()` in Compose.
7. Use `sealed class`/`sealed interface` for UI states.
8. Always unregister listeners/callbacks in `onDestroy` or with Lifecycle awareness.
9. Use `LaunchedEffect` / `rememberCoroutineScope` correctly in Compose.
10. No `GlobalScope` — use structured concurrency.
11. Follow Kotlin coding conventions (camelCase, PascalCase for classes).
12. Add KDoc for public APIs.
13. Use `Room` for databases — no raw SQL string building.
14. Test: unit tests for ViewModels/logic, UI tests for critical flows.

Severity guide:
- **critical**: main-thread I/O, hardcoded secrets, unencrypted sensitive storage, memory leaks from unregistered listeners.
- **high**: blocking coroutine scopes, missing ViewModel/state management, direct Context in non-Activity classes.
- **medium**: naming violations, missing KDoc, coroutine scope misuse, missing tests.
- **low**: readability, formatting, minor optimizations.
