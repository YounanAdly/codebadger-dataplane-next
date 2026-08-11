---
description: "Use when handling HTTP errors, form submissions, toast notifications, or any code that can fail. Enforces centralized error handling and translated toast messages."
applyTo: "src/app/**/*.ts,src/app/**/*.html"
---

# Error Handling

## Hard rules

1. **No component-local `try/catch`** for HTTP transport errors. The [`errorInterceptor`](../../src/app/shared/interceptors/error.interceptor.ts) handles `401` / `403` / `0|503` (network) / `5xx` centrally.
2. **No `console.error()`** or **`alert()`** for user-facing failures.
3. **No `hasError = true`** flags. For data fetching, use `httpResource()` / `resource()` and render the `error()` branch in the template.
4. **Every toast goes through [`ToastService`](../../src/app/shared/services/toast.service.ts)** — never inject `MessageService` directly. Pass translation keys, never hardcoded strings.
5. **Translation keys** — every error message lives under the `errors.*` namespace in [en.json](../../src/assets/i18n/en.json) and [ar.json](../../src/assets/i18n/ar.json), with parity in both files.

## Pattern: success after submit

```ts
private readonly toast = inject(ToastService);

onSubmit() {
  this.api.submit(this.form.value).subscribe({
    next: () => this.toast.success('inquiry.submitSuccess'),
    // error path: handled by errorInterceptor — no local handler needed
  });
}
```

## Pattern: domain 4xx — prefer server's localized message

When a component handles a domain 4xx (because the call opted out of the global toast via `context: skipErrorToast()` — see [api-calls.instructions.md §17](./api-calls.instructions.md)), pass the `HttpErrorResponse` (or the API envelope) as the **third arg** to `ToastService`. If the body carries `errorMessageEn` / `errorMessageAr`, the language-matched server message becomes the toast detail; otherwise the translation key wins. The summary stays a translation key either way.

```ts
error: (err: HttpErrorResponse) => {
  if (err.status === 404) {
    // Detail prefers err.error.errorMessageAr / errorMessageEn when present,
    // otherwise falls back to 'login.errors.notRegisteredDetail'.
    this.toast.error('login.errors.notRegisteredTitle',
                     'login.errors.notRegisteredDetail', err);
  }
}
```

Works the same with a non-2xx envelope returned in a `next` handler:

```ts
next: (envelope) => {
  if (!envelope.isSuccess) {
    this.toast.error('errors.serverTitle', 'errors.serverDetail', envelope);
  }
}
```

## Pattern: load-error in templates with `httpResource()`

```html
@if (data.isLoading()) {
  <app-skeleton-loader variant="card" [count]="3" />
} @else if (data.error()) {
  <p class="error-state">{{ 'errors.loadFailedDetail' | translate }}</p>
  <button (click)="data.reload()">{{ 'common.retry' | translate }}</button>
} @else {
  @for (item of data.value(); track item.id) {
    ...
  }
}
```

## Built-in error keys (already in both i18n files)

```
errors.networkTitle / networkDetail   — shown by errorInterceptor on status 0/503
errors.serverTitle  / serverDetail    — shown by errorInterceptor on status 5xx
errors.loadFailedTitle / loadFailedDetail — for use in resource.error() templates
```

Add new error keys under the same namespace in both catalogs.

## Form validation messages

Validators registered in [formly.validators.ts](../../src/app/shared/formly/formly.validators.ts) return a key (e.g. `{ emailPattern: true }`); the Formly translate extension in [formly.validation.ts](../../src/app/shared/formly/formly.validation.ts) maps the key to the translated message at the `validation.*` namespace. Never inline literal strings in validators.

## Anti-patterns (remove on sight)

```ts
// BAD — local error flag
this.hasError = false;
this.api.getThing().subscribe({ error: () => this.hasError = true });

// BAD — hardcoded English in toast
this.messageService.add({ detail: 'Something went wrong' });

// BAD — silent console.error
catchError(err => { console.error(err); return EMPTY; });

// BAD — alert()
alert('Submitted');
```
