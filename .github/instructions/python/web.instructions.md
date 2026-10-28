---
description: "Use when a Python change touches web request handling (Django views, FastAPI/Flask routes, serializers). Enforces validated, authenticated endpoints with safe ORM and query use."
applyTo: "**/views.py,**/urls.py,**/serializers.py,**/api/**,**/routers/**,**/endpoints/**,**/routes/**,**/handlers/**"
---

# Python Web Layer

## Scope

Applies to HTTP-facing Python: Django views/serializers, FastAPI routers, Flask views. Language and async mechanics have their own instruction files.

## Hard rules

1. **Every mutating endpoint authenticates and authorizes** (framework dependency/middleware/permission per the project) before touching state — a new POST/PUT/DELETE route with no auth in its chain is a critical finding.
2. **No SQL built by string formatting**: f-strings/`.format()`/`%` with variables into `execute()` are critical findings — parameterized queries or the ORM's API.
3. **Request input is validated** (Pydantic/DRF serializers/marshmallow/wtforms per the project) before use — `request.json()` raw-dict access into business logic is a finding where the project validates elsewhere.
4. **Error responses do not leak internals**: exception text, tracebacks, or driver errors to clients are findings — follow the project's exception handlers.

## Review rules

- ORM discipline: N+1 query patterns fixed with `select_related`/`prefetch_related`/`joinedload` where the change adds a loop over related objects; `objects.get()`/`QuerySet.get()` on user input wrapped for DoesNotExist/NoResultFound — unhandled 500s are findings.
- Mass assignment: DRF serializers expose only intended fields; `**request.data`-style model construction is a finding.
- Transactions: multi-step writes use `atomic()`/session transactions per the project; a half-committed flow on error is a finding.
- File uploads: size/type checks per the project's pattern; user-controlled paths never join into filesystem access without sanitization.
- Long work off the request: heavy tasks go through the project's queue (Celery/RQ/Django-Q/background tasks) — synchronous heavy work inside a view with evidence of cost is a finding.
- Pagination: list endpoints bound results per the project's paginator; unbounded `all()` returned to clients is a finding.
- Flask specifics: `debug=True` outside dev, secrets in source, and `send_file` on user-controlled paths are findings.

## Anti-patterns to flag

```python
# BAD — string-built SQL
cursor.execute(f"SELECT * FROM users WHERE name = '{request.args.get('name')}'")

# BAD — object-level permission assumed, never checked
@router.delete("/items/{item_id}")
def delete_item(item_id: int, user=Depends(get_user)):
    Item.objects.get(id=item_id).delete()  # any logged-in user can delete anything

# BAD — unbounded list response
return {"orders": Order.objects.all()}
```

## Preserve existing conventions

- Follow the project's framework idioms (DRF viewsets vs APIView, FastAPI dependency style, Flask blueprints) — review consistency, not ideology.
