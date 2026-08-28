---
description: "Use when Android XML navigation changes: nav graphs, activities/fragments wiring, deep links, intents. Enforces consistency with the project's existing navigation approach."
applyTo: "**/res/navigation/*.xml,**/AndroidManifest.xml,**/*.kt"
---

# XML Navigation

## Scope

Applies to Navigation Component XML graphs, manifest launch/deep-link declarations, and navigation wiring in View-based (XML) Android code. The `**/*.kt` glob is intentionally broad — apply the Kotlin rules here only when the change navigates between XML-defined destinations (fragments/activities), not to Compose code.

## Review rules

1. **Follow the project's navigation approach** — Navigation Component XML graphs, manual FragmentTransactions, or activity-based flows. Don't force migration in a feature PR.
2. **Nav graph correctness**: destinations have ids/labels consistent with the graph's conventions; arguments declared with types (`app:argType`) and safe-args used where the project uses it (`NavArgs`/`Directions`) — manual `Bundle` extras in a safe-args project is a finding.
3. **Back-stack semantics correct**: `popUpTo`/`popUpToInclusive`/`launchSingleTop` used per the project's flow patterns; login→home replacement resets the stack properly.
4. **Deep links declared and validated**: `navGraph`/`intent-filter` URI patterns match the graph's `deepLink` declarations; parsed arguments null-checked (malformed deep links must not crash).
5. **Manifest hygiene**: launcher intent filters unchanged unless the change is about them; new activities exported only when they need `intent-filter`s; `exported="true"` without a filter is a finding.
6. **Fragment transaction hygiene (manual projects)**: `commit` vs `commitAllowingStateLoss` misuse, transactions after `onSaveInstanceState` — findings where the project handles lifecycle correctly.

## Positive recommendations

- Route navigation through the project's existing indirection (nav controller helper, base fragment) rather than direct calls scattered everywhere.
- Keep destination naming/ids consistent with the graph's existing scheme.

## Anti-patterns to flag

```xml
<!-- BAD — deep link without argument validation support in graph -->
<deepLink app:uri="app://item/{id}" /> <!-- id parsed with !! in code -->

<!-- BAD — exported activity without intent-filter -->
<activity android:name=".DebugActivity" android:exported="true" />
```

```kotlin
// BAD — Bundle extras in a safe-args project
findNavController().navigate(R.id.details) // no args via Directions
```

## Preserve existing conventions

- Don't demand safe-args migration (or its removal) in a feature PR — follow the graph style the repo already maintains.
