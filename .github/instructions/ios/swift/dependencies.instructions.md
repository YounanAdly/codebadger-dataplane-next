---
description: "Use when an iOS change adds, upgrades, or removes packages (SPM/CocoaPods/Carthage). Enforces justified dependencies with attention to maintenance and compatibility."
applyTo: "**/Package.swift,**/Package.resolved,**/Podfile,**/Podfile.lock,**/*.xcodeproj/project.pbxproj"
---

# Dependencies (iOS)

## Scope

Applies to SPM `Package.swift`/resolved files, CocoaPods `Podfile`, and Xcode project package/linked-framework changes.

## Review rules

1. **Every new dependency needs a justification.** Flag trivial additions that Foundation/stdlib or existing packages already cover (one formatter, one toast, one tiny utility).
2. **Duplicate purpose is a finding**: two image loaders, two networking stacks, two JSON libraries coexisting without strong justification. A layered dependency built on top of another (e.g. Moya on top of Alamofire) is not duplication — do not flag valid layering.
3. **Maintenance health**: actively maintained, Swift-version compatible, supports the deployment target. Flag archived/unmaintained packages for new adoption.
4. **Version changes follow the project's constraint style** (exact pins vs ranges); upgrades that force an iOS deployment-target bump or break other constraints are flagged with affected packages named.
5. **Podfile/SPM parity**: projects using both must keep shared dependencies' versions consistent across both manifests.
6. **Lockfile-only churn** (Podfile.lock / Package.resolved changes with no manifest change) is suspicious — likely accidental update.

## Positive recommendations

- Prefer first-party/Apple frameworks where adequate (Foundation, Combine, Swift Collections...) over third-party equivalents.
- When removing a dependency, check for leftover imports and document the replacement.

## Anti-patterns to flag

```ruby
# Podfile — BAD: two unrelated networking stacks serving the same role
pod 'Alamofire'    # the app's services already use Alamofire everywhere
pod 'AFNetworking' # a second, unrelated HTTP stack for the same job

# BAD — unmaintained package for a one-line utility
```

## Preserve existing conventions

- Don't suggest replacing a working dependency with a more popular one without a concrete deficiency.
- Xcode project file churn (pbxproj) should be limited to what the change requires — flag unrelated project-setting edits in feature PRs.
