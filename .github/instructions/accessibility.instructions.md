---
description: "Use when building any UI component, template, or interactive element. Enforces WCAG AA accessibility using @angular/cdk primitives."
applyTo: "src/app/**/*.ts,src/app/**/*.html,src/**/*.scss"
---

# Accessibility (WCAG AA)

`@angular/cdk` is installed. **Reuse CDK primitives before writing manual ARIA logic.**

## CDK primitives — use these first

```ts
import { A11yModule } from '@angular/cdk/a11y';                  // CdkTrapFocus, LiveAnnouncer
import { CdkMenu, CdkMenuItem } from '@angular/cdk/menu';        // dropdowns, menus
import { CdkListbox, CdkOption } from '@angular/cdk/listbox';    // selects
import { CdkAccordion, CdkAccordionItem } from '@angular/cdk/accordion';
```

| UI pattern | CDK primitive |
|---|---|
| Modal / dialog | `cdkTrapFocus cdkTrapFocusAutoCapture` (already on `app-otp-modal`, `app-success-alert-modal`, video preview) |
| Dropdown / menu | `CdkMenu` / `CdkMenuItem` |
| Listbox / select | `CdkListbox` / `CdkOption` |
| Accordion | `CdkAccordion` / `CdkAccordionItem` |
| Programmatic announcement | `LiveAnnouncer` (already wired through `ToastService`) |

## Hard rules

1. **Icon-only buttons** must have `aria-label` (translation key). Decorative icon `<img>` gets `aria-hidden="true"` and `alt=""`.
   ```html
   <button (click)="close()" [attr.aria-label]="'common.close' | translate">
     <img src="assets/icons/close.svg" alt="" aria-hidden="true" />
   </button>
   ```
2. **Modals trap focus** via `cdkTrapFocus cdkTrapFocusAutoCapture`. Do not write manual `focus()` orchestration.
3. **Dynamic announcements** go through [`ToastService`](../../src/app/shared/services/toast.service.ts) — it routes every toast through `LiveAnnouncer`. For non-toast updates (search-result count, async status), use `<p aria-live="polite" class="sr-only">...</p>`.
4. **Skip-link target** `id="main-content"` must remain on the primary `<main>` element of every page. The shell skip-link in [app.component.html](../../src/app/app.component.html) depends on it.
5. **Keyboard support** for any custom interactive widget:
   - `Tab` / `Shift+Tab` to reach
   - `Enter` to activate buttons/links
   - `Space` for checkboxes/toggles (preventDefault on the keydown)
   - `Escape` to close modals, dropdowns, drawers
6. **Form fields** must have programmatic labels. Formly handles this for registered types. For raw HTML, use `<label for="...">` or `aria-labelledby`. Errors must use `role="alert"` and `aria-live="assertive"` if shown after submit.
7. **Color contrast** — all token pairs in [rules.md §1](../../rules.md) are WCAG AA-verified. Any new badge/pill background+foreground combination must be checked before being added to the theme files.
8. **Images**:
   - Meaningful: `alt="<description>"`.
   - Decorative: `alt=""` and `aria-hidden="true"`.
   - Inline SVG icons: add `aria-hidden="true"` if decorative; if meaningful, use `role="img"` with `<title>`.
   - `NgOptimizedImage` (`ngSrc`) still requires a meaningful `alt`.

## Focus management on navigation

The shell handles initial focus via the skip-link target. For programmatic focus return after closing a modal:

```ts
import { afterNextRender } from '@angular/core';

private triggerEl: HTMLElement | null = null;

openModal(trigger: HTMLElement) {
  this.triggerEl = trigger;
  this.isOpen.set(true);
}

closeModal() {
  this.isOpen.set(false);
  afterNextRender(() => this.triggerEl?.focus());
}
```

## Live regions for non-toast updates

```html
<!-- Search results count update -->
<p aria-live="polite" class="sr-only">
  {{ 'search.resultsCount' | translate : { count: results().length } }}
</p>
```
