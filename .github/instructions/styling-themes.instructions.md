---
description: "Use when writing or editing SCSS, component styles, theme files, or anything visual. Enforces design tokens, theme variables, and RTL-safe layout."
applyTo: "src/**/*.scss"
---

# Styling & Theming

## Hard Rule: No Hardcoded Design Values

Never inline a hex color, rgba, or theme-sensitive value in a **component SCSS**. Use CSS variables from the theme files:

- [_light-theme.scss](../../src/styles/themes/_light-theme.scss)
- [_dark-theme.scss](../../src/styles/themes/_dark-theme.scss)
- [_green-theme.scss](../../src/styles/themes/_green-theme.scss)

```scss
/* GOOD */
color: var(--color-body-text);
background: var(--color-section-soft-bg);

/* BAD */
color: #2b2b2b;
background: #ebf6f7;
```

## Theme Source Files (Exempt from the Hardcoded-Color Rule)

The three theme files above are the **source of truth** for every design token — they DEFINE what `var(--color-*)`, `var(--radius-*)`, `var(--transition-*)`, and `var(--skeleton-*)` mean per theme. Every other SCSS file consumes those tokens.

**Raw hex / rgb / rgba / named color values inside those three files are correct by design and MUST NOT be flagged as "hardcoded color" violations by any reviewer (human or AI).**

- Editing a value in a token declaration (e.g. `--color-teal: #008c98;` → `#0a99a6;`) is the ONLY way to change a color across the app. That's the intended workflow, not a rule violation.
- Adding a new token requires a matching declaration in **all three** files. Missing the sibling declaration IS a valid finding.
- Renaming or removing a token is a breaking change — flag it and check every consumer.
- Wrong per-theme value (e.g. a dark-theme color that fails WCAG contrast) is still a valid finding.

The "no hardcoded colors" rule applies to **every other SCSS file** under `src/**/*.scss` — component styles, layout styles, and `global.theme.scss`. In those files, colors must come from `var(--color-*)`.

## Token Catalog

Full token table is in [rules.md](../../rules.md) §1 "Design Token CSS Variables". If you need a token that doesn't exist:

1. Add it to **all three** theme files with the correct per-theme value.
2. Add a row to the token table in `rules.md`.
3. Then use `var(--color-*)` in the component SCSS.

## Theme-Invariant Tokens

`--color-modal-bg` and `--color-modal-input-bg` are intentionally `#ffffff` in every theme — modal cards always render on a white surface. Don't "fix" them.

## Global vs Component Styles

- Typography, accessibility helpers, loader classes → [global.theme.scss](../../src/styles/global.theme.scss).
- Component-specific styles → component SCSS file, scoped via Angular's view encapsulation.
- Don't add app-wide selectors from a component file.

## RTL

The app supports Arabic (RTL). Prefer logical properties (`margin-inline-start`, `padding-inline-end`, `inset-inline-*`) over `left`/`right`. Test mirrored layouts before finishing.

## Motion & Page Transitions (Required)

The motion stack is centralized — do not roll your own.

- **Page transitions**: handled by the native View Transitions API enabled in [app.config.ts](../../src/app/app.config.ts) via `withViewTransitions()`. Customize only via the `::view-transition-old(root)` / `::view-transition-new(root)` rules in [global.theme.scss](../../src/styles/global.theme.scss). Never re-add `@angular/animations` route triggers in `app.component.ts`.
- **Scroll-reveal**: use the `[appScrollReveal]` directive ([scroll-reveal.directive.ts](../../src/app/shared/directives/scroll-reveal.directive.ts)) with one of the supported variants (`fade`, `fade-up`, `fade-in-x`). The matching `.reveal-*` and `.is-visible` classes live in [global.theme.scss](../../src/styles/global.theme.scss). Never write per-page `IntersectionObserver` code.
- **List / grid / accordion**: use the `[appAutoAnimate]` directive ([auto-animate.directive.ts](../../src/app/shared/directives/auto-animate.directive.ts)) backed by `@formkit/auto-animate`. Don't hand-write enter/leave keyframes for items in a `@for` loop.
- **Reduced motion**: every custom animation must include a `@media (prefers-reduced-motion: reduce)` block that visually no-ops. From TypeScript, read [MotionService.prefersReducedMotion()](../../src/app/shared/services/motion.service.ts) instead of `window.matchMedia`.

### Style guidelines

- Treat motion as a UX requirement, not decoration. Each routed page should have a subtle enter cue.
- Keep timing consistent — use the existing `--transition-fast / -base / -slow` tokens. Don't invent new easings per component.
- Prefer animating `opacity` and `transform`; avoid layout-heavy properties (`width`, `height`, `top`, `left`).
- Avoid long or flashy effects. Motion should be fast and unobtrusive.
- Define shared motion utilities in [global.theme.scss](../../src/styles/global.theme.scss) and reuse them.
- RTL-aware translates: use logical values or the `[dir="rtl"]` flip pattern already in `.reveal-fade-in-x`.
