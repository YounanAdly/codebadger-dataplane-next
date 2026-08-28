---
description: "Use when UIKit styles UI: colors, fonts, appearance, dark mode. Enforces token/asset usage over hardcoded values."
applyTo: "**/*.swift"
---

# UIKit Styling & Theming

## Scope

Applies to visual styling in UIKit code: colors, fonts, `UIAppearance`, dark/light appearance.

## Review rules

1. **Colors from asset catalog / named colors / semantic UIColors** the project defines — not `UIColor(red:...)` literals in feature code. Hex/RGB literals belong only in the token definition layer.
2. **Dark mode consistency**: dynamic colors (`init(named:in:compatibleWith:)`, asset Any/Dark variants, `UIColor { trait in }`) over fixed colors; `UIColor.white`/`.black` on themed surfaces is a finding where dark mode is supported.
3. **Typography via `UIFont` text styles** (`preferredFont(forTextStyle:)`) or the project's font constants — per-call `UIFont.systemFont(ofSize:)` copies of an existing token are a finding.
4. **`UIAppearance`/app-wide styling centralized**: button/nav/tab appearance set in the theme entry point the project owns — not re-styled per screen.
5. **Spacing/size constants** follow the project's scale; arbitrary per-view magic numbers flagged when tokens exist.
6. **Cell/section chrome** (backgrounds, separators) uses the project's styling helpers instead of bespoke per-cell overrides.

## Positive recommendations

- Prefer semantic system colors (`.label`, `.systemBackground`, `.separator`) where the project uses them — they adapt to appearance and accessibility settings automatically.
- Keep style helpers (`make themed button`) consistent with existing helpers rather than adding parallel style systems.

## Anti-patterns to flag

```swift
// BAD — brand color literal
view.backgroundColor = UIColor(red: 0, green: 0.55, blue: 0.6, alpha: 1)

// BAD — breaks dark mode
label.textColor = .black

// BAD — token duplication
let f = UIFont.systemFont(ofSize: 17, weight: .semibold) // .headline exists
```

## Preserve existing conventions

- If the project keeps colors in a constants file instead of assets, review consistency with it — don't demand an asset migration.
- Token/theme definition files are exempt from hardcoded-value findings.
