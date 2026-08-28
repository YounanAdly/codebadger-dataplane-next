---
description: "Use when Android XML layouts (ConstraintLayout, LinearLayout, include/merge) are created or modified. Enforces layout quality, efficiency, and reuse."
applyTo: "**/res/layout/*.xml,**/res/layout-*/**/*.xml"
---

# XML Layouts

## Scope

Applies to `res/layout/**` XML files. Apply only to View-based (XML) Android code.

## Review rules

1. **No hardcoded pixel values in layouts**: dimensions come from `@dimen`/`@dimen` tokens (` dimens.xml`) — `android:layout_marginStart="13dp"` magic numbers are findings when a dimension resource exists or neighbors use tokens.
2. **ConstraintLayout consistency**: where the project uses ConstraintLayout, nested `LinearLayout` towers with weights inside it are findings (and vice versa — don't demand ConstraintLayout in LinearLayout projects).
3. **Accessibility in XML**: `android:contentDescription` on ImageButtons/ImageViews (or `tools:ignore="ContentDescription"` only for verified decorative images with justification); `android:importantForAccessibility`; `labelFor` on text inputs.
4. **`tools:` vs runtime attributes**: `tools:text` for preview-only content — never `android:text` with preview strings that ship (hardcoded user-facing text; use string resources).
5. **Repetition → `<include>`/styles**: identical subtrees repeated across layouts become includes or styleable components, consistent with the project's reuse pattern.
6. **`<merge>` in included root FrameLayouts** where the project uses it to avoid useless nesting.
7. **Strings/arrays live in resources** (`@string/...`), colors in `@color/...`, drawables referenced — no inline literals where resources exist.
8. **Deprecated attributes/widgets** flagged when the project already migrated (e.g. `android:onClick` where project binds via ViewModel, `ListView` where RecyclerView is standard).

## Positive recommendations

- Prefer `ConstraintLayout`/`LinearLayout` choices matching neighboring screens; use `Guideline`/`Barrier` for alignment where the project does.
- Keep layout file naming consistent (`fragment_x`, `item_x`, `view_x`) with the project's scheme.

## Anti-patterns to flag

```xml
<!-- BAD — hardcoded preview text shipping -->
<TextView android:text="Welcome" />          <!-- @string instead -->

<!-- BAD — magic dimension while dimen tokens exist -->
android:layout_marginStart="13dp"

<!-- BAD — decorative image without ignore or description -->
<ImageView android:src="@drawable/divider" />
```

## Preserve existing conventions

- Match the existing indentation/attribute-ordering style of the layout files being edited.
- Legacy layouts in untouched files are not findings.
