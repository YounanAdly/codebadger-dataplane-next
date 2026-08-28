# Common Testing Rules

These rules apply to every pull request regardless of platform.

- Behavior changes require tests: add or update tests covering the changed logic.
- Test the changed unit at the appropriate level (unit, widget/component, integration) using the platform's standard framework.
- New bug fixes should include a regression test that fails without the fix.
- Tests must assert meaningful outcomes — not just "does not throw".
- Do not weaken or delete existing assertions to make tests pass.
- Tests must be deterministic: no reliance on wall-clock time, network, or execution order unless explicitly mocked.
- Cover error and edge paths (empty input, null/missing data, failures), not only the happy path.
- Do not test generated code, third-party library internals, or trivial getters.
