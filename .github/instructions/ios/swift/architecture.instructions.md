---
description: "Use when an iOS change adds, moves, or restructures modules, layers, or feature boundaries. Enforces consistency with the architecture the project already uses — no architecture mandates."
applyTo: "**/*.swift"
---

# Architecture Consistency (iOS)

## Scope

Applies when a pull request adds features, moves files, or changes module boundaries in an iOS project (SwiftUI, UIKit, or mixed). This file does not mandate an architecture.

## Review rules

1. **Detect the architecture the repository already uses** (MVC, MVVM, MVVM+C, VIPER, TCA, feature modules, plain view+service — whatever exists) and review consistency with it. Do not recommend switching patterns.
2. **New features follow the existing project layout** — same folder structure, same grouping (by feature or by layer) as neighboring features.
3. **Do not introduce a new architectural pattern in the same PR as a feature.**
4. **Preserve established boundaries.** If views never import networking in this codebase, a view importing the network client directly is a finding. If coordinators/routers own navigation, a view pushing screens directly is a finding.
5. **Business logic stays out of views/view controllers** in whatever form the project uses (view models, presenters, interactors, services). A view controller doing network calls and parsing is a finding when the project routes that through another layer.

## Positive recommendations

- Put shared logic where the project already keeps shared code (services, managers, extensions) rather than creating a parallel location.
- Split view controllers/views that mix unrelated responsibilities (e.g. presentation + data access + routing in one type) using the project's own decomposition style.

## Anti-patterns to flag

```swift
// BAD — view controller doing data-layer work in a project that uses view models/services
class ProfileViewController: UIViewController {
    @IBAction func refreshTapped(_ sender: Any) {
        URLSession.shared.dataTask(with: profileURL) { data, _, _ in
            self.nameLabel.text = String(data: data!, encoding: .utf8) // networking + parsing + UI all in the VC
        }.resume()
    }
}
```

- Moving core shared folders (core/common) inside an unrelated feature PR.
- Copying an entire module to tweak one behavior instead of parameterizing.

## Preserve existing conventions

- A change is not wrong just because the reviewer would have organized it differently — only flag inconsistencies with the project's own pattern.
- Code generation folders (e.g. SwiftGen/Sourcery output) are dictated by tooling; never flag their placement or contents.
