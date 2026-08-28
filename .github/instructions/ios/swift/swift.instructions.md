---
description: "Use when writing or reviewing any Swift code. Enforces language-level best practices: optionals handling, naming, value types, and Swift API design guidelines."
applyTo: "**/*.swift"
---

# Swift Language Rules

## Scope

Applies to every `.swift` file in the change: language-level quality only (SwiftUI/UIKit concerns live in their own files under this platform).

## Hard rules

1. **No force unwraps (`!`) or force tries (`try!`) without proof.** Use `guard let`, `if let`, `??`, or `try?` with explicit handling. A crash-capable unwrap must be justified by an invariant in the same PR discussion.
2. **No implicitly unwrapped optionals (`IUO`) outside Interface-Builder-required contexts** (e.g. `@IBOutlet`, UIKit lifecycle-implied properties).
3. **No force casts (`as!`)** — use conditional `as?` with handling.
4. **No `fatalError`/`preconditionFailure` in production paths** for recoverable conditions.
5. **Array/object access is bounds-safe**: `array[i]` on user-driven indices needs a guard.

## Review rules

- Naming follows the [Swift API Design Guidelines]: `lowerCamelCase` members, `PascalCase` types, no abbreviations the project doesn't already use, verb-named mutating methods (`sort()` vs `sorted()`).
- Prefer value types (`struct`, enums) for models; classes for identity/reference semantics — consistent with the project's existing model style.
- Prefer Swift-native types (`String`, `Array`, `Dictionary`) over Foundation bridged counterparts in new code.
- Access control is deliberate: `private`/`fileprivate` for implementation details; no `public`/`open` in app targets without need.
- Avoid `Any`/`AnyObject` and stringly-typed APIs; use enums and generics.
- `deinit` where ownership debugging requires it; otherwise keep classes simple.
- `Codable` for serialization; hand-written parsing only where the project already does it.

## Positive recommendations

- Use `guard` for early exits and precondition checks; keep the happy path unindented.
- Use computed properties over trivial getters backed by stored duplicates.
- Use enums with associated values for state spaces instead of parallel optionals/strings.

## Anti-patterns to flag

```swift
// BAD — crash-capable unwrap
let url = URL(string: userInput)!

// BAD — force cast
let config = settings as! PremiumConfig

// BAD — IUO convenience
var manager: NetworkManager!

// BAD — stringly-typed branching
if role == "admin" { ... }
```

## Preserve existing conventions

- Follow the project's lint config (SwiftLint `.swiftlint.yml`) as the baseline; do not suggest disabling rules without justification.
- Do not flag legacy patterns in untouched files; new code follows the established style.
