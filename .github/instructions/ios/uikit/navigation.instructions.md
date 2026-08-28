---
description: "Use when UIKit navigation changes: segues, navigation controllers, modal presentation, coordinators, deep links. Enforces consistency with the project's existing navigation approach."
applyTo: "**/*.swift"
---

# UIKit Navigation

## Scope

Applies to navigation controllers, segues, modal presentation, coordinators/routers, and deep links in UIKit code.

## Review rules

1. **Follow the project's navigation approach** — storyboards+segues, programmatic push/present, or coordinator/router classes. Don't force migration in a feature PR.
2. **Push vs present semantics correct**: hierarchical detail → push; modal tasks → present; dismissing a pushed controller via `dismiss` (instead of `popViewController`) is a finding, and vice versa.
3. **Segues typed and validated**: `prepare(for:sender:)` casts destination properly (`guard let`), destination exists; renamed segues/classes keep identifiers in sync with storyboard.
4. **Retain cycles in navigation blocks**: completion/closure-based presentations capturing view controllers strongly where the project avoids it.
5. **Deep links resolve safely**: navigating directly to a route without app state must land on a defined screen (guard/redirect), not crash; URL parameters validated.
6. **Back-stack integrity**: replacing flows (login → home) reset the stack the way the project does (`setViewControllers`, popToRoot), not by stacking.

## Positive recommendations

- Route transitions through the project's coordinator/router when one exists — a view controller directly presenting cross-feature screens in a coordinator project is a finding.
- Keep presentation style/accessibility consistent (form sheets, full-screen modals) with existing screens.

## Anti-patterns to flag

```swift
// BAD — dismissing a pushed screen with dismiss
self.dismiss(animated: true) // was pushed — pop instead

// BAD — force-cast segue destination
let vc = segue.destination as! DetailsViewController

// BAD — strong self capture in presentation completion (project avoids it)
present(vc, animated: true) { self.trackShown() }
```

## Preserve existing conventions

- Storyboard-driven projects: don't demand programmatic rewrites; programmatic projects: don't demand storyboards.
