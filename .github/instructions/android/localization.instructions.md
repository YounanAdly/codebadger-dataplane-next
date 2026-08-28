---
description: "Use when an Android change adds user-facing text or touches string resources. Enforces string-resource usage, plural/formatted-string correctness, and RTL support for both XML views and Compose. Apply only to code or resources containing user-facing text."
applyTo: "**/res/values/*.xml,**/res/values-*/**/*.xml,**/*.kt,**/*.java"
---

# Android Localization

## Scope

Applies to user-visible strings and string resources in Android apps (XML views and Compose). Apply only when the change adds or renders user-facing text, or edits resource files. The Kotlin/Java globs are intentionally broad — apply the code rules here only when the change adds or displays text. Projects shipping a single language intentionally are exempt from translation demands; flag only clearly future-breaking hardcoding as low severity.

## Review rules

1. **User-facing text lives in string resources**: `res/values/strings.xml` (or the resource module the project uses). `android:text="Welcome"` or `Text("Welcome")` in a localized app is a finding.
2. **Follow the project's existing localization setup** — plain resources, a translations platform export, or a third-party i18n layer. Do not demand a different mechanism.
3. **Formatted strings use positional placeholders** (`<string name="greeting">Hello, %1$s</string>` + `getString(R.string.greeting, name)` / `stringResource(R.string.greeting, name)`) — never string concatenation, which breaks word order across languages.
4. **Plurals use `<plurals>` + `getQuantityString()`** (or Compose equivalents via formatted quantity strings) where counts are displayed — not `count == 1 ? ... : ...` branching.
5. **Locale parity**: a new key exists in the default `values/` and, where the project maintains other locales (`values-ar/`, `values-night/` for theme resources), in those files too. Missing translations are a finding (or routed to the project's fallback policy).
6. **RTL**: layouts and drawables use `start`/`end` (not `left`/`right`), `android:supportsRtl` respected, directional drawables `autoMirrored="true"` — where the app supports RTL locales.
7. **Accessibility text is localized**: `contentDescription`, hints, and error strings come from resources, not literals — and every interactive element still has one regardless of language.
8. **Text sizes in `sp`** so font-scale settings apply; numbers/dates/currencies formatted via locale-aware APIs (`NumberFormat`, `DateFormat`), not `toString()`.

## Positive recommendations

- Reuse existing keys for repeated concepts (OK/Cancel/Retry) before adding duplicates.
- Keep key naming consistent with the project's scheme (snake_case, dot-namespaced, camelCase — whatever exists).

## Anti-patterns to flag

```xml
<!-- BAD — hardcoded user-facing text -->
<TextView android:text="Welcome" />
```

```kotlin
// BAD — literal in Compose in a localized app
Text("Welcome back")

// BAD — concatenation instead of positional args
Text("Hello, " + name + ". Thanks for joining.")

// BAD — plural branching
text = if (count == 1) "1 item" else "$count items"
```

## Preserve existing conventions

- Resource qualifiers the project already ships (`values-night`, per-locale folders) must stay in sync with new resources — flag one-sided additions.
- Do not demand migration to any particular i18n library or translation platform.
