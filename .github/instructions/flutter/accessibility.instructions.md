---
description: "Use when a Flutter change renders interactive or informative UI. Enforces Semantics-based accessibility: labels, touch targets, focus, and screen-reader support."
applyTo: "**/lib/**/*.dart"
---

# Accessibility (Flutter)

## Scope

Applies to any user-facing UI change.

## Review rules

1. **Semantics for interactive elements**: `IconButton`, `GestureDetector`, `InkWell` wrapping only images or icons must expose a meaningful label — `tooltip`, `Semantics(label:)`, or `Semantics(button: true, label:)`. A tappable icon with no semantic label is a finding.
2. **Touch targets meet the design system's minimum**: 48×48 logical pixels for Material apps; 44×44pt for apps following iOS/HIG sizing (e.g. Cupertino components). Shrink-wrapped small buttons need `minimumSize`/padding or `ConstrainedBox` to reach the applicable minimum — apply the one the app's design system actually uses.
3. **Screen-reader order and grouping**: use `Semantics(container: true)` / `MergeSemantics` for composite cards so a tile reads as one unit instead of scattered labels; use `ExcludeSemantics`/`semanticLabel` on decorative images (`Image.asset(..., semanticLabel: null)` + excluded) so decoration is not announced.
4. **Images**: meaningful images get `semanticLabel` or wrapping `Semantics`; decorative images get none and are excluded.
5. **Text scaling**: no fixed heights on text containers that clip at large font scales; test layouts at larger `textScaleFactor` where feasible.
6. **Contrast**: text on colored surfaces/overlays must maintain readable contrast — flag new color pairs with obvious low contrast.
7. **Focus traversal**: custom focusable widgets (via `FocusableActionDetector`/`Focus`) integrate with keyboard/switch access; dialogs move focus in and restore on close.
8. **Form fields** expose labels (`InputDecoration.labelText`) and error text (`errorText`) so screen readers announce them.

## Positive recommendations

- Prefer framework widgets with built-in semantics (`ListTile`, `CheckboxListTile`, `PopupMenuButton`) over gesture-detector assemblies.
- Use `Semantics(liveRegion: true)` for async status messages the user must know about (screen readers announce live-region changes automatically).

## Anti-patterns to flag

```dart
// BAD — icon-only button without label
IconButton(icon: Icon(Icons.close), onPressed: close)

// BAD — GestureDetector on an image only
GestureDetector(onTap: open, child: Image.asset('banner.png'))

// BAD — decorative image announced to screen readers
Image.asset('divider.png') // fix: wrap in ExcludeSemantics or omit semanticLabel

// BAD — 24px tap target
SizedBox(height: 24, width: 24, child: GestureDetector(...))
```

## Preserve existing conventions

- Match the project's existing labeling approach (translation keys via the localization system).
