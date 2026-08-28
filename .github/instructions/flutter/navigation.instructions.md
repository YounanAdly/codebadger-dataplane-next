---
description: "Use when a Flutter change adds routes, navigates between screens, passes route arguments, or configures deep links. Enforces consistency with the navigation solution the project already uses."
applyTo: "**/lib/**/*.dart"
---

# Navigation (Flutter)

## Scope

Applies to route registration, screen-to-screen navigation, arguments passing, and deep links.

## Review rules

1. **Follow the navigation solution the project already uses** — `Navigator` 1.0/2.0, `go_router`, `auto_route`, `beamer`, `routemaster`, or named-route maps. Do not suggest migrating to another routing package.
2. **New screens register routes the same way existing screens do.** An unregistered `MaterialPageRoute` push inside a `go_router` app is a finding; so is a hand-rolled route map inside an `auto_route` app.
3. **Typed, validated arguments.** Pass typed objects/settings classes where the project does; validate query/path parameters before use (null or malformed args must degrade to a defined error/redirect route, not crash).
4. **Consistent transition style** with the project (platform-adaptive page routes vs. custom transitions) — don't introduce one-off transitions.
5. **Deep links must be testable and state-safe**: navigating directly to a deep route without prior app state must work or redirect gracefully.

## Positive recommendations

- Guard protected routes the way the project does (route-level guards/redirects over scattered in-widget auth checks).
- Return results from pushed screens consistently (`await Navigator.push` / go_router `push` futures) where the project uses result passing.
- Prefer `context.go` vs `context.push` semantics correctly in go_router apps: replacing flows (login → home) use `go`; stacking detail views use `push`.

## Anti-patterns to flag

```dart
// BAD — building routes by hand in a go_router project
Navigator.of(context).push(MaterialPageRoute(builder: (_) => DetailsPage(id: id)));

// BAD — unvalidated deep-link parameter
final id = state.uri.queryParameters['id']!; // crashes on missing param

// BAD — navigation inside build()
Widget build(context) {
  if (mustLogIn) { context.go('/login'); } // navigate in post-frame callback/listener instead
}
```

## Preserve existing conventions

- Route naming/paths follow the project's existing scheme (`/feature/detail/:id` style consistency).
- Legacy `Navigator.push` code that the change does not touch is not a finding — only flag new code that breaks the established pattern.
