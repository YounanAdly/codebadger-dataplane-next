---
description: "Use when a change touches Ruby code. Enforces language correctness: exceptions, mutation, blocks, and unsafe evaluation."
applyTo: "**/*.rb"
---

# Ruby Language Rules

## Scope

Applies to every `.rb` file: language-level correctness. Rails concerns have their own instruction file.

## Hard rules

1. **No swallowed exceptions**: `rescue => e` with an empty body, `rescue nil`, and bare `rescue` on bug paths are findings — handle specific errors, log via the project's logger, or re-raise; `raise` inside `ensure` without care loses the original exception.
2. **No `eval`, `send`/`public_send` with user-influenced method names, `constantize`/`Object.const_get` on untrusted input, or `YAML.load` (use `safe_load`)** — critical findings.
3. **Mutation of shared state is deliberate**: class-level variables/attributes (`@@x`, `class_attribute`) mutated per-request are findings unless the project synchronizes them; frozen literals respected (`# frozen_string_literal: true` — `<<` on a frozen string raises).

## Review rules

- Blocks/procs: `&block` captured and reused correctly; `lambda` vs `Proc` return semantics where it matters; `define_method` with dynamic names validated.
- Equality/collection: classes used as hash keys/sets define `eql?`/`hash`; `Array#each` return value relied upon; `sum`/`inject` initial values on empty collections.
- Numbers/strings: `to_i` silently truncating (`"12abc".to_i # => 12`) on validated inputs flagged where strict parsing matters (`Integer()`); string mutation vs builders on hot paths per project style.
- Time: `Time.now` vs `Time.current`/`Time.zone.now` consistent with the project (naive local time is the classic bug); `Date.parse` on user input validated.
- Splat/kwargs: `**options` swallowing typos silently — explicit keys where the project is explicit; `hash` args without braces ambiguity on Ruby <3.
- Threads: `Thread.new` without join/abort-on-error in request paths is a finding; `Mutex`/`Concurrent` primitives where the project uses them.
- Frozen/magic comments, `Encoding` at file boundaries consistent with the project.

## Anti-patterns to flag

```ruby
# BAD — swallows everything
begin
  charge(order)
rescue StandardError
end

# BAD — dynamic dispatch on user input
object.public_send(params[:action])

# BAD — per-request state on a class variable
@@last_order = order
```

## Preserve existing conventions

- Respect the project's Ruby version floor (pattern matching, endless methods only where supported) and RuboCop config — review consistency, not ideology.
