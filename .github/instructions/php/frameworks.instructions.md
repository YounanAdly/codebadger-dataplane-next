---
description: "Use when a PHP change touches Laravel or Symfony code: controllers, Eloquent/Doctrine, queues, validation. Applies only where the framework is actually used."
applyTo: "**/*.php"
---

# PHP Framework Rules (Laravel / Symfony)

## Scope

Applies when the change touches framework code: controllers, ORM models, queues, validation, config. Pure-PHP code yields to the PHP pack. Applies only where the framework is actually used.

## Hard rules

1. **Every mutating endpoint authorizes** (middleware, policies/gates, voters per the project) before touching state — a new POST/PUT/DELETE route with no auth in its chain is a critical finding.
2. **Mass assignment protected**: fillable/g guarded or explicit DTO/hydration per the project — request arrays straight into model constructors/repositories are findings.
3. **No secrets in committed config** (`.env` values, service credentials in `config/*.php`) — externalized per the project.
4. **Queued jobs are safe to retry**: idempotent handling or unique job locks per the project; jobs relying on in-memory state are findings.

## Review rules

- Eloquent/Doctrine discipline: N+1 fixed with eager loading (`with`/`JOIN` fetch) where the change loops relations; chunking on large updates; raw expressions parameterized (`DB::raw` with bindings, DQL parameters).
- Transactions: multi-step writes wrapped (`DB::transaction`, Doctrine `beginTransaction` per the project); side effects (mail, API calls) not inside transactions where the project defers them.
- Validation: form requests/validator/contraints per the project on request input; raw `$_GET`/`$_POST`/`request()->all()` into queries flagged.
- Output escaping: Blade `{{ }}`/Twig auto-escaping intact — `{!! !!}`/`|raw` only on sanitized trusted content.
- Session/auth: session regeneration on login per framework defaults; stateful API auth follows the project's token mechanism; CSRF middleware present on state-changing web routes.
- Storage/files: `Storage` facade/disk abstractions per the project; user-controlled paths never concatenated into local disk access.
- Config/cache: config cached in production per deployment practice; cache invalidation on model changes where the project invalidates.

## Anti-patterns to flag

```php
// BAD — mass assignment from the request
User::create($request->all());

// BAD — N+1 on a list endpoint
foreach (Order::all() as $order) { echo $order->customer->name; }

// BAD — raw query with interpolation
DB::select("SELECT * FROM users WHERE name = '" . $name . "'");
```

## Preserve existing conventions

- Follow the project's framework version and established structure (actions/services/controllers) — review consistency, not ideology.
