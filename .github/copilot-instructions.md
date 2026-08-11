# Project Guidelines

Angular 22 standalone-components project. **Reuse-first by default.**

The full reusable-component, service, directive, and design-token catalog lives in [rules.md](../rules.md). Read it before implementing any new screen or Figma handoff.

## Core Principles (always apply)

1. **Reuse before create.** Search `src/app/shared/components`, `src/app/shared/directives`, `src/app/shared/formly/custom-components`, `src/app/layouts`, and `src/app/shared/services` before writing anything new. Extend via `input()` / Formly `props` instead of duplicating.
2. **Modern Angular 22 APIs only for new code.** Signals (`signal`, `computed`, `effect`, `linkedSignal`), `input()` / `output()` / `model()`, `inject()`, `viewChild()`, `ChangeDetectionStrategy.OnPush`, built-in control flow (`@if` / `@for` with `track` / `@switch` / `@let`), `@defer`, `takeUntilDestroyed(DestroyRef)`, `NgOptimizedImage`, `httpResource()` / `rxResource()` / `resource()` where applicable. No NgModules, no `*ngIf`/`*ngFor`, no constructor DI, no `@Input/@Output` decorators. See [rules.md §1.5](../rules.md).
3. **No hardcoded design values.** Colors, spacing, and radii come from CSS variables defined in [src/styles/themes/](../src/styles/themes/). Never inline a hex code.
4. **No hardcoded user-facing strings.** Every label/message uses an ngx-translate key in both [en.json](../src/assets/i18n/en.json) and [ar.json](../src/assets/i18n/ar.json). RTL must work.
5. **No inline Formly field arrays.** Every page form lives in a co-located `form.json`. See [formly forms instructions](./instructions/formly-forms.instructions.md).
6. **No direct HttpClient in components.** Use [base-crud.service.ts](../src/app/shared/services/base-crud.service.ts) or a dedicated service.
7. **Endpoints come from constants.** Add new ones to [src/app/constants.ts](../src/app/constants.ts), never inline string URLs.
8. **Language-prefixed routes only.** All routes are nested under `/:lang/...` — use `LanguageService` for navigation.
9. **New routes are always lazy.** Use `loadComponent: () => import('./...').then(m => m.XComponent)`. Component input binding is on; declare route/query params as component `input()`s. `withViewTransitions()` handles cross-page fades — do not re-add `@angular/animations` route triggers.
10. **Motion is centralized.** Page transitions use the native View Transitions API. Scroll-reveal uses `[appScrollReveal]`. List add/remove/reorder uses `[appAutoAnimate]`. Reduced-motion state comes from `MotionService.prefersReducedMotion()` — never call `window.matchMedia` from components. Animations stay short and consistent; respect reduced-motion.
11. **SSR safety.** Hydration is on — gate `window`, `document`, `localStorage`, `IntersectionObserver`, `matchMedia` with `isPlatformBrowser(inject(PLATFORM_ID))`.
12. **Centralized error handling.** All HTTP errors flow through `errorInterceptor`. All toasts go through `ToastService` (translation-aware, routed through `LiveAnnouncer`). No component-local `try/catch`, `hasError` flags, `console.error`, or `alert()` for user-facing failures. See [error-handling instructions](./instructions/error-handling.instructions.md).
13. **Accessibility (WCAG AA).** `@angular/cdk` is installed — reuse CDK primitives (`cdkTrapFocus` on modals, `LiveAnnouncer` for announcements) before writing manual ARIA. Icon-only buttons need `aria-label`. Every page keeps `id="main-content"` for the skip link. See [accessibility instructions](./instructions/accessibility.instructions.md).
14. **Performance.** `OnPush` on every new component. `@defer` heavy below-fold sections. `NgOptimizedImage` on raster heroes (mark LCP with `priority`). `takeUntilDestroyed(inject(DestroyRef))` on every `.subscribe()`.
15. **Cross-browser / Safari.** Project supports macOS Safari 16+ and iOS Safari 15.4+. Always pair `backdrop-filter`, `mask-*`, `appearance: none`, and `background-clip: text` with their `-webkit-` prefixed counterparts (prefixed declaration first). Use `100dvh` with a `100vh` fallback for full-viewport layouts. Don't remove the `viewport-fit=cover`, `color-scheme`, `apple-mobile-web-app-*`, or `format-detection` meta tags in [src/index.html](../src/index.html). New form inputs styled below 16px will be auto-zoomed by iOS Safari — rely on the global touch-device font-size guard in [src/styles/global.theme.scss](../src/styles/global.theme.scss), don't override it. Full checklist: [rules.md §1.7](../rules.md).
<!-- 15. **Never edit the home page.** `src/app/public/home/` is locked. Do NOT modify any file inside that folder unless the user explicitly requests it. -->

## Architecture

- Bootstrap: [src/main.ts](../src/main.ts), [src/app/app.config.ts](../src/app/app.config.ts)
- Routing (lazy): [src/app/app.routes.ts](../src/app/app.routes.ts)
- Layout shell: [src/app/layouts/header](../src/app/layouts/header), [src/app/layouts/footer](../src/app/layouts/footer)
- Shared reusable zone: [src/app/shared/](../src/app/shared/) (components, directives, services, formly, guards, interceptors)
- Public pages: [src/app/public/](../src/app/public/)

## Build & Test

- `npm start` — dev server
- `npm test` — unit tests
- `npm run build` — production build

## Maintenance Rule

After adding or changing a reusable component, directive, service, Formly type, or theme token, update [rules.md](../rules.md) **in the same task**. Never finish a design-to-code task without checking whether the catalog needs a delta.

## When in Doubt

- Forms / Formly → [.github/instructions/formly-forms.instructions.md](./instructions/formly-forms.instructions.md)
- API calls / async / timeouts / retries → [.github/instructions/api-calls.instructions.md](./instructions/api-calls.instructions.md)
- SCSS / theming → [.github/instructions/styling-themes.instructions.md](./instructions/styling-themes.instructions.md)
- Shared components, directives & services → [.github/instructions/shared-reuse.instructions.md](./instructions/shared-reuse.instructions.md)
- i18n strings → [.github/instructions/i18n.instructions.md](./instructions/i18n.instructions.md)
- Error handling / toasts → [.github/instructions/error-handling.instructions.md](./instructions/error-handling.instructions.md)
- Accessibility / ARIA / focus → [.github/instructions/accessibility.instructions.md](./instructions/accessibility.instructions.md)
- Icons → [.github/instructions/icons.instructions.md](./instructions/icons.instructions.md)

