---
description: "Use when UIKit renders interactive or informative UI. Enforces accessibility labels, traits, Dynamic Type, and VoiceOver support."
applyTo: "**/*.swift"
---

# UIKit Accessibility

## Scope

Applies to any user-facing UIKit UI change (views, cells, controls).

## Review rules

1. **Accessibility identity**: `accessibilityLabel` on icon-only buttons/images-as-buttons; `isAccessibilityElement = true` on custom tappable views (a plain `UIView` with a gesture is invisible to VoiceOver by default).
2. **Traits**: `accessibilityTraits` set correctly (`.button` on custom buttons, `.selected`, `.header` on section titles).
3. **Composite cells/rows grouped**: set `accessibilityElements` or container semantics so a cell reads as one unit; order matches visual order.
4. **Dynamic Type**: labels use `UIFont` text styles (`preferredFont(forTextStyle:)`) or scaling custom fonts; fixed-height constraints around text that clip at larger sizes are a finding; `adjustsFontForContentSizeCategory = true` where the project sets it.
5. **Hit targets ≥ 44×44pt**; small controls get enlarged hit areas (`contentEdgeInsets` or expanded gesture frames).
6. **Value changes announced**: sliders/steppers/custom adjustable controls implement `accessibilityValue` and adjustable traits; async status updates posted via `UIAccessibility.post(.announcement, ...)`.
7. **Forms**: labels associated (`accessibilityLabel` or label-to-field pairing), `accessibilityHint` only when the label is insufficient (per project usage).
8. **Contrast**: text over images/gradients needs scrims or color tokens that maintain contrast in both appearances.

## Positive recommendations

- Prefer standard controls (`UIButton`, `UISwitch`, `UIStackView` layouts) — they inherit correct behavior.
- Apply the checks above statically to the diff: labels, traits, Dynamic Type, hit targets. Accessibility Inspector / a VoiceOver run-through are optional manual validation, not a prerequisite for flagging.

## Anti-patterns to flag

```swift
// BAD — invisible custom button
let tappable = UIView(); tappable.addGestureRecognizer(UITapGestureRecognizer...) // no a11y element

// BAD — icon-only button without label
button.setImage(UIImage(systemName: "xmark"), for: .normal) // no accessibilityLabel

// BAD — fixed text height
label.heightAnchor.constraint(equalToConstant: 20).isActive = true // clips Dynamic Type
```

## Preserve existing conventions

- Follow the project's existing labeling/localization mechanism for labels and hints.
