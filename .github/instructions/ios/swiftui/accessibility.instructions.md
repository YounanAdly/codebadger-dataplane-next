---
description: "Use when SwiftUI renders interactive or informative UI. Enforces accessibility labels, dynamic type, hit targets, and VoiceOver-friendly composition."
applyTo: "**/*.swift"
---

# SwiftUI Accessibility

## Scope

Applies to any user-facing SwiftUI UI change.

## Review rules

1. **Interactive elements have labels**: icon-only `Button`s need `.accessibilityLabel`; decorative images get `.accessibilityHidden(true)`; meaningful images get labels.
2. **Dynamic Type**: text uses semantic fonts (`.font(.body)`, `.title`) or scaling custom fonts (`Font.custom(_:size:relativeTo:)`) — fixed frame heights around text that clip at large sizes are a finding.
3. **Hit targets ≥ 44×44pt**: small controls get padded tap areas (`.frame(minWidth:minHeight:)` or content shape).
4. **Grouping/composite elements**: cards/rows read as one element (`accessibilityElement(children: .combine)` or `.containment`) rather than scattered labels; sort order corrected with `.accessibilitySortPriority` when needed.
5. **Traits**: `.isButton`, `.isSelected`, `.isHeader` communicated via `.accessibilityAddTraits` where custom controls emulate standard ones.
6. **Announcements**: async status changes that must be heard are posted via `UIAccessibility.post(.announcement, argument: ...)` (gate with `UIAccessibility.isVoiceOverRunning` when the update fires frequently), or through the announcement pattern the project already has.
7. **Custom controls keep standard behavior**: custom toggles/sliders expose `.accessibilityValue` and adjustable traits, or better — use standard `Toggle`/`Slider`.
8. **Contrast**: foreground/background pairs must remain readable in both light/dark where the app supports them.

## Positive recommendations

- Prefer standard components (`List`, `Button`, `Toggle`, `Form`) — they inherit accessibility for free.
- Apply the checks above statically to the diff: labels present, traits set, Dynamic Type safe, hit targets met. Accessibility Inspector / Xcode's accessibility audit are optional manual validation, not a prerequisite for flagging.

## Anti-patterns to flag

```swift
// BAD — icon-only button
Button { close() } label: { Image(systemName: "xmark") } // no label

// BAD — decorative image announced
Image("sparkle").resizable().frame(200)

// BAD — fixed text height
Text(body).frame(height: 40) // clips at large Dynamic Type
```

## Preserve existing conventions

- Labels follow the project's localization system (see platform localization conventions); don't demand string-literal labels where keys are the project pattern.
