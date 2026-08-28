---
description: "Use when writing or reviewing any Kotlin code. Enforces language-level best practices: null safety, coroutines-ready typing, naming, and Kotlin idioms."
applyTo: "**/*.kt,**/*.kts"
---

# Kotlin Language Rules

## Scope

Applies to every `.kt`/`.kts` file in the change: language-level quality only (Compose/XML concerns live in their own files under this platform).

## Hard rules

1. **Null safety is deliberate**: `?.`/`?:` preferred; `!!` only where the value is provably non-null (and prefer proving it with `let`, `takeIf`, or checks). `!!` on platform/API values is a finding.
2. **`lateinit` requires proof of initialization before first read** (framework-injected fields, lifecycle-guaranteed init). Prefer nullable + check when the proof is non-obvious.
3. **No silent catches** — `catch (e: Exception) {}` hides failures.
4. **No `GlobalScope`** — structured concurrency only (`viewModelScope`, `lifecycleScope`, custom scopes) when coroutines are used.
5. **No platform-type leakage**: values from Java APIs (`String!`) are typed at the boundary (declared nullable or non-null with a check), not propagated raw.

## Review rules

- Naming follows Kotlin conventions: `PascalCase` types, `camelCase` members, no `Hungarian` prefixes; constants `SCREAMING_SNAKE_CASE` in `companion object`.
- Prefer `val` over `var`; prefer immutable collections (`List`/`Map` via `listOf`/`buildList`) for read-only exposure.
- Data classes for models; sealed classes/interfaces for finite state hierarchies; enums for fixed constant sets (vs stringly-typed flags).
- Use scope functions idiomatically (`let`/`apply`/`also`/`run`/`with`) — not nested to the point of unreadability; don't demand their removal where they're clear.
- Extension functions for cross-type utilities instead of `Util` god-classes, consistent with project structure.
- Avoid `Any`/`Dynamic`-style losses; use generics and sealed hierarchies.
- `internal` visibility for module-internal APIs; `private` by default for members.

## Positive recommendations

- Prefer `@JvmStatic`/`@JvmOverloads` annotations where Java interop is intended (only when the project does).
- Use `kotlin.time.Duration`/`kotlinx.datetime` if the project already adopted them.

## Anti-patterns to flag

```kotlin
// BAD — crash-capable unwrap
val id = intent.getStringExtra("id")!!

// BAD — leaking platform types
fun parse(s: String) = s.trim() // s came from a Java API as String!

// BAD — silent catch
try { api.call() } catch (e: Exception) { }

// BAD — GlobalScope
GlobalScope.launch { sync() }
```

## Preserve existing conventions

- Follow the project's lint config (ktlint/detekt `.editorconfig`) as baseline; don't suggest `@Suppress` without justification.
- Don't flag legacy Java-interop patterns in untouched files.
