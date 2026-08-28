---
description: "Use when an Android change adds, upgrades, or removes libraries in gradle files or version catalogs. Enforces justified dependencies with attention to maintenance and compatibility."
applyTo: "**/build.gradle*,**/libs.versions.toml,**/gradle/libs.versions.toml,**/dependencies.kts"
---

# Dependencies (Android)

## Scope

Applies to gradle dependency changes: `build.gradle(.kts)`, version catalogs (`libs.versions.toml`), and BOM updates.

## Review rules

1. **Every new dependency needs a justification.** Flag trivial additions that the platform or existing libs already cover (one toast helper, one tiny utility, a whole library for one function).
2. **Duplicate purpose is a finding**: two image loaders (Glide+Coil), two DI frameworks (Hilt+Koin), two networking stacks coexisting without strong justification.
3. **Maintenance health**: actively maintained, compatible with the project's min/target SDK and Kotlin version. Flag archived/unmaintained packages for new adoption.
4. **Version changes follow the project's constraint style** (version catalog entries, BOM-managed, or direct pins — whatever exists); upgrades forcing compileSdk/Kotlin bumps are flagged with affected modules named.
5. **KAPT vs KSP**: new annotation processors use the processor style the project standardizes on (KSP where adopted); adding kapt where the project moved to KSP is a finding.
6. **Release/dependency hygiene**: `debugImplementation`-only tools (leakcanary, StrictMode helpers) stay debug-scoped; no test framework leaking into release classpaths.

## Positive recommendations

- Prefer AndroidX/Google-first libraries where adequate; Jetpack libraries for lifecycle/paging/navigation per the project's existing adoption level.
- When removing a library, check for leftover imports/manifest merge residues and document the replacement.

## Anti-patterns to flag

```kotlin
// BAD — duplicate purpose
implementation("io.coil-kt:coil:2.6.0")   // project already uses Glide everywhere
implementation("com.github.bumptech.glide:glide:4.16.0")

// BAD — heavyweight lib for one utility
implementation("com.fasterxml.jackson.core:jackson-databind") // org.json/kotlinx.serialization exists

// BAD — debug tool in release
implementation("com.squareup.leakcanary:leakcanary-android") // should be debugImplementation
```

## Preserve existing conventions

- Don't suggest replacing a working dependency with a more popular one without a concrete deficiency.
- Lockfile/`gradle-wrapper` churn unrelated to the change is flagged, not blocked.
