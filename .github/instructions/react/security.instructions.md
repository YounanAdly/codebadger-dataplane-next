---
description: "Use when a React/TS change touches rendering of untrusted content, secrets, client storage, or auth UX. Enforces frontend security without pretending the client is a security boundary."
applyTo: "**/*.tsx,**/*.jsx,**/*.ts,**/*.js"
---

# React & Frontend Security

## Scope

Applies to untrusted-content rendering, secret exposure, storage, and client-side auth UX. Applies to `.ts`/`.js` too (shared utils, API clients in the frontend bundle). Client-side checks are UX, not authorization — the server decides.

## Hard rules

1. **No unsanitized HTML injection**: `dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML` with anything user- or API-provided is a finding unless sanitized in the same change (DOMPurify or equivalent) with the sanitization point visible.
2. **No secrets in the client bundle**: API keys, tokens, service credentials reachable by `import.meta.env`/`process.env` without the `NEXT_PUBLIC_`/Vite-public prefix contract, hardcoded strings, or embedded in client-fetched configs are critical findings — anything shipped to the browser is public.
3. **`window.open`/links with untrusted URLs use `rel="noopener noreferrer"`**; `javascript:`/`data:` URLs from user input are findings.
4. **Tokens/PII are not persisted in `localStorage`/`sessionStorage`** where the project has a safer pattern (httpOnly cookies, memory + refresh) — flag new plaintext token storage; follow the project's existing auth storage if it has one.

## Review rules

- `eval`, `new Function`, and dynamic `import()` of user-influenced specifiers are findings.
- `postMessage` handlers validate `event.origin` and the message shape before acting.
- Auth in the client is UX only: hiding a button/route is fine, but the review must not describe it as securing anything — flag API-facing claims that rely on client-side checks.
- File downloads/uploads: validate types/sizes client-side where the project does, and never trust client names for server paths (server pack covers the server side).
- CSP/meta changes, `document.domain`, `target="_blank"` chains, and iframe `allow` attributes are reviewed consciously — flag silent security-config downgrades.
- Sensitive data (tokens, PII) is not logged via `console.*` in production paths.

## Anti-patterns to flag

```tsx
// BAD — user content straight into the DOM
<div dangerouslySetInnerHTML={{ __html: comment.body }} />

// BAD — key readable by every visitor
const res = await fetch(`https://api.example.com/data?key=${import.meta.env.VITE_API_KEY}`);

// BAD — unvalidated message origin
window.addEventListener("message", (e) => eval(e.data.action));
```

## Preserve existing conventions

- If the project deliberately serves sanitized rich text through a pipeline, review the diff's integration with that pipeline instead of re-litigating it.
- Client-only validation that duplicates server validation is good UX — flag only when it is presented as the only gate.
