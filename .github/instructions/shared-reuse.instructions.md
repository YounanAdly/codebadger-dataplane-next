---
description: "Use when creating or editing Angular components, services, guards, interceptors, or any TypeScript in src/app. Enforces reuse-first inventory check and standalone-component patterns."
applyTo: "src/app/**/*.ts"
---

# Shared Component & Service Reuse

The reuse inventory lives in [rules.md](../../rules.md) §2–§3. Read it before authoring a new component or service.

## Workflow Before Writing Code

1. **Classify** the new piece: layout shell, content card, form control, utility widget, directive, or business service.
2. **Search** the matching folder:
   - UI → [src/app/shared/components](../../src/app/shared/components)
   - Directives → [src/app/shared/directives](../../src/app/shared/directives)
   - Form fields → [src/app/shared/formly/custom-components](../../src/app/shared/formly/custom-components)
   - Layout → [src/app/layouts](../../src/app/layouts)
   - Logic → [src/app/shared/services](../../src/app/shared/services)
3. **Extend before creating.** Add a variant, an `input()`, or a Formly prop instead of cloning a component.
4. **Only create new** if extension would harm readability/maintainability — and the new piece must be reusable by at least one additional screen.

## Modern Angular 21 Conventions (Mandatory for new code)

Full pattern catalog in [rules.md §1.5](../../rules.md). The non-negotiable bullets:

### DI & lifecycle
- Use `inject()` — never constructor parameter injection.
- Cleanup with `takeUntilDestroyed(inject(DestroyRef))` — never manual `Subject<void>` `destroy$` patterns.

### Component API
- Standalone (default in Angular 19+).
- `changeDetection: ChangeDetectionStrategy.OnPush` on every new component.
- Inputs: `input()` / `input.required<T>()`. **Not** `@Input()`.
- Outputs: `output<T>()`. **Not** `EventEmitter`.
- Two-way binding: `model<T>()`.
- Queries: `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`. **Not** `@ViewChild()`.

### State
- `signal()`, `computed()`, `effect()`, `linkedSignal()`.
- RxJS interop via `toSignal()` / `toObservable()`.
- HTTP-backed reactive state: prefer `httpResource()` / `resource()` over manual `BehaviorSubject`.

### Templates
- Built-in control flow only: `@if`, `@else if`, `@else`, `@for`, `@switch`. **Never** `*ngIf` / `*ngFor` / `*ngSwitch`.
- Every `@for` must have `track`.
- `@let` for expensive expressions / repeated signal reads.
- `@defer` for heavy below-fold sections, with an `app-skeleton-loader` placeholder.

### Routing
- New routes are **always lazy**: `loadComponent: () => import('./...').then(m => m.XComponent)`. Never use eager `component:`.
- `withComponentInputBinding()` is enabled — bind route/query params via `input()` directly on the routed component.
- `withViewTransitions()` is enabled — never re-add `@angular/animations` route triggers.

### HTTP
- Never call `HttpClient` from a component. Use [base-crud.service.ts](../../src/app/shared/services/base-crud.service.ts) or a feature service.
- Endpoints live in [src/app/constants.ts](../../src/app/constants.ts). Never inline a URL.
- Auth state from [auth.service.ts](../../src/app/shared/services/auth.service.ts); loading from [loader.service.ts](../../src/app/shared/services/loader.service.ts).

### Images
- Use `NgOptimizedImage` (`<img ngSrc="...">`) for raster images with known intrinsic dimensions. Mark above-fold/LCP hero images with `priority`.

### Animations
- Page transitions → handled by `withViewTransitions()`. Don't re-implement.
- Scroll-reveal → `[appScrollReveal]` directive ([scroll-reveal.directive.ts](../../src/app/shared/directives/scroll-reveal.directive.ts)). Don't write per-page IntersectionObserver code.
- List / grid reorder/add/remove → `[appAutoAnimate]` directive ([auto-animate.directive.ts](../../src/app/shared/directives/auto-animate.directive.ts)).
- Reduced motion → read from `MotionService.prefersReducedMotion()` signal ([motion.service.ts](../../src/app/shared/services/motion.service.ts)). Don't call `window.matchMedia` from components.

### SSR safety
- Hydration is on. Gate `window`, `document`, `localStorage`, `IntersectionObserver`, `matchMedia` access with `isPlatformBrowser(inject(PLATFORM_ID))`.

## Routing

- All routes are language-prefixed (`/:lang/...`).
- Use [language.service.ts](../../src/app/shared/services/language.service.ts) for navigation that needs the current lang.
- Protect authenticated routes with [auth.guard.ts](../../src/app/shared/guards/auth.guard.ts).

## SEO

- Page-level `<title>` and meta tags go through [seo.service.ts](../../src/app/shared/services/seo.service.ts).

## After Adding/Changing a Reusable Piece

Update [rules.md](../../rules.md) inventory in the same task. New `input()`s, new variants, new directives, and new defaults must be documented.

