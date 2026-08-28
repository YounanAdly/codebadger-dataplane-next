---
description: "Use when Compose code navigates: Navigation-Compose, screens, arguments, deep links. Enforces consistency with the navigation approach the project already uses."
applyTo: "**/*.kt"
---

# Compose Navigation

## Scope

Applies to navigation in Compose code (navigation-compose, alternative routers, or manual navigation state). Apply only to files using Compose APIs.

## Review rules

1. **Follow the navigation approach the project already uses** (navigation-compose typed routes, string routes with arguments, or a custom coordinator). Don't force migration in a feature PR.
2. **Route arguments validated**: parsed/converted arguments (`navArgument` types, `toIntOrNull` on string extras) — `NavController` argument force-parsing that crashes on malformed deep links is a finding.
3. **Back-stack semantics correct**: replacing flows (login → home) pop/reset the stack (`popUpTo`, `launchSingleTop`) per the project's pattern, not by stacking.
4. **Navigation triggered from events, not composition**: navigating inside `@Composable` body or `LaunchedEffect(Unit)` with changing captures is a stale-navigation bug — observe one-shot event flows/state per the project's pattern.
5. **Deep links resolve safely**: direct entry to a deep route without prior state lands on a defined screen; `Uri` parsing validated.
6. **Screen-level state survives navigation** (scroll, selections) where the project preserves it — via VM or `rememberSaveable`.

## Positive recommendations

- Keep route definitions where the project defines them (centralized graph object vs. per-feature — as exists).
- Prefer typed route classes where the project adopted navigation-compose 2.8+ type-safe APIs.

## Anti-patterns to flag

```kotlin
// BAD — navigation during composition
@Composable fun Screen(nav: NavController) {
  if (!loggedIn) nav.navigate("login") // side effect in composition
}

// BAD — unvalidated deep-link arg
val id = backStackEntry.arguments?.getString("id")!!.toInt()

// BAD — stacking login over login
nav.navigate("home") // no popUpTo("login") { inclusive = true }
```

## Preserve existing conventions

- Don't demand migration between string routes and type-safe routes in a feature PR — follow the graph the repo already maintains.
