# iOS Review Rules

Platform detection signals: `.swift` files, `Podfile`, `Package.swift`, `.xcodeproj`, `.xcworkspace`.

This file is the **loading index** for iOS review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. Swift-language rules apply to
every `.swift` change; SwiftUI and UIKit rule packages are scoped in-file ("apply only to
files using those APIs"), so mixed-technology projects are handled without assumptions.
The baseline rules at the bottom always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/ios/`:

- .github/instructions/ios/swift/swift.instructions.md — Swift language best practices: optionals, naming, value types
- .github/instructions/ios/swift/architecture.instructions.md — consistency with the project's existing architecture; no pattern mandates
- .github/instructions/ios/swift/concurrency.instructions.md — async/await, actors, GCD, main-actor correctness, cancellation
- .github/instructions/ios/swift/networking.instructions.md — URLSession/client separation, typed decoding, status checks, secret hygiene
- .github/instructions/ios/swift/error-handling.instructions.md — typed errors, no swallowed failures, no try!/as!
- .github/instructions/ios/swift/memory-management.instructions.md — retain cycles, weak delegates, timer/observer cleanup
- .github/instructions/ios/swift/performance.instructions.md — main-thread discipline, downsampling, formatter reuse
- .github/instructions/ios/swift/testing.instructions.md — XCTest/Swift Testing with the project's stubbing stack
- .github/instructions/ios/swift/dependencies.instructions.md — SPM/CocoaPods justification, maintenance, version consistency
- .github/instructions/ios/swiftui/views.instructions.md — SwiftUI composition: body cost, identity, AnyView, modifiers
- .github/instructions/ios/swiftui/state-management.instructions.md — @State/@Binding/@StateObject ownership, invalidation scope
- .github/instructions/ios/swiftui/navigation.instructions.md — NavigationStack, sheet(item:), deep-link validation
- .github/instructions/ios/swiftui/accessibility.instructions.md — labels, Dynamic Type, hit targets, announcements
- .github/instructions/ios/swiftui/styling-themes.instructions.md — adaptive colors, text styles, dark mode
- .github/instructions/ios/uikit/views.instructions.md — UIView/cell construction, Auto Layout, reuse hygiene
- .github/instructions/ios/uikit/view-controllers.instructions.md — lifecycle symmetry, light viewDidLoad, separation of concerns
- .github/instructions/ios/uikit/navigation.instructions.md — push/present semantics, typed segues, stack integrity
- .github/instructions/ios/uikit/accessibility.instructions.md — accessibilityLabel/traits, VoiceOver, Dynamic Type
- .github/instructions/ios/uikit/styling-themes.instructions.md — asset colors, text styles, appearance centralization
- .github/instructions/ios/localization.instructions.md — NSLocalizedString/String Catalogs, plurals, RTL, key parity
- .github/instructions/ios/security.instructions.md — Keychain, ATS, sensitive logging, pasteboard, entitlements

## Baseline rules (always loaded)

1. No force unwraps (`!`) without nil checks — use `guard let` or `if let`.
2. No hardcoded API keys — use Keychain or secure storage.
3. Always use `[weak self]` in closures that could create retain cycles.
4. No network calls on the main thread — use `async/await` or background queues.
5. Use `Codable` for JSON parsing — no manual serialization.
6. SwiftUI: use `@State`, `@Binding`, `@ObservedObject` correctly; keep views lightweight.
7. Handle all errors with `do/try/catch` or `Result` types.
8. Prefer `async/await` over completion handlers for new code.
9. All UI strings must use `NSLocalizedString` or String Catalogs.
10. Add `accessibilityLabel` / `accessibilityHint` on interactive elements.
11. Info.plist: new permission usage strings must match features actually implemented; no over-broad entitlements.
12. ATS: no `NSAllowsArbitraryLoads` exceptions without justification.
13. Keychain: use appropriate accessibility classes (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for sensitive data).
14. Test: XCTest for unit tests, XCUITest for UI tests.

Severity guide:
- **critical**: force unwraps on fallible paths, hardcoded secrets, retain cycles leaking sensitive objects, unencrypted keychain storage, ATS disabled globally.
- **high**: main-thread blocking, missing error handling, missing accessibility labels.
- **medium**: naming violations, missing documentation, missing tests.
- **low**: readability, minor optimizations.
