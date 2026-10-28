---
description: "Use when a change adds or modifies Ruby tests. Enforces meaningful RSpec/Minitest tests with the project's existing stack and fixtures."
applyTo: "**/spec/**,**/test/**,**/*_spec.rb,**/*_test.rb"
---

# Ruby Testing

## Scope

Applies to Ruby test files (RSpec/Minitest as configured) and the testability of changed production code.

## Review rules

1. **Changed behavior gets tests** using the project's stack (RSpec or Minitest with its existing matchers/factories) — no second framework in one PR.
2. **Tests are deterministic**: frozen time (`travel_to`/Timecop), no real network (VCR/WebMock per the project), database via transactional fixtures/truncation per the project's strategy.
3. **Assert behavior**: returned values, HTTP status/body, persisted state — `expect(result).to be_truthy` on complex logic is too weak; one expectation per behavior where the project keeps that style.
4. **Error and edge paths covered**: validation failures, empty results, authorization denials — not only happy paths.
5. **Isolation**: `before` hooks don't leak shared mutable state; factories (FactoryBot) over hand-built fixtures where the project uses them; no reliance on spec execution order.
6. **No weakened assertions**: removed/loosened expectations to pass a change are findings; `allow` stubs that bypass the actual code under test flagged when the test no longer exercises the behavior.

## Anti-patterns to flag

```ruby
# BAD — no meaningful assertion
it "searches" do
  get :search, params: { q: "x" }
end

# BAD — order dependence
before { @@cache ||= warm_up } # depends on a previous spec
```

## Preserve existing conventions

- Match the project's spec style (request/system/model layout, let/before conventions); do not demand 100% coverage — test the risk the change adds.
