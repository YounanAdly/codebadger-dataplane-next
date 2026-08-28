# Java Review Rules

Apply when the pull request touches Java code: `.java` files, `pom.xml`, `build.gradle`, `src/main/java`.

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
12. Test: JUnit 5 + Mockito for unit tests, Testcontainers for integration.
13. Use records for immutable data carriers (Java 16+).
14. Prefer `List.of()` / `Map.of()` over mutable collections for constants.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, resource leaks, unsafe deserialization.
- **high**: missing exception handling, thread-safety issues, mutable shared state.
- **medium**: naming violations, missing Javadoc, missing tests.
- **low**: readability, formatting, minor optimizations.
