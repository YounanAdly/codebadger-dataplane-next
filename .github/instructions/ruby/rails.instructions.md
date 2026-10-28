---
description: "Use when a change touches Rails (or Sinatra/Hanami) code: controllers, ActiveRecord, jobs, migrations. Applies only where the framework is actually used."
applyTo: "**/*.rb"
---

# Rails Framework Rules

## Scope

Applies when the change touches Rails controllers, models, jobs, or migrations. Non-framework Ruby yields to the Ruby pack. Applies only where the framework is actually used.

## Hard rules

1. **Authorization on every mutating action** (Pundit/ActionPolicy/cancancan or explicit checks per the project) — a new create/update/destroy action with no authorization is a critical finding.
2. **Strong parameters**: `permit` lists only the intended attributes — `permit!` and unfiltered `params` into models are critical findings.
3. **No secrets in committed config** (credentials edits aside, hardcoded keys/tokens in initializers/environments are findings).

## Review rules

- ActiveRecord discipline: N+1 fixed with `includes`/`preload`/`eager_load` where the change iterates associations; `find` vs `find_by` on user input (RecordNotFound → 404 handling per the project); callbacks kept for invariants, not orchestration — heavy side effects belong in jobs/service objects per the project.
- Queries: interpolated SQL (`where("name = '#{name}'")`) is a critical finding — placeholders/hash conditions; `order` with user input validated against an allow-list; `select` of sensitive columns on user-facing endpoints flagged.
- Transactions: multi-step writes in `ActiveRecord::Base.transaction` per the project; external calls (email, HTTP) not inside transactions where the project defers them (after_commit/jobs).
- Background jobs: idempotent with retry semantics per the project's ActiveJob config; arguments serializable and small (IDs, not AR objects); queue-specific concerns (Sidekiq uniqueness) respected.
- Migrations: reversible (`change` with `reversible`/`up`+`down` or `revert`); destructive changes planned per the SQL pack; `update_column`-style skipping validations used deliberately.
- Session/CSRF: `protect_from_forgery` intact; API-mode auth via the project's token mechanism; `skip_before_action :verify_authenticity_token` is a finding unless documented for an API namespace.
- View safety: `html_safe`/`raw`/`content_tag` with user input flagged; `sanitize` calls visible where rich text renders.

## Anti-patterns to flag

```ruby
# BAD — N+1 on a list action
@orders = Order.all
@orders.each { |o| o.customer.name } # one query per order

# BAD — interpolated condition
User.where("email = '#{params[:email]}'")

# BAD — permit! opens mass assignment
params.require(:user).permit!
```

## Preserve existing conventions

- Follow the project's Rails version and structure (controllers thin per its own convention) — review consistency, not ideology.
