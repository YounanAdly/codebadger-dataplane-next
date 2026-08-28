# React Review Rules

Apply when the pull request touches React code: `package.json` with `react`, JSX/TSX components.

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
12. Test: React Testing Library for components; add tests for changed behavior.

Severity guide:
- **critical**: XSS risks, hardcoded secrets, missing key props on large lists, direct DOM manipulation.
- **high**: missing error/loading states, expensive un-memoized renders, missing tests for new behavior.
- **medium**: naming violations, missing types, prop drilling, missing accessibility.
- **low**: readability, formatting, minor optimizations.
