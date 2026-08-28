---
description: "Use when the change adds, moves, or restructures files, layers, or module boundaries in a Flutter project. Enforces consistency with the architecture the project already uses."
applyTo: "**/lib/**/*.dart"
---

# Architecture Consistency (Flutter)

## Scope

Applies when a pull request introduces new features, moves files, or changes layer boundaries. This file deliberately does **not** mandate an architecture.

## Review rules

1. **Detect the architecture the repository already uses** (feature-first, layer-first, Clean Architecture, MVVM, MVC, BLoC-organized, plain services — whatever exists) and review consistency with it. Do not recommend switching patterns.
2. **New features follow the existing layout.** If features live under `lib/features/<name>/`, a new feature goes there with the same internal structure. If the project groups by layer (`lib/ui/`, `lib/services/`), follow that.
3. **Do not introduce a new architectural pattern in the same PR as a feature.** Architecture changes must be their own, clearly-scoped change.
4. **Preserve layer direction.** UI depends on state/logic, logic depends on data sources — whatever direction the project established. Flag back-door imports that skip the project's established boundary (e.g. UI constructing data-layer objects directly when every other feature goes through a repository/service).
5. **Business logic stays out of widgets** in whatever form the project uses (services, controllers, blocs, notifiers, view models). A `build()` method orchestrating API calls or complex conditionals is a finding.

## Positive recommendations

- Extract shared logic into the project's existing service/controller location rather than inventing a parallel location.
- When a file takes on multiple unrelated responsibilities (UI + data access + business rules), suggest splitting along the project's own conventions (e.g. `screen.dart` + `widgets/` + `controller.dart`).

## Anti-patterns to flag

```dart
// BAD — UI layer doing data-layer work directly (in a project where features use services/repositories)
class ProfilePage extends StatelessWidget {
  Widget build(context) {
    http.get(Uri.parse('https://api.example.com/profile')); // network in widget
  }
}
```

- Copying a component from another feature instead of reusing/parameterizing the existing one — when the project's structure provides a shared location for it.
- Renaming/moving core folders (e.g. `lib/core/`, `lib/shared/`) inside an unrelated feature PR.

## Preserve existing conventions

- A change is not wrong just because the reviewer would have organized it differently. Only flag inconsistencies with the project's own established pattern.
- Generated code locations (`*.g.dart`, `*.freezed.dart` siblings) are dictated by the generator — never flag their placement.
