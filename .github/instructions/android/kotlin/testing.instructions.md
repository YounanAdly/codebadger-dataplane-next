---
description: "Use when an Android change adds or modifies tests, or changed behavior lacks coverage. Enforces useful JUnit/Robolectric/instrumented tests with the project's existing tooling."
applyTo: "**/src/test/**/*.kt,**/src/androidTest/**/*.kt,**/src/test/**/*.java,**/src/androidTest/**/*.java"
---

# Testing (Android)

## Scope

Applies to unit tests (JUnit/Robolectric), instrumented tests (Espresso/UI Automator), and testability of changed production code.

## Review rules

1. **Changed behavior gets tests** at the level the project uses: logic/ViewModels → JVM unit tests; UI flows → instrumented tests where the project maintains them.
2. **Use the project's existing stack**: JUnit4/5, Robolectric, MockK/Mockito, Turbine, truth/kotlin.test — whatever the gradle files already declare. No second framework in one PR.
3. **Main-thread/dispatcher control**: coroutine tests use the project's dispatcher replacement (`Dispatchers.setMain`, injected TestDispatcher); `runTest` over `runBlocking` where the project uses it.
4. **Tests are deterministic**: injected clocks, faked network layers, no real `Thread.sleep` synchronization, no order dependence.
5. **Dependencies isolated at the seams the project already has** (constructor injection, Hilt test modules, fakes) — tests don't hit real endpoints or real databases without the project's test doubles.
6. **Error and edge paths covered**: configuration change survival where relevant (ViewModel tests), empty data, failures.
7. **Assertions assert outcomes**: state after actions, emitted flows/values, rendered views — not incidental internals.

## Positive recommendations

- Bug-fix PRs include a regression test that fails without the fix.
- Prefer a few meaningful assertions over many trivial ones.

## Anti-patterns to flag

```kotlin
// BAD — real network in a unit test
@Test fun testFetch() = runTest { repo.fetch() } // hits prod API

// BAD — sleep-based sync
Thread.sleep(2000); assertEquals(3, count)

// BAD — live dispatchers in tests
viewModel.load() // uses Dispatchers.IO directly, uncontrolled timing
```

## Preserve existing conventions

- **Do not require tests for trivial changes without justification** (renames, resource tweaks, generated code).
- Follow the project's test source-set layout and naming conventions.
