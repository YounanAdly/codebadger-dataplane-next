---
description: "Use when a change touches Java code. Enforces language correctness: exceptions, nullability, equality, immutability, and resource handling."
applyTo: "**/*.java"
---

# Java Language Rules

## Scope

Applies to every `.java` file: language-level correctness. Framework and test concerns have their own instruction files.

## Hard rules

1. **No swallowed exceptions**: empty catch, `catch (Exception e) {}`, or catch-log-continue on a bug path are findings — handle, wrap in the project's exception types, or propagate; never catch `Throwable`.
2. **Resources use try-with-resources**: streams, connections, readers, executors released on all paths; a resource acquired outside try-with-resources on an exception path is a finding.
3. **`equals`/`hashCode` are overridden together** and consistently for classes used in collections/maps; `==` on boxed types or strings (outside interned constants) is a finding — use `.equals`.
4. **No `null` returns for collections/optionals**: return empty collections or `Optional<T>` per the project's style; returning null where callers will dereference is a finding.

## Review rules

- Concurrency: shared mutable state is `volatile`/locked/immutable per the project's pattern — lazy-init without synchronization, `SimpleDateFormat` as a shared static, and check-then-act on maps are findings; prefer `java.util.concurrent` primitives.
- Integer overflow on arithmetic that can exceed `int` (ids, timestamps math) uses `long`/`Math.*Exact` where it matters.
- String/bytes: explicit `Charset` on `new String`/`getBytes`; `String.format`/text blocks over fragile concatenation where the project does so.
- Dates/times: `java.time` over legacy `Date`/`Calendar` in new code; `ZoneId` explicit on conversions; `Instant.now()` for timestamps per project usage.
- Immutability: value classes `final` fields, no setters where the project models values; records (Java 16+) where the project uses them.
- Streams: `Collectors.toMap` duplicate-key crashes (`IllegalStateException`) considered; parallel streams only where the project uses them and the work is truly CPU-bound.
- Generics: no raw types; bounded wildcards where the project uses them.
- Serialization: `Serializable`/deserialization of untrusted input is a finding; use the project's JSON/mapping layer.

## Anti-patterns to flag

```java
// BAD — swallowed, hides the failure
try { save(order); } catch (Exception e) { }

// BAD — resource leaks on exception path
InputStream in = new FileInputStream(path); parse(in); in.close();

// BAD — boxed comparison
if (status == Status.ACTIVE) { } // enum fine; Integer == Integer is not
```

## Preserve existing conventions

- Follow the project's Java version floor (records, switch expressions, pattern matching only where the JDK supports them) and its existing exception hierarchy — do not introduce a parallel one.
