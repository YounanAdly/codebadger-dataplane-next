---
description: "Use whenever you call an HTTP/API endpoint, subscribe to an Observable, or coordinate async work. Angular 22 contract for timeouts, retries, cancellation, race conditions, loading state, mutations, and the exact error-status matrix so no failure path is ever silent."
applyTo: "src/app/**/*.ts,src/app/**/*.html"
---

# API Calls & Async Handling (Angular 22)

Single source of truth for **every HTTP call, every Observable subscription, and every async submit** in the app. If a screen touches an endpoint, it must follow this file.

Pairs with [error-handling.instructions.md](./error-handling.instructions.md) (toast / i18n) and [shared-reuse.instructions.md](./shared-reuse.instructions.md) (service reuse).

---

## 1. Stack — the order you must try in

For any new data-fetching feature, pick the **first option that fits**, not your favourite:

| Priority | API | Use it when |
|---|---|---|
| 1 | `httpResource<T>()` | Reactive **read** from an HTTP endpoint driven by signals (route params, filters, page, language). Default choice for v22. |
| 2 | `rxResource()` | The producer is already an Observable (an existing service method returning `Observable<T>`), and you want signal ergonomics in the component. |
| 3 | `resource()` | Async work that is **not HTTP** (e.g. file read, geolocation, custom `fetch` with streaming/abort) and you want signal-shaped loading/error/value. |
| 4 | RxJS via a feature service that extends `BaseCrudService<T>` | **Mutations** (POST / PUT / PATCH / DELETE), uploads, or anything that must be triggered by a user action — never by a signal change. |
| 5 | Raw `HttpClient` | **Never in a component.** Only inside a service that extends `BaseCrudService<T>`. |

Anti-rule: never use `BehaviorSubject<T>` + manual `.next()` plumbing for read state in v22 — use a resource.

---

## 2. Architecture you must use

| Concern | Where it lives | Rule |
|---|---|---|
| HTTP backend | [app.config.ts](../../src/app/app.config.ts) — `provideHttpClient(withFetch(), withInterceptors([...]))` | Use the **`fetch` backend** (`withFetch()`) — required for HTTP streaming, better SSR transfer, and `AbortSignal` integration in v22. |
| Auth header, `Accept-Language`, `Source` | [auth.interceptor.ts](../../src/app/shared/interceptors/auth.interceptor.ts) | Already applied to every request. Never set these headers manually. |
| Global spinner | [loader.interceptor.ts](../../src/app/shared/interceptors/loader.interceptor.ts) + [loader.service.ts](../../src/app/shared/services/loader.service.ts) | Counts in-flight requests via signal. Do not toggle per-call spinners. |
| HTTP error funnel (401 / 403 / 422 / 0 / 503 / 5xx) | [error.interceptor.ts](../../src/app/shared/interceptors/error.interceptor.ts) | Components handle only 2xx and **domain** 4xx (400 / 404 / 409 / 422 / 429). |
| Generic CRUD verbs | [base-crud.service.ts](../../src/app/shared/services/base-crud.service.ts) | Extend or inject — never call `HttpClient` from a component. |
| Endpoints | [constants.ts](../../src/app/constants.ts) | Add a `static` field; never inline a URL string. |
| Base URL | [environment.ts](../../src/environments/environment.ts) | Already prefixed by `BaseCrudService`. Do not re-prefix. |
| Toasts | [toast.service.ts](../../src/app/shared/services/toast.service.ts) | Translation-aware + `LiveAnnouncer`. Never inject PrimeNG `MessageService` directly. |

---

## 3. Hard rules (zero exceptions)

1. **No `HttpClient` in components.** Inject a feature service that extends `BaseCrudService<T>` or wraps it.
2. **No inline URLs.** Add a `static` field on `Constants` and reference it.
3. **Reads default to `httpResource()`** (or `rxResource` if the source is RxJS). Manual `.subscribe()` for a read is a fallback, not the norm.
4. **Every component-side `.subscribe()` is cancellation-safe** — pipe `takeUntilDestroyed(inject(DestroyRef))` (resources handle teardown automatically — they cancel the previous request and abort on destroy via an internal `AbortController`).
5. **Race-prone reads use a resource** with a reactive request factory. The runtime aborts the in-flight request when any read signal changes. Don't hand-roll `switchMap` for resource-shaped reads.
6. **Submit handlers must be idempotency-safe.** Use a `submitting = signal(false)` guard, set it `true` before the call, reset in `finalize()`, and bind it to the button's `[disabled]` + `[attr.aria-busy]`. Never rely on the global spinner to block double-submits.
7. **Mutations never go through a resource.** Resources are for read state. Writes go through a service method returning `Observable<T>` (or `Promise<T>`) and are called from event handlers only.
8. **Optimistic updates use `httpResource().set(...)` / `.update(...)`** and roll back on error. Don't keep a parallel `signal()` mirror of the resource value.
9. **Derived/seeded state uses `linkedSignal()`** — never `effect(() => signal.set(...))`. Effects must not write to signals that other reads depend on.
10. **Every transport failure surfaces a translated message.** Either the interceptor toasts it (5xx / 0 / 503) or your component renders the `resource.error()` branch. Never silently swallow.
11. **No component-local `try/catch`, `hasError` flag, `console.error`, or `alert()`** for HTTP. (Hard rule from [error-handling.instructions.md](./error-handling.instructions.md).)
12. **SSR-safe triggers.** `httpResource()` and `resource()` prefetch on the server during prerender — keep request params SSR-resolvable (don't read `window` / `localStorage` inside the request factory; gate browser-only triggers with `isPlatformBrowser(inject(PLATFORM_ID))`).
13. **Per-call interceptor opt-outs use `HttpContextToken`s**, never URL allow-lists or custom headers. Long-running uploads/deletes pass `context: skipLoader()` to disable the global spinner; sensitive calls use `skipErrorToast()` to handle their own failure UI. See §17.
14. **Cross-cutting service SLAs** (`timeout()`, `retry()` with backoff, `Retry-After` honoring) live **once** in `ResilientCrudService` (§13) and are inherited via service inheritance — never re-declared per call.
15. **Adaptive timeouts.** Read SLAs come from `NetworkService.readTimeoutMs()` so 2G/3G clients don't fail fast. Never hardcode a millisecond literal in a `timeout(...)` call.
16. **`AbortError` from a cancelled resource is expected** (the runtime aborts the previous fetch when a reactive input changes). Detect with `e instanceof DOMException && e.name === 'AbortError'` — never toast it. See §20.
17. **`toSignal()` / `toObservable()` must run inside an injection context** — at field-initializer level or inside a constructor / `inject()` factory. Calling them from a regular method throws `NG0203` at runtime in v22.
18. **SSR rehydration cache is mandatory.** `provideClientHydration` must include `withHttpTransferCacheOptions({...})` — without it `httpResource` re-fetches every GET on the client right after hydration (double network cost + visible flicker).

---

## 4. Status-code responsibility matrix

| Status | Handled by | Component must do |
|---|---|---|
| `2xx` | Component | Happy path. Write actions can call `ToastService.success('...')`. |
| `400` | Component | Read `err.error` for field/business message; show contextual toast or inline. |
| `401` | `errorInterceptor` → `/:lang/login` | Nothing. |
| `403` | `errorInterceptor` → `/:lang/not-found` | Nothing. |
| `404` | Component (endpoint-specific) | Empty-state UI or `errors.notFoundTitle` toast. |
| `408` | Component | `ToastService.warn('errors.timeoutTitle', 'errors.timeoutDetail')` + offer retry. |
| `409` | Component | `ToastService.error('errors.conflictTitle', 'errors.conflictDetail')` + offer reload. |
| `422` | Component | Walk `err.error.errors` / `err.error.details` → map to Formly `FormControl.setErrors`. **Do not toast** — surface inline. |
| `429` | Component | `ToastService.warn('errors.rateLimitTitle', 'errors.rateLimitDetail')`. No auto-retry. |
| `0` / `503` | `errorInterceptor` (`errors.network*`) | Nothing. **Exception:** when the response carries `Retry-After`, `ResilientCrudService` schedules a single delayed retry (§13) — the component still does nothing. |
| `5xx` (other) | `errorInterceptor` (`errors.server*`) | Nothing. |
| RxJS `TimeoutError` | Service-layer `timeout()` → component's `error:` | Treat as `408`. Detect with `err instanceof TimeoutError` from `'rxjs'`. |
| `AbortError` from resource | Runtime (expected on re-fetch) | Nothing. Detect with `e instanceof DOMException && e.name === 'AbortError'` — never toast. |
| Network drop (browser `offline` event) | Component (optional) | Surface a passive banner; pending resources will reload automatically when `online` fires (§19). |

Rule of thumb: **only domain 4xx logic belongs in components.** Everything else is the interceptor's job.

---

## 5. Operator / API requirements per call type

| Call type | Required API | Reason |
|---|---|---|
| Reactive read driven by signals | `httpResource(() => ({ url, params }))` | Auto cancellation, SSR-safe, loading/error/value as signals. |
| Read from an existing Observable producer | `rxResource({ stream: () => obs$ })` | Signal ergonomics without rewriting the service. |
| Non-HTTP async read | `resource({ loader: async ({ request, abortSignal }) => ... })` | Native abort support. |
| One-shot read with no signal dependency | Service method + `pipe(takeUntilDestroyed(destroyRef))` | Teardown when component dies. |
| Search / typeahead | `httpResource` with a debounced signal in the request factory, **or** RxJS `debounceTime + distinctUntilChanged + switchMap` | Don't flood the API; cancel stale. |
| Submit (POST / PUT / PATCH / DELETE) | Service `Observable<T>` + `finalize(() => submitting.set(false))` + `takeUntilDestroyed(destroyRef)` | Always unlock the button — even on error. |
| Idempotent GET on flaky network (service-layer only) | `retry({...})` with `Retry-After` parsing — see §13 for the canonical implementation | Exponential backoff capped at 2. **Never retry writes.** |
| Hard ceiling on slow requests | `timeout(NetworkService.readTimeoutMs())` inside `ResilientCrudService` | Adaptive per connection class; prevents indefinite spinner / hung UI. |

> **Never add `timeout()` / `retry()` ad-hoc in a component or a feature service.** They live in `ResilientCrudService` (§13) so every endpoint inherits the same SLA. No millisecond literals anywhere outside `NetworkService`.

---

## 6. Pattern: reactive read with `httpResource()` (primary)

```ts
import { httpResource } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ServicesApi {
  list(params: { lang: Signal<string>; category: Signal<string | undefined> }) {
    return httpResource<ServiceDto[]>(() => ({
      url: environment.AppConfig.apiBaseUrl + Constants.servicesListUrl,
      params: {
        lang: params.lang(),
        ...(params.category() ? { category: params.category()! } : {}),
      },
    }), { defaultValue: [] });
  }
}

export class ServicesComponent {
  readonly category = input<string | undefined>();              // route input binding
  private readonly api = inject(ServicesApi);
  private readonly lang = inject(LanguageService);
  private readonly currentLang = computed(() => this.lang.getCurrentLanguage() || 'en');

  protected readonly data = this.api.list({
    lang: this.currentLang,
    category: this.category,
  });
}
```

```html
<section id="main-content">
  @if (data.isLoading()) {
    <app-skeleton-loader variant="card" [count]="6" />
  } @else if (data.error()) {
    <p class="error-state">{{ 'errors.loadFailedDetail' | translate }}</p>
    <button type="button" (click)="data.reload()">{{ 'common.retry' | translate }}</button>
  } @else if (data.hasValue()) {
    @for (item of data.value(); track item.id) { ... }
  }
</section>
```

`hasValue()` narrows the type so `data.value()` is non-undefined inside that branch — prefer it over `data.value()?.length`.

### Non-JSON variants

```ts
const pdf  = httpResource.blob(() => ({ url: Constants.invoicePdfUrl(id()) }));   // binary
const log  = httpResource.text(() => ({ url: Constants.serverLogUrl }));          // text
const wasm = httpResource.arrayBuffer(() => ({ url: Constants.wasmModuleUrl }));  // raw bytes
```

---

## 7. Pattern: bridge an Observable service into a signal — `rxResource`

```ts
import { rxResource } from '@angular/core/rxjs-interop';

readonly id = input.required<string>();
private readonly api = inject(RequestApi);                       // existing Observable-based service

protected readonly request = rxResource({
  params: () => ({ id: this.id() }),                             // canonical v22 option name
  stream: ({ params }) => this.api.getById(params.id),           // Observable<RequestDto>
});
```

Use this when the service exposes Observables (existing code) but the component wants signal ergonomics. The previous request is auto-cancelled when `id()` changes. **Always use `params:` (not the deprecated `request:` alias) for both `rxResource` and `resource` so the codebase reads consistently.**

---

## 8. Pattern: non-HTTP async with abort — `resource()`

```ts
protected readonly suggestions = resource({
  params: () => ({ q: this.debouncedQuery() }),
  loader: async ({ params, abortSignal }) => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(params.q)}`, { signal: abortSignal });
    if (!res.ok) { throw new Error(String(res.status)); }
    return (await res.json()) as Suggestion[];
  },
  defaultValue: [],
});
```

The `abortSignal` is wired to an internal `AbortController` that fires whenever `params()` produces a new value or the component is destroyed — the in-flight `fetch` is cancelled and surfaces a `DOMException('AbortError')` which the runtime swallows. Never `await` non-abortable work without forwarding `abortSignal`.

Use only when no HTTP interceptor coverage is needed (rare — prefer `httpResource` so headers + error funnel still apply).

---

## 9. Pattern: form submit (idempotency-safe + accessible)

```ts
protected readonly submitting = signal(false);
private readonly toast = inject(ToastService);
private readonly destroyRef = inject(DestroyRef);

onSubmit() {
  if (this.form.invalid || this.submitting()) { return; }
  this.submitting.set(true);
  this.api.submit(this.form.value)
    .pipe(
      finalize(() => this.submitting.set(false)),
      takeUntilDestroyed(this.destroyRef),
    )
    .subscribe({
      next: () => this.toast.success('inquiry.submitSuccess'),
      error: (err: HttpErrorResponse) => this.handleSubmitDomainError(err),
    });
}

private handleSubmitDomainError(err: HttpErrorResponse) {
  // Only domain 4xx — transport errors are already toasted by errorInterceptor.
  if (err.status === 422) {
    this.applyFieldErrors(err.error?.errors ?? {});              // map to FormControl.setErrors
    return;
  }
  if (err.status === 409) {
    this.toast.error('errors.conflictTitle', 'errors.conflictDetail');
  }
}
```

```html
<button type="submit" [disabled]="submitting() || form.invalid"
        [attr.aria-busy]="submitting()">
  {{ (submitting() ? 'common.submitting' : 'common.submit') | translate }}
</button>
```

---

## 10. Pattern: optimistic mutation against an `httpResource` (concurrency-safe)

Capturing the **whole list** as a snapshot is unsafe — two rapid toggles overwrite each other's snapshot, so rolling back one mutation undoes the other. Snapshot **only the row you mutated**:

```ts
toggleFavourite(item: ServiceDto) {
  const id = item.id;
  const before = this.data.value()?.find(s => s.id === id);     // per-row snapshot
  // 1. optimistic write
  this.data.update(list => list?.map(s => s.id === id ? { ...s, fav: !s.fav } : s));
  // 2. real call
  this.api.toggleFavourite(id).pipe(
    takeUntilDestroyed(this.destroyRef),
  ).subscribe({
    error: () => {
      // 3. rollback only that row — survives concurrent mutations on other rows
      if (before) {
        this.data.update(list => list?.map(s => s.id === id ? before : s));
      }
    },
  });
}
```

`set()` / `update()` mutate the resource's cached value in place; on the next reactive trigger the server response replaces it. **Never** snapshot the entire collection for a single-row mutation.

---

## 11. Pattern: derive/seed state with `linkedSignal()` (never `effect`)

```ts
// Selected row resets to the first item whenever the page changes.
readonly page = signal(1);
readonly data = this.api.list({ page: this.page });
readonly selectedId = linkedSignal<ServiceDto[] | undefined, string | null>({
  source: () => this.data.value(),
  computation: (rows, prev) => rows?.find(r => r.id === prev?.value)?.id ?? rows?.[0]?.id ?? null,
});
```

Use this instead of `effect(() => this.selectedId.set(...))`. Effects must not write to signals that other reads depend on.

---

## 12. Pattern: search / typeahead (signal-first)

```ts
protected readonly query = signal('');
// MUST be a class field initializer — `toSignal` / `toObservable` require an injection context.
private readonly debouncedQuery = toSignal(
  toObservable(this.query).pipe(debounceTime(300), distinctUntilChanged()),
  { initialValue: '' },
);

protected readonly results = httpResource<Suggestion[]>(() => {
  const q = this.debouncedQuery();
  if (q.length < 2) { return undefined; }            // returning undefined keeps the resource idle
  return { url: Constants.searchUrl, params: { q } };
}, { defaultValue: [] });
```

Returning `undefined` from the request factory tells `httpResource` to stay idle — no request, no error.

> **Injection-context rule.** `toSignal()` and `toObservable()` must be invoked in an injection context (field initializer, `inject()` factory, or constructor body). Calling them from an arbitrary method throws `NG0203` at runtime. If you genuinely need them mid-method, wrap with `runInInjectionContext(this.injector, () => ...)` — but field initializers are the right answer 99% of the time.

---

## 13. Pattern: service-layer timeout + retry (adaptive, `Retry-After` aware)

Declare the SLA **once**; every endpoint inherits it. The timeout adapts to the user's connection class so 2G/3G clients don't fail fast, and 429 / 503 honor the server's `Retry-After` header.

```ts
// network.service.ts — SSR-safe connection probe
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly platformId = inject(PLATFORM_ID);
  /** Read SLA in ms based on the Network Information API. */
  readTimeoutMs(): number {
    if (!isPlatformBrowser(this.platformId)) { return 15_000; }
    const c = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    switch (c?.effectiveType) {
      case 'slow-2g':
      case '2g': return 45_000;
      case '3g': return 25_000;
      default:   return 15_000;          // 4g / wifi / unknown
    }
  }
  writeTimeoutMs(): number { return this.readTimeoutMs() + 5_000; }
}
```

```ts
// resilient-crud.service.ts
@Injectable({ providedIn: 'root' })
export class ResilientCrudService<T> extends BaseCrudService<T> {
  private readonly net = inject(NetworkService);

  // Reads: adaptive ceiling + 2 retries with exponential backoff. Honors Retry-After on 429 / 503.
  override get(apiUrl: string): Observable<T[]> {
    return super.get(apiUrl).pipe(
      timeout(this.net.readTimeoutMs()),
      retry({
        count: 2,
        delay: (err, i) => {
          if (!(err instanceof HttpErrorResponse)) { return throwError(() => err); }
          if (err.status === 429 || err.status === 503) {
            const ra = Number(err.headers.get('Retry-After')) * 1000;
            return timer(Number.isFinite(ra) && ra > 0 ? ra : 1000 * 2 ** i);
          }
          if (err.status >= 500) { return timer(500 * 2 ** i); }
          return throwError(() => err);     // 4xx (other) — don't retry
        },
        resetOnSuccess: true,
      }),
    );
  }

  // Writes: timeout only — never retry (not idempotent at the API layer).
  override create(apiUrl: string, item: T): Observable<T> {
    return super.create(apiUrl, item).pipe(timeout(this.net.writeTimeoutMs()));
  }
  override update(apiUrl: string, id: string | number, item: T): Observable<T> {
    return super.update(apiUrl, id, item).pipe(timeout(this.net.writeTimeoutMs()));
  }
  override delete(apiUrl: string, id: string | number): Observable<void> {
    return super.delete(apiUrl, id).pipe(timeout(this.net.writeTimeoutMs()));
  }
}
```

A `TimeoutError` reaches the component's `error:` branch with no `HttpErrorResponse.status`. Detect with `err instanceof TimeoutError` (from `'rxjs'`) and toast `errors.timeoutTitle` / `errors.timeoutDetail`.

**Never** add `timeout()` / `retry()` ad-hoc in a component or a feature service — they live in `ResilientCrudService` so every endpoint inherits the same SLA.

---

## 14. Provider checklist (`app.config.ts`)

The full HTTP + hydration stack:

```ts
import { provideClientHydration, withEventReplay, withHttpTransferCache } from '@angular/platform-browser';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { SKIP_TRANSFER_CACHE } from './shared/interceptors/http-context.tokens';

provideClientHydration(
  withEventReplay(),
  withHttpTransferCacheOptions({
    includePostRequests: false,                                     // GETs only (default — be explicit)
    filter: (req) => !req.context.get(SKIP_TRANSFER_CACHE),         // per-call opt-out
  }),
),
provideHttpClient(
  withFetch(),                                                      // v22 default: fetch backend
  withInterceptors([loaderInterceptor, authInterceptor, errorInterceptor]),
),
```

- `withFetch()` enables HTTP streaming, native `AbortController` cancellation that integrates with `resource()`, and better SSR `TransferState` handling. **Do not remove it.**
- `withHttpTransferCacheOptions(...)` is **mandatory**: without it, every `httpResource` GET re-fires on the client immediately after hydration — you'll see double network cost and a flicker. The `filter` lets sensitive endpoints opt out via `context: skipTransferCache()`.
- The interceptor order — `loader → auth → error` — is intentional. Loader wraps the whole pipeline (so spinner counts include retries); auth runs before error so 401 redirects see the same headers; error runs last so it sees the final response.

---

## 15. SSR rules for async

- `httpResource()` / `rxResource()` / `resource()` are SSR-safe — they prefetch on the server and rehydrate on the client via `TransferState` **only when `withHttpTransferCacheOptions()` is registered** (see §14). Prefer them for above-the-fold data.
- Manual `.subscribe()` calls run on the server only if invoked from a constructor / `ngOnInit` path that executes during SSR. Wrap browser-only triggers (`window`, `IntersectionObserver`, `matchMedia`, scroll, focus) in `isPlatformBrowser(inject(PLATFORM_ID))`.
- Never gate a network call on `localStorage` reads at module load — read inside the request factory so SSR sees a deterministic value (or skip with `undefined` when not in the browser).
- POST / PUT / PATCH / DELETE are excluded from `withHttpTransferCacheOptions` by design (`includePostRequests: false`). Don't try to cache them — they aren't read state.

---

## 16. i18n keys required by this contract

Every key below must exist in both [en.json](../../src/assets/i18n/en.json) and [ar.json](../../src/assets/i18n/ar.json). All pre-seeded:

```
errors.networkTitle / networkDetail        — 0 / 503 (interceptor)
errors.serverTitle / serverDetail          — 5xx (interceptor)
errors.loadFailedTitle / loadFailedDetail  — resource.error() branch
errors.timeoutTitle / timeoutDetail        — RxJS timeout() / 408
errors.unauthorizedTitle / unauthorizedDetail — 401 follow-up (rare; interceptor redirects)
errors.forbiddenTitle / forbiddenDetail    — 403 inline (rare)
errors.notFoundTitle / notFoundDetail      — 404 empty-state
errors.validationTitle / validationDetail  — 422 fallback when field map is empty
errors.conflictTitle / conflictDetail      — 409
errors.rateLimitTitle / rateLimitDetail    — 429
common.retry / submit / submitting / cancel / close
```

Add any new HTTP-related copy under `errors.*` with parity in both files.

---

## 17. Pattern: per-call interceptor opt-outs via `HttpContextToken`

For cross-cutting interceptor behavior the caller needs to override (no global spinner, no toast on this specific call, skip the SSR transfer cache), use **HttpContextTokens** — never URL allow-lists or custom headers.

```ts
// src/app/shared/interceptors/http-context.tokens.ts
import { HttpContext, HttpContextToken } from '@angular/common/http';

export const SKIP_LOADER         = new HttpContextToken<boolean>(() => false);
export const SKIP_ERROR_TOAST    = new HttpContextToken<boolean>(() => false);
export const SKIP_TRANSFER_CACHE = new HttpContextToken<boolean>(() => false);

export const skipLoader        = (ctx = new HttpContext()) => ctx.set(SKIP_LOADER, true);
export const skipErrorToast    = (ctx = new HttpContext()) => ctx.set(SKIP_ERROR_TOAST, true);
export const skipTransferCache = (ctx = new HttpContext()) => ctx.set(SKIP_TRANSFER_CACHE, true);
```

```ts
// loader.interceptor.ts — read the token, no URL list
export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADER)) { return next(req); }
  const loader = inject(LoaderService);
  loader.show();
  return next(req).pipe(finalize(() => loader.hide()));
};

// error.interceptor.ts — same idea
if (req.context.get(SKIP_ERROR_TOAST)) { return throwError(() => err); }
```

```ts
// caller — long-running upload, no global spinner, owns its own progress UI
this.http.post(Constants.uploadUrl, body, { context: skipLoader() }).subscribe(...);

// caller — typeahead suggestions, swallow errors silently
this.http.get(Constants.suggestUrl, { context: skipErrorToast() }).subscribe(...);
```

**Hard rule:** new long-running endpoints get a `Constants.*` entry **and** the caller passes `context: skipLoader()`. Never extend a URL list inside an interceptor.

---

## 18. Pattern: file upload with progress (excluded from global spinner)

```ts
// upload.api.ts
@Injectable({ providedIn: 'root' })
export class UploadApi {
  private readonly http = inject(HttpClient);
  upload(file: File) {
    const body = new FormData(); body.append('file', file);
    return this.http.post(Constants.uploadUrl, body, {
      reportProgress: true,
      observe: 'events',
      context: skipLoader(),                                      // own UI, no global spinner
    });
  }
}
```

```ts
// component
protected readonly progress  = signal(0);                          // 0..100
protected readonly uploading = signal(false);
private readonly destroyRef  = inject(DestroyRef);

upload(file: File) {
  if (this.uploading()) { return; }                                // double-submit guard
  this.uploading.set(true); this.progress.set(0);
  this.api.upload(file).pipe(
    finalize(() => this.uploading.set(false)),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe({
    next: (e) => {
      if (e.type === HttpEventType.UploadProgress && e.total) {
        this.progress.set(Math.round((e.loaded / e.total) * 100));
      }
    },
    error: (err: HttpErrorResponse) => this.handleSubmitDomainError(err),
  });
}
```

```html
<progress [value]="progress()" max="100"
          [attr.aria-valuenow]="progress()"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="100"
          [attr.aria-label]="'upload.progress' | translate"></progress>
```

Download progress works the same way with `HttpEventType.DownloadProgress` — the only change is the event type guard:

```ts
.subscribe({
  next: (e) => {
    if (e.type === HttpEventType.DownloadProgress && e.total) {
      this.progress.set(Math.round((e.loaded / e.total) * 100));
    } else if (e.type === HttpEventType.Response) {
      this.saveBlob(e.body as Blob);                                // final payload
    }
  },
});
```

For downloads, also pass `responseType: 'blob'` on the request and `context: skipLoader()` so the global spinner stays out of the way of the dedicated progress bar.

---

## 19. Pattern: offline / online recovery

Transport `0` is already toasted by the interceptor. To proactively reload pending resources when the connection returns:

```ts
@Injectable({ providedIn: 'root' })
export class OnlineService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly online = signal(true);
  // `providedIn: 'root'` — lives for the app lifetime. The window listeners below are attached
  // once per app instance; HMR / test teardown destroys the previous root injector cleanly,
  // so `takeUntilDestroyed()` is a defensive no-op rather than a leak fix.
  constructor() {
    if (!isPlatformBrowser(this.platformId)) { return; }
    this.online.set(navigator.onLine);
    fromEvent(window, 'online').pipe(takeUntilDestroyed())
      .subscribe(() => this.online.set(true));
    fromEvent(window, 'offline').pipe(takeUntilDestroyed())
      .subscribe(() => this.online.set(false));
  }
}

// component
private readonly net = inject(OnlineService);
protected readonly data = this.api.list({ /* ... */ });
constructor() {
  effect(() => {
    if (this.net.online() && this.data.error()) { this.data.reload(); }
  });
}
```

> **Safari note.** Safari (desktop and iOS) does not implement `navigator.connection`, so `NetworkService.readTimeoutMs()` falls through to its `default` branch (15 s). The `online` / `offline` events themselves *are* supported in Safari — no code change required.

---

## 20. `AbortError` detection (cancellations are not failures)

When a `resource()` / `httpResource()` / `rxResource()` re-fetches because a reactive input changed, the previous request's `AbortController.abort()` fires and surfaces a `DOMException` with `name === 'AbortError'`. The runtime swallows it for resources, but it can still appear in error branches of manual `fetch` callers and in tests.

```ts
function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

// usage — never toast a cancellation
.subscribe({ error: e => { if (!isAbortError(e)) this.handle(e); } });
```

Writing `e instanceof AbortError` will not compile — there is no `AbortError` class in `lib.dom`.

---

## 21. Test parity (critical for `withFetch()` projects)

Every spec that exercises `httpResource` / `rxResource` / a feature service must register the **same** HTTP stack as production — `withFetch()` plus the interceptor chain — otherwise tests pass with the XHR backend and prod fails.

```ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

beforeEach(() => {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(
        withFetch(),
        withInterceptors([loaderInterceptor, authInterceptor, errorInterceptor]),
      ),
      provideHttpClientTesting(),
    ],
  });
});
```

For `httpResource`-backed components, drive reactive inputs via signals and flush with `TestBed.tick()` — the resource's request factory runs synchronously after each tick.

---

## 22. Anti-patterns (delete on sight)

```ts
// BAD — HttpClient in a component
this.http.get('/api/things').subscribe(x => this.things = x);

// BAD — BehaviorSubject for read state in v22
private readonly things$ = new BehaviorSubject<Thing[]>([]);
// → use httpResource() / rxResource().

// BAD — inline URL
this.api.get('/api/services/list').subscribe();

// BAD — manual .subscribe() for a read that depends on signals
toObservable(this.id).pipe(switchMap(id => this.api.getById(id))).subscribe(r => this.r.set(r));
// → use rxResource({ params: () => ({ id: this.id() }), stream: ({ params }) => this.api.getById(params.id) }).

// BAD — uncancelled subscribe
this.api.get(Constants.x).subscribe(v => this.v = v);            // leaks on destroy

// BAD — manual spinner toggle
this.loading = true;
this.api.get(...).subscribe({ next: ..., complete: () => this.loading = false });
// → submitting signal (writes) or resource.isLoading() (reads).

// BAD — hand-rolled error flag
this.hasError = false;
this.api.get(...).subscribe({ error: () => this.hasError = true });

// BAD — effect writing to a signal that drives reads
effect(() => this.selectedId.set(this.list()[0]?.id));            // use linkedSignal().

// BAD — parallel mirror of a resource
readonly cached = signal<Thing[]>([]);
constructor() { effect(() => this.cached.set(this.data.value() ?? [])); }
// → just read this.data.value() (or use linkedSignal for derived shape).

// BAD — double-submit possible
<button (click)="onSubmit()">Save</button>                        <!-- no [disabled] guard -->

// BAD — retrying a write
this.api.create(payload).pipe(retry(3)).subscribe();              // duplicates on the server

// BAD — silent timeout
this.api.get(...).pipe(timeout(5000), catchError(() => EMPTY)).subscribe();

// BAD — handling 401 / 5xx in a component
.subscribe({ error: err => { if (err.status === 401) this.router.navigate(['/login']); } });
// → already done by errorInterceptor.

// BAD — toasting an AbortError from a cancelled resource
.subscribe({ error: err => this.toast.error(err.name) });          // AbortError is expected.

// BAD — `instanceof AbortError` (no such class in lib.dom)
if (err instanceof AbortError) { return; }
// → use: err instanceof DOMException && err.name === 'AbortError'.

// BAD — calling toSignal/toObservable from a method
onClick() { this.x = toSignal(toObservable(this.q)); }              // throws NG0203.
// → field initializer or runInInjectionContext(this.injector, () => ...).

// BAD — full-list snapshot for a single-row optimistic mutation
const previous = this.data.value(); ... this.data.set(previous);    // breaks under concurrent toggles.
// → snapshot the row only (§10).

// BAD — hardcoded timeout literal in a component or feature service
this.api.get(...).pipe(timeout(15_000)).subscribe();
// → ResilientCrudService + NetworkService.readTimeoutMs() (§13).

// BAD — interceptor opt-out via custom header or URL match
this.http.post(url, body, { headers: { 'X-Skip-Loader': '1' } });
// → context: skipLoader() (§17).

// BAD — relying on TransferState without registering withHttpTransferCacheOptions()
provideClientHydration(withEventReplay())                            // double-fetch on hydration.
// → add withHttpTransferCacheOptions({ includePostRequests: false, filter: ... }) (§14).

// BAD — retrying 429 immediately, ignoring Retry-After
retry({ count: 3, delay: () => timer(500) })                         // user-visible hammering.
// → honor err.headers.get('Retry-After') (§13).
```

---

## 23. Pre-merge checklist

Before opening a PR that touches an API call, verify:

- [ ] No `HttpClient` import in any `*.component.ts`.
- [ ] Endpoint is a `Constants.*` reference.
- [ ] Reads use `httpResource()` / `rxResource()` / `resource()` unless a hard reason forces RxJS.
- [ ] `rxResource` / `resource` use `params:` (not the deprecated `request:` alias).
- [ ] Every `.subscribe()` pipes `takeUntilDestroyed(...)`.
- [ ] Submit handlers have a `submitting` signal guard + `finalize()` reset; submit button has `[disabled]="submitting() || form.invalid"` + `[attr.aria-busy]="submitting()"`.
- [ ] Optimistic mutations snapshot the row, not the whole collection.
- [ ] No `effect()` writes to a signal another read depends on — use `linkedSignal()`.
- [ ] No component handler for `401` / `403` / `0` / `503` / `5xx`.
- [ ] Domain 4xx (`400` / `404` / `409` / `422` / `429`) handled with a translated toast or inline UI; 429 / 503 honor `Retry-After` in the service layer.
- [ ] All user-facing strings are translation keys present in **both** `en.json` and `ar.json`.
- [ ] No `console.error` / `alert` / `try/catch` around HTTP.
- [ ] No hardcoded `timeout(...)` literals — `ResilientCrudService` + `NetworkService` only.
- [ ] No `instanceof AbortError` — use `e instanceof DOMException && e.name === 'AbortError'`.
- [ ] `toSignal()` / `toObservable()` only from injection contexts (field initializers, factories, constructors).
- [ ] `app.config.ts` registers `provideHttpClient(withFetch(), withInterceptors([loader, auth, error]))`.
- [ ] `app.config.ts` registers `provideClientHydration(withEventReplay(), withHttpTransferCacheOptions({...}))` — not just `withEventReplay()`.
- [ ] New long-running endpoint? `Constants.*` entry **and** caller passes `context: skipLoader()` — no URL allow-lists.
- [ ] Specs register `provideHttpClient(withFetch(), withInterceptors([...]))` alongside `provideHttpClientTesting()`.
