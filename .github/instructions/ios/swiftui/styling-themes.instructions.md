---
description: "Use when SwiftUI code styles UI: colors, fonts, spacing, dark mode. Enforces theme/token usage over hardcoded values."
applyTo: "**/*.swift"
---

# SwiftUI Styling & Theming

## Scope

Applies to visual styling in SwiftUI code: colors, typography, spacing, appearance, and dark/light consistency.

## Review rules

1. **Colors come from Assets/`Color` extensions/`ColorScheme`** — the project's token source — not from `Color(red:...)`/hex literals scattered in views. Hex literals belong only in the token definition layer.
2. **Dark mode consistency**: semantic/dynamic colors (asset catalog with Any/Dark appearances, or `UIColor { trait in }` bridges) over fixed colors that break in one mode. `Color.black`/`.white` hardcoded on themed surfaces is a finding where the app supports dark mode.
3. **Typography via text styles/custom font tokens**: `.font(.headline)` or the project's font extension — not per-view `Font.system(size:)` copies when a token exists.
4. **Spacing follows the project's scale** (constants/extensions) rather than arbitrary per-view padding numbers.
5. **Reusable styles extracted** where the project extracts them: `ButtonStyle`, `LabelStyle`, `ViewModifier` libraries — repeated identical modifier chains across views are a finding when a style exists.
6. **App-wide appearance** (tint, backgrounds, navigation appearance) belongs in the app's theme entry point, not re-applied per screen.

## Positive recommendations

- Prefer `Color(uiColor: .label)`-style semantic colors or asset-catalog colors for adaptive rendering.
- Use `.preferredColorScheme` only where the project deliberately overrides (e.g. modal themes), not to "fix" contrast locally.

## Anti-patterns to flag

```swift
// BAD — brand color literal in a view
.foregroundColor(Color(red: 0, green: 0.55, blue: 0.6))

// BAD — breaks dark mode
.background(Color.white)

// BAD — font token duplication
.font(Font.system(size: 17, weight: .semibold)) // .headline exists
```

## Preserve existing conventions

- If the project deliberately keeps a constants file instead of asset colors, review consistency with that file — don't demand an asset-catalog migration.
- Theme/token definition files are exempt from hardcoded-value findings — they define the tokens.
