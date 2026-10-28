---
description: "Use when a PHP change adds or modifies tests. Enforces meaningful PHPUnit-style tests with the project's existing stack."
applyTo: "**/tests/**,**/test/**,**/*Test.php"
---

# PHP Testing

## Scope

Applies to PHP test files (PHPUnit/Pest as configured) and the testability of changed production code.

## Review rules

1. **Changed behavior gets tests** using the project's stack (PHPUnit attributes/annotations or Pest style as configured) — no second test framework in one PR.
2. **Tests are deterministic**: frozen time, no real network/HTTP (mock clients per the project), database refreshed via the project's transaction/refresh pattern.
3. **Assert behavior**: response status/JSON, returned values, model state — `$this->assertTrue(true)`-style non-assertions and empty tests are findings.
4. **Error and edge paths covered**: validation errors, empty results, permission denials.
5. **Data builders/factories per the project** (Laravel factories, doctrine fixtures); tests isolated — no order dependence on self-seeded tables.
6. **No weakened assertions**: loosened/removed assertions to pass a change are findings.

## Anti-patterns to flag

```php
// BAD — no assertion
public function testSearch(): void { $this->get('/search?q=x'); }

// BAD — order-dependent fixture state
$this->insertSeedOnce(); // assumes a prior test ran first
```

## Preserve existing conventions

- Match the project's test layout (Unit/Feature, *Test suffix) and assertion style; do not demand coverage of trivial getters.
