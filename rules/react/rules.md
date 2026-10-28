# React Review Rules

Platform detection signals: `vite.config.*`, `.tsx`/`.jsx` components, `package.json` with `react`.

This file is the **loading index** for React review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files — component tests or pubspec-style
dependency rules load only when relevant files change. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/react/`:

- .github/instructions/react/react.instructions.md — components & hooks: rules-of-hooks, effect cleanup/deps, keys, refs, boundaries
- .github/instructions/react/state-management.instructions.md — state ownership, server vs UI state, store consistency, fetch races
- .github/instructions/react/performance.instructions.md — render cost, list virtualization, evidence-based memoization
- .github/instructions/react/security.instructions.md — XSS, client-bundle secrets, client storage, postMessage; client checks are UX only
- .github/instructions/react/testing.instructions.md — RTL-style behavior assertions with the project's stack

## Baseline rules (always loaded)

1. Never use `dangerouslySetInnerHTML` without sanitization (e.g. DOMPurify).
2. No `useState` inside loops or conditions — lift state up.
3. Always provide a stable `key` prop on mapped elements — use IDs, not array index.
4. No `console.log` / `console.error` in production components.
5. Use `React.memo` for expensive components that receive stable props; use `useMemo` / `useCallback` to prevent unnecessary re-renders — but don't memoize blindly.
6. Follow the project's state-management pattern; no duplicated global state.
7. Handle all async errors with error boundaries or try/catch; render loading and error states.
8. Accessible: semantic HTML, `aria` labels on interactive elements, keyboard navigation, `alt` text on images.
9. No inline styles for complex styling — use the project's styling system.
10. TypeScript strictly — no `any` types.
11. No hardcoded secrets; API calls go through the project's API layer, not hardcoded endpoints in components.
12. Test with the project's existing setup (React Testing Library where used); add tests for changed behavior.

Severity guide:
- **critical**: XSS risks, hardcoded secrets, missing key props on large lists, direct DOM manipulation.
- **high**: missing error/loading states, expensive un-memoized renders, missing tests for new behavior.
- **medium**: naming violations, missing types, prop drilling, missing accessibility.
- **low**: readability, formatting, minor optimizations.
