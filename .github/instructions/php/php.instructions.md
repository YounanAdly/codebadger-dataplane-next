---
description: "Use when a change touches PHP code. Enforces language correctness: types, comparisons, error handling, and safe serialization."
applyTo: "**/*.php"
---

# PHP Language Rules

## Scope

Applies to every `.php` file: language-level correctness. Framework concerns have their own instruction file.

## Hard rules

1. **Strict comparisons for logic** (`===`/`!==`) — `==` with user input (`0 == 'foo'` history, string/number juggling) is a correctness/security finding on auth/permission/price paths; `in_array` without the third `true` argument where types matter.
2. **No `unserialize()` on untrusted input** — use JSON or `allowed_classes: false`; `eval`, `assert`, and `preg_replace /e` on input are critical findings.
3. **Errors are handled**: error-suppression `@`, empty `catch`, and `catch (\Throwable)` that only continues on bug paths are findings; `try/catch` around specific exception types per the project's hierarchy.
4. **Resources use `finally`/RAII-style cleanup**: file handles, transactions, connections released on error paths.

## Review rules

- Types: declare parameter/return types per the project's strictness (`declare(strict_types=1)` respected); implicit float/int coercion on money/quantity math flagged; `=== null` checks over `empty()` for values where `0`/`"0"`/`" "` are meaningful (the classic `empty()` trap).
- Strings/arrays: `array_search` false-vs-0 result handled; `array_merge` vs `+` semantics on keys; mb_* functions for user text where the project uses them.
- Date/time: `DateTimeImmutable` over mutable `DateTime` where the project uses it; explicit `DateTimeZone` on conversions; `time()`/`date()` mixing flagged when timezone matters.
- Comparisons/identity: `switch` without `break` fallthroughs unless commented; loose boolean coercion of request values in conditions.
- Serialization of value objects follows the project's mapping (Symfony serializer/Eloquent casts) — no ad-hoc `serialize` of objects with side effects.
- Composer: justified dependency additions; script/`post-*` hooks changes reviewed.

## Anti-patterns to flag

```php
// BAD — juggling comparison on a permission check
if ($_GET['role'] == 1) { grantAdmin(); }

// BAD — suppressed error hides the failure
$data = @file_get_contents($url);

// BAD — untrusted deserialization
$settings = unserialize($_COOKIE['settings']);
```

## Preserve existing conventions

- Respect the project's PHP version floor (enums, readonly, first-class callables only where supported) and its PSR/CMF style — review consistency, not ideology.
