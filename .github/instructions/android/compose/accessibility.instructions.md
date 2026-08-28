---
description: "Use when Compose renders interactive or informative UI. Enforces content descriptions, touch targets, semantic properties, and TalkBack support."
applyTo: "**/*.kt"
---

# Compose Accessibility

## Scope

Applies to any user-facing Compose UI change. Apply only to files using Compose APIs.

## Review rules

1. **Interactive elements have content descriptions**: `contentDescription` on `Icon`-only `IconButton`s; `null` (with `semantics { invisibleToUser() }` or `clearAndSetSemantics` where needed) only for decorative imagery.
2. **`Modifier.semantics` for custom controls**: custom tappables expose `role = Role.Button` (etc.), state via `toggleableState`/`selected`; custom sliders expose `progressBarRangeInfo`/`selectableGroup` patterns per the project.
3. **Touch targets ≥ 48dp**: `minimumInteractiveComponentSize` respected — small visuals with padded tap areas; shrunken Material defaults via hacks are a finding.
4. **Composite rows/cards read as one element**: `Modifier.clearAndSetSemantics`/`semantics(mergeDescendants = true)` where the project merges; visual order vs. TalkBack order corrected with `semantics { traversalIndex }` when needed.
5. **Text scaling**: no fixed heights clipping at large font scales (`sp`-driven layouts); `FontScale` behavior preserved.
6. **State communicated**: selected/disabled/loading states via `stateDescription`/`selected` semantics so TalkBack announces them.
7. **Announcements**: async status changes the user must hear mark their composable with semantics `liveRegion = LiveRegionMode.Polite` (or `Assertive`) per the project's pattern.

## Positive recommendations

- Prefer Material components with built-in semantics (`Checkbox`, `Switch`, `ListItem`).
- Apply the checks above statically to the diff: descriptions, roles, merge semantics, touch targets. Accessibility Scanner / a TalkBack run-through are optional manual validation, not a prerequisite for flagging.

## Anti-patterns to flag

```kotlin
// BAD — icon-only button without description
IconButton(onClick = close) { Icon(Icons.Default.Close, contentDescription = null) }

// BAD — decorative image announced
Image(painter, contentDescription = "decorative line") // null + hidden instead

// BAD — custom control invisible to TalkBack
Box(Modifier.clickable { }) // no role/semantics
```

## Preserve existing conventions

- Content descriptions follow the project's string resources (see platform conventions); don't demand literals where resources are the pattern.
