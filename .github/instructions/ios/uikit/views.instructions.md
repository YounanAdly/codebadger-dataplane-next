---
description: "Use when UIKit views (UIView subclasses, programmatic or XIB layouts) are created or modified. Enforces view construction, Auto Layout, and reuse quality."
applyTo: "**/*.swift"
---

# UIKit Views

## Scope

Applies to `UIView`/`UITableViewCell`/`UICollectionViewCell` subclasses, XIB/storyboard changes, and programmatic layouts. Apply only to UIKit-based code.

## Review rules

1. **Programmatic layout setup happens once and correctly**: `translatesAutoresizingMaskIntoConstraints = false` on programmatically added subviews; subviews added and constrained in `init`/setup helpers, not in `layoutSubviews`.
2. **Cell reuse is correct**: cells configure content in `prepareForReuse`-safe ways — no per-`cellForRowAt` view construction, observers, or `addTarget` stacking.
3. **Auto Layout quality**: ambiguous constraints, conflicting-constraint-prone patterns (translating masks + explicit constraints on the same view), and magic internal `layoutIfNeeded` calls are findings; prefer explicit anchors consistent with the project.
4. **XIB/storyboard changes**: outlets/actions wired deliberately; removed UI removes its outlets; no duplicate constraint sets after edits; module/class names still resolve (renamed classes break IB).
5. **Composition**: extract reusable custom views instead of copy-pasting UI construction blocks that appear in multiple files.
6. **`layoutSubviews` hygiene**: no side effects (network, state mutation) inside; call `super`.
7. **Content-based sizing**: `UIStackView`/intrinsic content size preferred over hard-coded frames for adaptive content.

## Positive recommendations

- Prefer `UIContentUnavailableConfiguration`/`UIListContentConfiguration` where the project adopts modern cell styles.
- Keep view subclasses dumb: content goes in via configuration methods (`configure(with:)`), matching the project's style.

## Anti-patterns to flag

```swift
// BAD — frame-based positioning inside an autolayout project
label.frame = CGRect(x: 0, y: 0, width: 100, height: 20)

// BAD — per-reuse setup
override func cellForRow(...) -> UITableViewCell {
  let cell = ...;
  cell.button.addTarget(self, ...) // stacking targets per reuse
}

// BAD — layoutSubviews side effects
override func layoutSubviews() { loadData() }
```

## Preserve existing conventions

- Mixed codebases may legitimately contain both storyboard and programmatic screens — new code follows the pattern of the files it touches.
