# Common API & Data Integrity Rules

These rules apply to every pull request that changes API behavior, data access, or persistence, regardless of language. They complement the language-specific rule packs; apply the language pack's mechanism where it is more specific.

- Request and response handling must match the contract actually served: validate payloads against the schema the endpoint declares, and reject unknown or malformed shapes explicitly instead of coercing silently.
- Breaking changes to public APIs, schemas, or message contracts are called out in the PR and stay backward-compatible unless the change documents its migration path; clients that the change cannot update must keep working.
- Multi-step writes that must succeed or fail together run inside a transaction (or the project's unit of work); error paths leave no half-committed state behind.
- Collection endpoints bound their cost: pagination or explicit limits on queries, responses, and request bodies; unbounded scans or payloads are findings.
- Retry policies apply only to idempotent operations; a non-idempotent write (payment, order creation, message send) needs an idempotency mechanism before retries are introduced.
- Duplicate side effects are prevented by the mechanism the project already uses (unique constraints, deduplication keys, transactional outbox) — do not reimplement them ad hoc in application code.
- Serialization stays consistent across endpoints: a field is not nullable in one response and required in another without a versioned reason, and DTO ↔ domain mapping does not silently drop fields.
- Schema migrations ship in the same change as the code that needs them (or document the deploy order); additive by default, reversible where the project requires it, and never destructive without an explicit reviewed plan.
