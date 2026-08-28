---
description: "Use when an Android XML change styles UI: colors, dimensions, styles/themes, text appearances, or drawable resources. Enforces resource reuse and theme consistency. Apply only to View-based (XML) Android code."
applyTo: "**/res/values/*.xml,**/res/values-*/**/*.xml,**/res/drawable/*.xml,**/res/layout/*.xml"
---

# XML Styling & Theming

## Scope

Applies to visual styling in View-based (XML) Android code: color/dimension resources, styles and themes, text appearances, and drawables. Apply only to XML-based UI code — the layout glob exists so styled attributes in layouts are covered; Compose code is out of scope.

## Hard rules

1. **Colors and dimensions come from resources**: `@color/...`, `@dimen/...`, `@style/...` — inline hex (`#008C98`) or magic `dp`/`sp` values in layouts and styles are findings when matching resources exist. Theme-definition files (`colors.xml`, `themes.xml`) are the token source and are exempt from the literal rule.
2. **Dark theme parity**: a new color/text-style resource added to `values/` must resolve correctly in `values-night/` (or via theme attributes) where the app supports dark themes. One-sided additions are findings; literals like `#FFFFFF` on themed surfaces are findings in both modes.
3. **Text sizes in `sp`** (never `dp`) and typography through `TextAppearance` styles the project defines — per-view `android:textSize` copies of an existing style are findings.

## Review rules

- **Theme attributes over fixed values**: `?attr/colorPrimary`, `?android:attr/textAppearanceBodyMedium` (or the app's own attrs) where the project styles this way — hardcoded palette values in themed UI are findings.
- **Styles/themes follow the project's hierarchy**: new styles go where the project keeps them (`styles.xml`, `themes.xml`, per-feature style files) and inherit from the project's parents — not from one-off root styles.
- **Material integration follows the project**: do not force Material 3, Material Components, or AppCompat — use whatever theme parent the app already extends, and flag mixed-theme misuse (e.g. AppCompat widgets inside a Material3 theme when the project avoids it).
- **Drawable reuse**: repeated inline drawables/shape XMLs promoted to `res/drawable` resources; a drawable duplicated across layouts with identical attributes is a finding.
- **Accessibility through styling**: text contrast against themed backgrounds stays readable in both modes; touch-target sizes preserved by style changes (`android:minHeight` etc.); content sizing not broken by fixed heights around `sp` text.
- **Resource churn**: unused new resources, or theme-attribute renames without consumer updates, are findings.

## Positive recommendations

- Prefer theme attributes and existing styles before defining new ones; add a token to the theme files (in both modes) before using a literal.
- Keep drawable naming consistent with the project's scheme (`bg_`, `ic_`, `shape_` — as established).

## Anti-patterns to flag

```xml
<!-- BAD — hardcoded palette value where a token exists -->
<TextView android:textColor="#008C98" ... />

<!-- BAD — text size in dp -->
android:textSize="14dp"

<!-- BAD — style copied inline instead of reused -->
android:background="#FFF4F4F4" android:elevation="4dp" ... <!-- repeated in N layouts -->
```

## Preserve existing conventions

- If the project deliberately keeps values in a single constants file instead of splitting per-qualifier, review consistency with it — don't demand a restructuring.
- Theme/token definition files define the tokens: literals there are correct by design; wrong per-theme values (contrast, missing dark variant) are still valid findings.
