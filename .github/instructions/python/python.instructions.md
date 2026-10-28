---
description: "Use when a change touches Python code. Enforces language correctness: exceptions, mutability, typing, resources, and concurrency assumptions."
applyTo: "**/*.py"
---

# Python Language Rules

## Scope

Applies to every `.py` file: language-level correctness. Web-framework and test concerns have their own instruction files.

## Hard rules

1. **No bare `except:`** and no `except Exception` that only passes/logs-and-continues on a bug path — catch the specific types the code can handle; rethrow or propagate the rest. Preserve exception chaining (`raise ... from e`) where the project does.
2. **No `eval`/`exec`, no `pickle.loads`/`yaml.load` on untrusted input** (use `yaml.safe_load`) — critical findings.
3. **No mutable default arguments** (`def f(items=[])`) — use `None` + initialize inside.
4. **Resources use context managers**: files, connections, sessions, locks via `with`/`async with`; a resource acquired without a guaranteed release on an error path is a finding.

## Review rules

- Mutable shared state: module-level mutable globals mutated by request handlers/tasks need the concurrency discipline the project uses (locks, per-request state); a dataclass/dict default shared across requests is a bug.
- Typing: public signatures annotated per the project's typing policy (strictness varies) — flag untyped new public functions only where the project annotates consistently; respect `py.typed`/`mypy` config.
- String/bytes boundaries: explicit encodings on `open()`, no `str`/`bytes` mixing on network/file edges; `datetime.now()` vs `utcnow()`/`now(timezone.utc)` consistent with the project (naive vs aware datetimes are a classic timezone bug).
- Number handling: float money math without `Decimal` where the project uses `Decimal`; integer division assumptions (`//` vs `/`).
- Iterators/generators: functions returning a shared mutable list argument or a generator consumed twice (`len(gen)`, re-iteration) are findings.
- `is` only for sentinels/identity, never for value comparison (`is None` fine; `x is "foo"` not); `== None` → `is None` where the project's style says so.
- Dependency pins: `requirements`/`pyproject` changes justified; flag wildcard pins added for production deps.

## Anti-patterns to flag

```python
# BAD — swallows everything, hides the bug
try:
    process(order)
except:
    pass

# BAD — shared default mutated across calls
def add_item(item, items=[]):
    items.append(item); return items

# BAD — naive datetime mixed with aware elsewhere
run_at = datetime.now() + timedelta(days=1)
```

## Preserve existing conventions

- Follow the project's formatting (black/ruff), import style, and Python version floor — do not suggest 3.12+ syntax on a 3.9 project.
