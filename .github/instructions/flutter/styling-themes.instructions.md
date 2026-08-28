---
description: "Use when a Flutter change styles UI: colors, typography, spacing, theme setup, or dark/light variants. Enforces use of the project's existing theme system over hardcoded values."
applyTo: "**/lib/**/*.dart"
---

# Styling & Theming (Flutter)

## Scope

Applies to visual styling: colors, text styles, spacing, shape, and theme configuration (`ThemeData`, extensions, design tokens).

## Review rules

1. **Use the project's theme system.** Colors/text styles/spacing come from `Theme.of(context)`, `ColorScheme`, `TextTheme`, or the project's custom tokens/extensions — not from ad-hoc literals in widgets.
2. **Hardcoded values are findings when reusable tokens exist**: `Color(0xFF123456)` in a widget while `colorScheme.primary` (or a project token) matches is a finding. Hex literals are acceptable only inside token/theme definition files.
3. **Dark/light mode consistency where supported**: if the app defines both themes, new colors/styles must resolve correctly in both — flag literals that will be invisible/wrong in the other mode, and theme definitions missing the new token.
4. **Typography through `TextTheme` roles** (`titleMedium`, `bodyLarge`...) rather than one-off `TextStyle(fontSize: 14)` copies, where the project styles this way.
5. **Spacing/sizing follows the project's scale** (constant classes, extensions, or consistent multiples) — not arbitrary per-widget magic numbers.
6. **Component themes**: project-wide widget appearance (buttons, inputs, app bars) belongs in theme configuration, not per-widget overrides repeated everywhere.

## Positive recommendations

- Prefer `ThemeExtension`/design-token classes for custom design attributes when the project already uses them.
- Prefer `ColorScheme.fromSeed`-consistent additions for Material 3 apps; custom brand palettes belong where the project already defines them.

## Anti-patterns to flag

```dart
// BAD — hardcoded brand color in a widget
containerColor: Color(0xFF008C98)

// BAD — one-off text style duplicating a theme role
style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)

// BAD — style that breaks in dark mode
color: Colors.black // on theme-dependent background

// BAD — new token added to light theme only
```

## Preserve existing conventions

- If the project deliberately uses direct constants (no theme layer), review consistency with its existing constants rather than demanding a theme system.
- Theme definition files are exempt from "hardcoded value" findings — they are the source of truth.
