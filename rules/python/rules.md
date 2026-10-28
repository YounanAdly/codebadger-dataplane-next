# Python Review Rules

Platform detection signals: `pyproject.toml`, `requirements.txt`, `setup.py`, `.py` files.

This file is the **loading index** for Python review rules. The rule loader reads the
`## Instruction files` section below and inlines every referenced instruction file whose
`applyTo` scope matches the pull request's changed files — web-layer or test rules load
only when the diff touches those files. The baseline rules below always load.

## Instruction files

Independent, self-contained instruction packages under `.github/instructions/python/`:

- .github/instructions/python/python.instructions.md — language correctness: exceptions, mutable defaults, typing, context managers, datetime/bytes pitfalls
- .github/instructions/python/async-python.instructions.md — asyncio/threading discipline: no blocking on the loop, task references, cancellation, bounded concurrency
- .github/instructions/python/web.instructions.md — Django/FastAPI/Flask request layer: auth, parameterized ORM/SQL, validation, N+1, queues
- .github/instructions/python/testing.instructions.md — pytest-style deterministic tests with the project's fixtures

## Baseline rules (always loaded)

1. Never use `eval()`, `exec()`, or `pickle.loads()` on untrusted input.
2. Use parameterized queries — never string-format SQL.
3. No hardcoded secrets — use environment variables or a vault.
4. Use `typing` for all public function signatures.
5. Use f-strings or `str.format()` — not `%` formatting.
6. Handle specific exceptions — never bare `except:`.
7. No mutable default arguments (use `None` + guard).
8. Use `pathlib` over `os.path` for file operations.
9. Use context managers (`with`) for file/resource handling.
10. Follow PEP 8 naming: snake_case functions, PascalCase classes.
11. Add docstrings to public functions and classes.
12. Test with the project's existing runner (`pytest` where used) and respect its configured type/lint tooling (`mypy`/`ruff`).
13. Prefer list comprehensions over map/filter for simple transforms.
14. Use dataclasses or pydantic for data models.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, `eval`/`exec` on input, missing input validation, unsafe deserialization.
- **high**: bare excepts, mutable default arguments, missing type hints on public APIs, missing error handling on I/O.
- **medium**: naming violations, missing docstrings, unused imports.
- **low**: readability, formatting, minor optimizations.
