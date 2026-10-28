# Java Review Rules

Platform detection signals: `pom.xml`, `build.gradle`, `.java` files, `src/main/java`.

This file is the **loading index** for Java review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/java/`:

- .github/instructions/java/java.instructions.md — language correctness: exceptions, try-with-resources, equals/hashCode, concurrency, java.time
- .github/instructions/java/spring.instructions.md — Spring: transactions (proxy/self-invocation), bean scopes, JPA N+1, security config, secrets
- .github/instructions/java/testing.instructions.md — JUnit/Mockito behavior assertions with the project's stack

## Baseline rules (always loaded)

1. Never use string concatenation in SQL — use `PreparedStatement` or parameterized APIs.
2. No hardcoded secrets — use configuration/vault injection.
3. Always close resources — use try-with-resources.
4. Use `Optional` for return types that may be null.
5. Use dependency injection (constructor injection or the project's framework).
6. Never catch `Exception`/`Throwable` broadly; handle specific exceptions.
7. Use `final` for fields where possible; prefer immutability.
8. Use the Stream API for collection operations where clearer.
9. Follow Java naming: camelCase methods, PascalCase classes.
10. Add Javadoc to public interfaces.
11. Use `@Transactional` properly — not on private methods.
12. Test with the project's existing stack (JUnit 5 + Mockito and Testcontainers where already used).
13. Use records for immutable data carriers (Java 16+).
14. Prefer `List.of()` / `Map.of()` over mutable collections for constants.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, resource leaks, unsafe deserialization.
- **high**: missing exception handling, thread-safety issues, mutable shared state.
- **medium**: naming violations, missing Javadoc, missing tests.
- **low**: readability, formatting, minor optimizations.
