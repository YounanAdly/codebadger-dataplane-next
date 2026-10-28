# Vue Review Rules

Platform detection signals: `.vue` files, `vue.config.js`, `nuxt.config.*`, `package.json` with `vue`.

This file is the **loading index** for Vue review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/vue/`:

- .github/instructions/vue/vue.instructions.md — SFC correctness: reactivity loss via destructuring, v-for keys, v-html, watchers, lifecycle symmetry
- .github/instructions/vue/state-management.instructions.md — store consistency (Pinia/Vuex/composables), storeToRefs, shared-composable scope, fetch races
- .github/instructions/vue/testing.instructions.md — Vue Test Utils behavior assertions with the project's stack

## Baseline rules (always loaded)

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
13. Test with the project's existing setup (Vitest, Cypress/Playwright where already used).
14. Follow the Vue style guide (Priority A + B rules).

Severity guide:
- **critical**: XSS via `v-html`, hardcoded secrets, direct DOM access, missing keys on `v-for` with stateful children.
- **high**: unnecessary watchers, missing computed properties, large monolithic components, missing error handling.
- **medium**: naming violations, missing prop types, missing tests.
- **low**: readability, formatting, minor optimizations.
