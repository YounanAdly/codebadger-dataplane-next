---
description: "Use when a React change adds or modifies tests. Enforces meaningful RTL-style assertions with the project's existing testing stack."
applyTo: "**/*.test.*,**/*.spec.*,**/__tests__/**"
---

# React Testing

## Scope

Applies to frontend test files and the testability of changed components.

## Review rules

1. **Changed behavior gets tests** at the level the project uses — component tests for UI behavior, integration tests for flows.
2. **Use the project's existing stack** (React Testing Library, Vitest/Jest, msw for network) — do not introduce a second rendering or mocking framework in one PR.
3. **Assert observable behavior**: rendered text, roles, and user-visible state via `getByRole`/`getByText`/user-event interactions — not internal state, not `instanceof`, not implementation-detail queries (`getByTestId` only where the project uses it).
4. **Tests are deterministic**: no real network (msm/handlers or mocks), no `Date.now()` without injection, no `act` warnings ignored; fake timers for debounced/throttled behavior.
5. **Async user events are awaited**: `await user.click(...)` / `findBy*` for async UI — sync assertions after async work are flaky by construction.
6. **Error and empty states are covered**, not only the happy path — assert the error UI renders and recovery works where the component offers it.
7. **Do not weaken or delete existing assertions** to make a change pass; a removed test needs the removal explained in the PR.

## Anti-patterns to flag

```jsx
// BAD — implementation-detail assertion
expect(component.state.count).toBe(1);

// BAD — real network in a component test
render(<CommentList postId="1" />); await api.fetchReal();

// BAD — sleeps instead of awaiting the UI
await new Promise(r => setTimeout(r, 1000)); expect(screen.getByText("Loaded"));
```

## Positive recommendations

- A regression test that fails without the fix is the ideal shape for bug-fix PRs.
- Test accessibility as behavior: queries by role assert the a11y contract for free.

## Preserve existing conventions

- Do not require snapshot/golden tests for trivially-styled changes; match the project's file mirroring (`Component.test.tsx` next to `Component.tsx` or in `__tests__/`).
