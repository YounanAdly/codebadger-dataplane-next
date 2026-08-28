---
description: "Use when Compose code styles UI: MaterialTheme, colors, typography, shapes, dark mode. Enforces theme/token usage over hardcoded values."
applyTo: "**/*.kt"
---

# Compose Styling & Theming

## Scope

Applies to visual styling in Compose code: `MaterialTheme`, color schemes, typography, shapes. Apply only to files using Compose APIs.

## Review rules

1. **Colors from the theme**: `MaterialTheme.colorScheme.*` or the project's custom token object — `Color(0xFF...)` literals in composables are findings when tokens exist. Literals belong only in the theme definition files.
2. **Dark/light consistency**: if the app defines both color schemes, new colors resolve correctly in both; token definitions added to one scheme only are a finding.
3. **Typography via `MaterialTheme.typography`** or project font tokens — per-composable `TextStyle(fontSize = 16.sp)` copies of an existing role are findings.
4. **Shapes/elevation via `MaterialTheme.shapes`** and elevation tokens where the project styles this way.
5. **Reusable styles extracted**: repeated `Modifier`-style blocks (card look, chip look) become project composables/Modifier extensions where the project keeps them.
6. **Hardcoded sizes follow the project's spacing scale** (constants/dimension tokens) rather than arbitrary `dp` magic numbers.
7. **App-level theme changes** (dynamic color, status bar appearance) belong in the theme entry point, not per-screen overrides.

## Positive recommendations

- Prefer `MaterialTheme.colorScheme`-derived colors (`.copy(alpha:)` is fine) over introducing parallel palettes.
- Keep `CompositionLocal`-based custom tokens where the project already uses them.

## Anti-patterns to flag

```kotlin
// BAD — brand color literal
Surface(color = Color(0xFF008C98))

// BAD — token duplication
Text(style = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold)) // titleMedium exists

// BAD — token added to light scheme only
```

## Preserve existing conventions

- Theme definition files are exempt from hardcoded-value findings — they define the tokens.
- If the project maintains a custom design system object instead of MaterialTheme, review consistency with it.
