# Angular Review Rules (generic)

Apply alongside the project-specific Angular rules in `rules.md` when the pull request touches Angular code: `angular.json`, `src/app/**`, Angular workspace config.

## Modern Angular patterns (for new code)
1. All new components MUST be standalone. No NgModules.
2. Use `inject()` for DI — never constructor injection.
3. Use signals: `signal()`, `computed()`, `effect()`, `linkedSignal()`.
4. Use `input()` / `input.required()` for inputs and `output()` for outputs. No `@Input`/`@Output` decorators in new code.
5. Built-in control flow only: `@if`, `@else`, `@for`, `@switch`. Never `*ngIf`/`*ngFor`/`*ngSwitch` in new code.
6. Every `@for` must have a `track` expression.
7. Use `httpResource()` / `HttpClient` service patterns for HTTP reads — no manual BehaviorSubject plumbing.
8. All routes must be lazy-loaded: `loadComponent: () => import(...)`.
9. Use `OnPush` change detection on every new component.
10. Use `NgOptimizedImage` for raster images.
11. No hardcoded colors in component SCSS — use CSS custom properties / theme tokens.
12. SSR-safe: wrap browser APIs in `isPlatformBrowser()` when SSR is enabled.
13. No `console.error`, `alert()`, or direct `document.*` access in components.
14. i18n: all user-visible strings must use translation keys with parity across locale files.

## Severity guide
- **critical**: `@Input`/`@Output` decorators in new components, `*ngIf`/`*ngFor`, NgModules, `HttpClient` calls inside components, `console.error`/`alert`, hardcoded colors in component SCSS outside theme files, missing i18n parity.
- **high**: missing `OnPush`, missing `@defer` for lazy loading, missing `aria-label` on icon-only buttons, missing `NgOptimizedImage` priority, non-standalone new components.
- **medium**: naming/style violations, missing test spec, minor a11y improvements, non-signal state.
- **low**: readability/micro-optimizations, minor RTL concerns.
