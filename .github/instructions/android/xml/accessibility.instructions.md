---
description: "Use when View-based Android UI renders interactive or informative elements. Enforces content descriptions, touch targets, labels, and TalkBack support."
applyTo: "**/res/layout/*.xml,**/res/values/*.xml,**/*.kt"
---

# XML Accessibility

## Scope

Applies to any user-facing View-based (XML) Android UI change.

## Review rules

1. **`contentDescription` on meaningful images**: `ImageView`, `ImageButton`, `FloatingActionButton` get descriptions from string resources — or `@null`/`importantForAccessibility="no"` for verified decorative images (with the pair applied deliberately, not silently).
2. **Touch targets ≥ 48dp×48dp**: `android:minWidth`/`minHeight` or padding; shrunken icon buttons without enlarged touch areas are findings.
3. **Form fields labeled**: `TextView` with `android:labelFor` pointing at the input; `TextInputLayout` hints used where the project uses them; errors announced (`accessibilityLiveRegion` where the project sets it).
4. **Custom clickable views expose accessibility**: `android:clickable` custom views need `contentDescription`/role equivalents in code (`AccessibilityDelegate`, `AccessibilityNodeInfo` actions) — invisible-to-TalkBack custom buttons are findings.
5. **Headings for structure**: section titles use `android:accessibilityHeading="true"` where the project marks them.
6. **Live regions for dynamic content**: status/count updates use `android:accessibilityLiveRegion="polite|assertive"` consistent with project usage.
7. **Text sizes use `sp`** (never `dp` for text) and respect the project's typography scale.
8. **Contrast**: text over images/gradients keeps readable contrast in both light/dark themes where the app supports them.

## Positive recommendations

- Prefer standard widgets (`Button`, `Checkbox`, `SwitchCompat`) — they inherit correct TalkBack behavior.
- Apply the checks above statically to the diff: descriptions, labels, touch targets, `sp` text. Accessibility Scanner / a TalkBack run-through are optional manual validation, not a prerequisite for flagging.

## Anti-patterns to flag

```xml
<!-- BAD — icon-only button without description -->
<ImageButton android:src="@drawable/ic_close" />

<!-- BAD — decorative image with empty description but still focusable -->
<ImageView android:src="@drawable/divider" android:contentDescription="" />
<!-- → use android:importantForAccessibility="no" -->

<!-- BAD — text sized in dp -->
<TextView android:textSize="14dp" />
```

## Preserve existing conventions

- Descriptions come from string resources per the project's localization setup — flag literals where the project localizes.
