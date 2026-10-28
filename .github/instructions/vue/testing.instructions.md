---
description: "Use when a Vue change adds or modifies tests. Enforces meaningful component tests with the project's existing stack (Vitest + Vue Test Utils or the project's runner)."
applyTo: "**/*.spec.ts,**/*.test.ts,**/*.spec.js,**/tests/**"
---

# Vue Testing

## Scope

Applies to frontend test files for Vue components and composables.

## Review rules

1. **Changed behavior gets tests** using the project's existing stack (Vitest/Vue Test Utils/Cypress-Playwright as configured) — no second mounting or mocking framework in one PR.
2. **Assert rendered behavior**: text, visibility, emitted events, `getByRole`-style queries where available — not internal component state or implementation details.
3. **Reactivity needs the right flush**: assertions after reactive updates use `nextTick()`/`flushPromises()` — sync assertions after async updates are flaky.
4. **Store/router/external deps are isolated** the way the project already does it (global plugins, store mocking, msw) — tests never hit real APIs.
5. **Error and empty states are covered**, not only the happy path.
6. **v-model and emits are tested as the public contract** of a component.

## Anti-patterns to flag

```js
// BAD — assertion before the async DOM update
wrapper.trigger("click"); expect(wrapper.text()).toContain("Saved");

// BAD — implementation-detail test
expect(wrapper.vm.internalCounter).toBe(2);
```

## Preserve existing conventions

- Match the project's spec layout and naming; do not demand snapshot tests for trivially-styled components.
