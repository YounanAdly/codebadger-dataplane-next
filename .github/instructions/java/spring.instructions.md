---
description: "Use when a Java change touches Spring (or Jakarta EE) code: beans, controllers, transactions, configuration. Applies only where the framework is actually used."
applyTo: "**/*.java,**/*.yml,**/*.properties"
---

# Spring Framework Rules

## Scope

Applies when the change touches Spring beans, controllers, security config, or transactions. Projects not using Spring: this file's rules yield to the Java pack. YAML/properties rules apply only to Spring config files.

## Hard rules

1. **`@Transactional` only where it works**: self-invocation (`this.method()`) bypasses the proxy; private methods are never advised; rollback happens for unchecked exceptions only unless `rollbackFor` is set — flag multi-step writes relying on a transaction that none of these provide.
2. **Every mutating endpoint authorizes** (Spring Security config/method security per the project) before touching state; a new POST/PUT/DELETE mapping with no security in its chain is a critical finding.
3. **No secrets in application.yml/properties** committed to the repo — externalized config or vault references; profile files with prod credentials are critical findings.

## Review rules

- Bean scope: mutable state in singleton beans (fields holding request data) is a thread-safety finding; use prototypes/request scope or method locals.
- Injection: constructor injection consistent with the project; `@Autowired` field injection only where the codebase already does it.
- JPA: N+1 from lazy relations iterated in loops — `join fetch`/`@EntityGraph` per the project; `getReferenceById` vs `findById` used intentionally; writes inside read-only transactions are findings.
- Controllers: `@Valid`/`BindingResult` (or the project's validation) on request bodies; `@PathVariable`/`@RequestParam` types validated; error handling via the project's `@ControllerAdvice`, not per-endpoint try/catch that swallows.
- Profile/config drift: new config keys present in the deployment profiles that matter (dev/staging/prod parity) or documented; flag keys added to one profile only when behavior depends on them.
- Async: `@Async` methods are public, called through the proxy, and use the project's executor — default `SimpleAsyncTaskExecutor` without bounds is a finding where the project configures others.
- Actuator/management endpoints exposed publicly without security are critical.

## Anti-patterns to flag

```java
// BAD — self-invocation bypasses the transaction
public void submit() { persist(); }          // no tx
@Transactional protected void persist() { }  // never advised

// BAD — singleton holds per-request state
@RestController class O {
  private Order current; // shared across all requests
}

// BAD — open management endpoint
management.endpoints.web.exposure.include: "*"   # no security
```

## Preserve existing conventions

- Follow the project's existing Spring version and idioms (XML-era config aside); do not demand migration to newer idioms in a feature PR.
