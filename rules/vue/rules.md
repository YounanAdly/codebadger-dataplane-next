# Vue Review Rules

Apply when the pull request touches Vue code: `.vue` files, `vue.config.js`, `vite.config.*`, `package.json` with `vue`.

1. Never use `v-html` without sanitization.
2. Always provide `:key` on `v-for` — stable IDs, not index.
3. No `console.log` / `console.error` in production code.
4. Use `computed()` for derived state — not methods called in templates.
5. Use `ref()` for primitives, `reactive()` for objects — be consistent with the project's pattern.
6. Prefer Composition API (`<script setup>`) for new components.
7. Handle all async errors; render loading/error/empty states.
8. No direct DOM manipulation — use template refs only when necessary.
9. All images must have `alt` text; interactive elements need accessible names.
10. TypeScript: define prop types with `defineProps<T>()` and emits with `defineEmits<T>()`.
11. Decompose large components; extract reusable logic into composables.
12. No hardcoded secrets; API calls go through the project's service layer.
13. Test: Vitest for unit tests, Cypress/Playwright for E2E.
14. Follow the Vue style guide (Priority A + B rules).

Severity guide:
- **critical**: XSS via `v-html`, hardcoded secrets, direct DOM access, missing keys on `v-for` with stateful children.
- **high**: unnecessary watchers, missing computed properties, large monolithic components, missing error handling.
- **medium**: naming violations, missing prop types, missing tests.
- **low**: readability, formatting, minor optimizations.
