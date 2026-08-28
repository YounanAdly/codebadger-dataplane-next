---
description: "Use when Android custom Views, drawables, or view XML attributes are created or modified. Enforces view correctness, state handling, and reuse."
applyTo: "**/res/values/attrs.xml,**/res/drawable/*.xml,**/*.kt"
---

# XML Views & Custom Views

## Scope

Applies to custom `View`/`ViewGroup` subclasses backing XML layouts, `attrs.xml` declarations, and drawable XML. Apply only to View-based (XML) Android code: the `**/*.kt` glob is intentionally broad — apply the Kotlin rules here only when the Kotlin change constructs, inflates, or customizes XML-defined views, not to Compose code.

## Review rules

1. **Constructor chain complete**: custom views implement the constructor set the project implements (typically `(Context, AttributeSet?)` at minimum) so XML inflation doesn't crash.
2. **`attrs.xml` styled attributes declared and read correctly**: `obtainStyledAttributes` paired with `recycle()`; attribute names/namespaces consistent with existing declarations.
3. **View state saved/restored** where the project saves it: `onSaveInstanceState`/`Parcelable` state (or `savedState`) for stateful custom views.
4. **Drawable XML quality**: repeated inline drawables promoted to resources; vector drawables sized/mirrored for RTL (`autoMirrored="true"`) when directional and the app supports RTL.
5. **`onDraw`/`onMeasure` hygiene**: no allocations in `onDraw`; `super` calls present; `invalidate()`-driven redraws correct.
6. **Accessibility on custom views**: `android:contentDescription` equivalents (`contentDescription` property), `importantForAccessibility`, clickable custom views expose class/role correctly.
7. **Resources referenced, not inlined**: colors/dimensions from resources — no `setColor(Color.parseColor("#..."))` literals in view code when tokens exist.

## Positive recommendations

- Prefer platform widgets + styles over custom subclasses when customization is achievable via XML attributes/styles.
- Keep custom view APIs consistent with existing ones (configuration via attributes, not public mutable fields scattered everywhere).

## Anti-patterns to flag

```kotlin
// BAD — attributes obtained but never recycled
val a = context.obtainStyledAttributes(attrs, R.styleable.Badge); text = a.getString(0)

// BAD — allocation per draw
override fun onDraw(c: Canvas) { val p = Paint() /* every frame */ }

// BAD — hardcoded color while token exists
paint.color = Color.parseColor("#008C98")
```

## Preserve existing conventions

- Follow the project's existing custom-view base classes and attribute naming (`app:cbXxx`-style prefixes as established).
