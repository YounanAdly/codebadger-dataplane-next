---
description: "Use when a Flutter change creates, reads, or updates application state. Enforces correct separation of state and UI using the state-management solution the project already uses."
applyTo: "**/lib/**/*.dart"
---

# State Management (Flutter)

## Scope

Applies to any change that stores, derives, or shares application state. This file does not mandate a library.

## Review rules

1. **Detect and follow the project's state-management solution** — Riverpod, Bloc/Cubit, Provider, GetX, MobX, Redux, `ValueNotifier`+`InheritedWidget`, or plain `setState`-scoped state. Review consistency with it.
2. **Do not introduce a second state-management solution** alongside an existing one. Mixing paradigms in one change (e.g. a `setState` feature inside a Bloc app) is a finding unless the project demonstrably does both for local vs. shared state.
3. **Separation of state and UI**: widgets render state and dispatch intents; state holders (notifiers/blocs/providers/services) own transformation logic.
4. **Avoid unnecessary rebuilds.** Scope state to the smallest listening widget: `Selector`/`Consumer` (Provider), `BlocBuilder` with `buildWhen`, `select()` (Riverpod), fine-grained `Obx` (GetX). Full-page rebuilds on every keystroke are a finding.
5. **State classes are immutable where the solution expects it** — freezed/equatable state objects for Bloc, `copyWith` for notifiers. Mutating a state object in place defeats change detection.

## Positive recommendations

- Local ephemeral UI state (animation toggles, text controllers) may stay in `StatefulWidget`/`setState` if the project uses that convention for it.
- Prefer deriving state with `computed`-style providers/selectors over storing both raw and derived copies.
- Keep provider/bloc scope as narrow as correct: scoped-to-page state should not live app-global unless navigation requires it.

## Anti-patterns to flag

```dart
// BAD — mutating shared state in place (listeners may never fire)
state.items.add(item);

// BAD — global state for page-local concerns in a scoped-state project
final pageScrollPosition = StateProvider<double>((ref) => 0); // app-global

// BAD — UI performing business decisions
onPressed: () {
  if (cart.items.length > 10) { /* discount logic in widget */ }
}

// BAD — rebuilding the whole screen for one field
// BlocBuilder<BlocA, BlocAState>(builder: ... wrapping the entire Scaffold)
```

## Preserve existing conventions

- `setState` is not a mistake by itself — in small or leaf widgets it is idiomatic. Only flag it where the project convention routes shared state through its state-management solution.
- Do not suggest migrating to another state-management library because it is more popular or newer.
