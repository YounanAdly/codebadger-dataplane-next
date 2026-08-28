---
description: "Use when an Android change adds, moves, or restructures modules, layers, or feature boundaries. Enforces consistency with the architecture the project already uses — no architecture mandates."
applyTo: "**/*.kt,**/*.kts,**/build.gradle*,**/settings.gradle*"
---

# Architecture Consistency (Android)

## Scope

Applies when a pull request adds features, moves files, or changes module boundaries in an Android project. This file does not mandate an architecture.

## Review rules

1. **Detect the architecture the repository already uses** (MVVM with ViewModel+Repository, MVI, MVP, Clean multi-module, single-module feature packages — whatever exists) and review consistency with it. Do not recommend switching patterns.
2. **New features follow the existing layout** — same package structure and grouping (by feature or by layer) as neighboring features.
3. **Do not introduce a new architectural pattern in the same PR as a feature.**
4. **Preserve established boundaries.** If Activities/Fragments never touch the network in this codebase (repositories/use-cases own it), direct client usage in UI code is a finding. If DI (Hilt/Koin/manual) is established, new singletons bypassing it are a finding.
5. **UI state lives where the project keeps it** (ViewModel, presenter, store). An Activity holding app state that dies on rotation is a finding when the project routes state through ViewModels.
6. **Module boundaries respected**: an app-module feature reaching into another feature's `internal` API, or a PR reordering core/shared modules, is a finding.

## Positive recommendations

- Put shared code where the project already keeps it (core/common/ui packages) rather than creating parallel locations.
- Split classes that mix unrelated responsibilities (e.g. UI + networking + persistence in one type) using the project's own decomposition style (feature packages, sub-ViewModels, use cases).

## Anti-patterns to flag

```kotlin
// BAD — UI doing data-layer work in a ViewModel/Repository project
class ProfileActivity : AppCompatActivity() {
  onCreate() {
    OkHttpClient().newCall(...).execute() // networking in Activity
  }
}

// BAD — bypassing established DI
val db = Room.databaseBuilder(...).build() // in feature code, DI exists
```

## Preserve existing conventions

- A change is not wrong just because the reviewer would have organized it differently — only flag inconsistencies with the project's own pattern.
- Generated code (Room, Hilt, Retrofit Moshi codegen) locations follow the generator; never flag placement.
