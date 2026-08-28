# Python Review Rules

Apply when the pull request touches Python code: `.py` files, `pyproject.toml`, `requirements.txt`, `setup.py`.

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
12. Use `pytest` for testing, `mypy`/`ruff` for type/lint checking.
13. Prefer list comprehensions over map/filter for simple transforms.
14. Use dataclasses or pydantic for data models.

Severity guide:
- **critical**: SQL injection, hardcoded secrets, `eval`/`exec` on input, missing input validation, unsafe deserialization.
- **high**: bare excepts, mutable default arguments, missing type hints on public APIs, missing error handling on I/O.
- **medium**: naming violations, missing docstrings, unused imports.
- **low**: readability, formatting, minor optimizations.
