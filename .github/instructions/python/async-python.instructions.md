---
description: "Use when a Python change uses asyncio, threads, or processes. Enforces event-loop discipline, cancellation safety, and correct executor use."
applyTo: "**/*.py"
---

# Python Async & Concurrency

## Scope

Applies to `asyncio`, threading, multiprocessing, and executor use. Language basics belong to the Python pack.

## Hard rules

1. **No blocking calls inside `async def`**: `time.sleep`, sync `requests`/DB drivers, `open().read()` of large files, or CPU-heavy work on the event loop are findings — use `asyncio.sleep`, async clients, `run_in_executor`/`to_thread`, with the payload-size evidence.
2. **Tasks are referenced**: fire-and-forget `asyncio.create_task(...)` results are kept (or run through the project's task utility) — an unreferenced task can be garbage-collected mid-flight; errors from unreferenced tasks vanish.
3. **Cancellation is safe**: `except asyncio.CancelledError` re-raises; cleanup runs in `finally`; a cancelled task must not swallow cancellation or continue writing shared state.

## Review rules

- Race conditions on shared state across tasks: `await` boundaries interleave — invariants spanning multiple reads/writes need a lock (`asyncio.Lock`) or single-task ownership, per the project's pattern.
- `asyncio.gather` with `return_exceptions=True` handles failures explicitly; `gather` on an empty/edge input set is checked.
- Unbounded concurrency: `gather` over unbounded input (all rows × N requests) needs a semaphore/batch per the project's limit pattern — thundering-herd request bursts are findings.
- Threads: `threading.Lock` around non-atomic read-modify-write; daemon threads with no shutdown path in long-running services are findings; `queue.Queue` for hand-offs.
- Executors: `ThreadPoolExecutor` for IO-bound blocking libs, `ProcessPoolExecutor` for CPU-bound work — pickling constraints ( closures, unpicklable args) respected.
- Timeouts: `asyncio.wait_for`/`timeout` on external I/O where the project sets them; a hung connection with no timeout is a finding.
- Session/client reuse: per-call `requests.Session`/`aiohttp.ClientSession` creation in loops is a finding where the project reuses clients.

## Anti-patterns to flag

```python
# BAD — blocks the loop for every concurrent request
async def fetch(url):
    return requests.get(url).json()

# BAD — task dropped, errors never observed
asyncio.create_task(worker()); # no reference kept

# BAD — unbounded gather
await asyncio.gather(*[fetch(u) for u in all_million_urls])
```

## Preserve existing conventions

- Sync Django/Flask code is not a finding for lacking asyncio; async codebases reviewed by asyncio rules, sync ones by threading rules — do not demand a paradigm switch.
