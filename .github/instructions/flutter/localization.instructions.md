---
description: "Use when a Flutter change adds user-facing text or touches localization resources. Enforces use of the project's existing localization system and RTL correctness."
applyTo: "**/*.arb,**/lib/**/*.dart,**/l10n.yaml"
---

# Localization (Flutter)

## Scope

Applies to user-visible strings and localization resources (ARB files, generated localizations, or any i18n package the project uses).

## Review rules

1. **No hardcoded user-facing strings** where the project uses localization. If `flutter_localizations`/`intl`/`easy_localization`/SLANG is configured, new strings go through it.
2. **Follow the existing localization system** — ARB + `gen_l10n`, `.tr()`/JSON catalogs, or generated typed keys. Do not introduce a second mechanism in one PR.
3. **Key parity**: every new key exists in **all** supported locales, with identical structure. Missing translations are a finding (or routed to the project's fallback policy if it defines one).
4. **Reuse existing keys** for repeated concepts (OK/Cancel/Retry) before adding duplicates.
5. **RTL support**: layouts mirrored via `Directionality`-aware widgets — prefer `EdgeInsetsDirectional`, `AlignmentDirectional`, logical properties over `left`/`right` when the app supports RTL locales; icons with directional meaning (back arrows) flip where appropriate.
6. **Pluralization/genders** use the localization system's facilities (`plural` ARB metadata) rather than manual `count == 1 ? ... : ...` where the project supports it.
7. **Dates, numbers, currencies** formatted through `intl` (or the project's formatter), not `toString()`.
8. **Non-UI strings don't need translation**: route paths, log messages, technical constants, analytics names.

## Positive recommendations

- Prefer interpolated placeholders with the localization system's syntax (`{count}` in ARB) over string concatenation, which breaks word order in other languages.
- Keep translations natural-language quality — machine-literal translations of new UI strings should at least be flagged for review.

## Anti-patterns to flag

```dart
// BAD — hardcoded UI string in a localized app
Text('Welcome back')

// BAD — concatenation instead of placeholders
Text('${'hello'.tr()} ${name} ${'thanks'.tr()}')

// BAD — missing locale entry (key added to en.arb only)

// BAD — RTL-breaking padding
padding: EdgeInsets.only(left: 16) // in an app that supports Arabic
```

## Preserve existing conventions

- Key naming follows the project's existing scheme (camelCase, dot-namespaced, SCREAMING_CASE — whatever exists).
- If the project intentionally ships a single locale, do not demand an i18n setup — but flag obviously future-breaking hardcoding only as a low-severity note.
