# SQL & Database Review Rules

Apply when the pull request touches SQL code: `.sql` files, migrations, schema changes.

1. No string interpolation or concatenation of user input into SQL — parameterized queries or the project's query builder, including inside migrations that execute dynamic SQL.
2. Destructive schema changes (`DROP TABLE`, `DROP COLUMN`, type changes that rewrite data, `TRUNCATE`) must be explicit in the PR description and reversible or phased; silent data loss is a critical finding.
3. Migrations run before the code that needs them ships: a deploy that removes a column while old code still reads it, or adds a `NOT NULL` column without a default/backfill plan, is a finding.
4. Long migrations on large tables note their locking behavior (index builds, `ALTER`s that take exclusive locks) where the database supports it.
5. Joins: verify the join keys actually relate (no cross joins from a missing `ON`), and joins that fan out unexpectedly duplicate rows in aggregates — check `GROUP BY` matches the intended grain.
6. Aggregation correctness: `COUNT(*)` vs `COUNT(col)` null semantics, `NULL`-ignoring aggregates (`SUM`/`AVG`) with a documented `COALESCE` where the consumer expects zero.
7. Pagination and ordering are deterministic: `ORDER BY` on a non-unique key needs a unique tiebreaker, or pages will drop/duplicate rows.
8. Transactions: multi-statement writes that must succeed together are wrapped in a transaction with the project's isolation defaults; new `SET TRANSACTION ISOLATION LEVEL` overrides need justification.
9. Constraints: new foreign keys, unique constraints, and `NOT NULL`s match the data reality — adding a constraint that existing rows violate fails the migration.
10. Indexes are recommended only with a concrete query pattern from the change (a new filter/join/sort in this diff), weighing write cost; do not demand indexes speculatively.
11. seeded/fixture data and query files must not contain real customer data, production credentials, or secrets.
12. Follow the project's migration tool and naming conventions (Flyway, Liquibase, Alembic-generated SQL, EF migrations); do not hand-edit applied migrations.

Severity guide:
- **critical**: SQL injection via dynamic SQL, destructive/irreversible migration without a plan, secrets or PII in seeded data, migrations that corrupt referential integrity.
- **high**: undeterministic pagination, missing transaction boundaries on multi-step writes, constraint-breaking migrations, deploy-order mismatches.
- **medium**: missing tiebreakers, speculative index suggestions, naming-convention breaks.
- **low**: formatting, readability.
