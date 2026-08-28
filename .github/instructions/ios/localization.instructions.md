---
description: "Use when an iOS change adds user-facing text or touches localization resources. Enforces use of the project's existing localization mechanism and RTL correctness. Apply only to code or resources containing user-facing text."
applyTo: "**/*.swift,**/*.strings,**/*.stringsdict,**/*.xcstrings"
---

# iOS Localization

## Scope

Applies to user-visible strings and localization resources in iOS apps (SwiftUI and UIKit). Apply only when the change adds or renders user-facing text, or edits `.strings`/`.stringsdict`/`.xcstrings` files. Projects shipping a single language intentionally are exempt from translation demands — flag only clearly future-breaking hardcoding as low severity.

## Review rules

1. **User-facing strings go through the project's localization mechanism** — String Catalogs (`.xcstrings`), legacy `.strings`/`.stringsdict`, or a third-party i18n layer the project uses. Do not assume String Catalogs; follow what the project actually has. A literal `Text("Welcome")` in a localized SwiftUI app is a finding.
2. **SwiftUI**: localized lookups via `Text("key")` resolved through the app's catalog, `String(localized:)`, or the project's helper — consistent with neighboring views. Not every `Text(_)` literal is wrong: `Text(verbatim:)` exists for genuinely non-localized display (numbers the app formats itself, symbols).
3. **UIKit**: `NSLocalizedString(_:tableName:bundle:value:comment:)` (or the project's wrapper) for labels, button titles, alerts. `comment:` parameters carry translator context where the project uses them.
4. **Key parity**: every new key exists in all supported locales, with the same argument placeholders. Missing translations are a finding (or routed to the project's documented fallback policy).
5. **Pluralization** uses the platform's facilities — stringsdict plural rules, or String Catalog's built-in variations — not `count == 1 ? ... : ...` branching where the project supports plurals.
6. **Formatted strings use positional placeholders** (`String(format: NSLocalizedString("greeting", comment: ""), name)`) and localized formatters (`NumberFormatter`, `DateFormatter`, `MeasurementFormatter`) — not string concatenation, which breaks word order across languages.
7. **RTL**: layout uses leading/trailing (or SwiftUI's default directional alignment) rather than left/right where the app supports RTL locales; directional icons flip (`imageFlipsForRightToLeftLayoutDirection` / SF Symbols directional variants).
8. **Accessibility labels are localized too** — `accessibilityLabel` values come from the same localization mechanism, and every interactive control still needs one regardless of language.
9. **Non-UI strings don't need translation**: log messages, analytics event names, route identifiers, technical constants.

## Positive recommendations

- Reuse existing keys for repeated concepts before adding duplicates.
- Prefer interpolation placeholders over concatenation so translators can reorder sentences.

## Anti-patterns to flag

```swift
// BAD — hardcoded user-facing string in a localized app
Text("Welcome back")

// BAD — concatenation instead of placeholders
Text(NSLocalizedString("hello", comment: "") + " " + name + NSLocalizedString("thanks", comment: ""))

// BAD — key added to the base locale only

// BAD — plural branching
Text(itemCount == 1 ? "1 item" : "\(itemCount) items")
```

## Preserve existing conventions

- Key naming follows the project's existing scheme (dot-namespaced, camelCase, raw sentences — whatever exists).
- Do not demand migration between `.strings` and String Catalogs in a feature PR.
