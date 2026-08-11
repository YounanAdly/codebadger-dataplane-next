# Reuse-First Rules For This Angular Project

Purpose: this file is the single source of truth for project structure and reusable assets.

When implementing a new Figma design, always read this file first and reuse existing components/services before creating new ones.

---

## 1) Project Structure (Verified)

### Root
- `angular.json`, `package.json`, `tsconfig*.json`: Angular workspace config.
- `src/main.ts`, `src/main.server.ts`, `src/server.ts`: app bootstrap (browser + server).

### App Layer
- `src/app/app.component.*`: root shell, skip-link accessibility, conditional header/footer visibility by route.
- `src/app/app.routes.ts`: language-prefixed routing (`/:lang/...`).
- `src/app/app.config.ts`: global providers, HTTP interceptors, Formly module, PrimeNG, translate provider, theme initializer.
- `src/app/constants.ts`: central endpoint keys for common API paths.

### Config
- `src/app/config/app.config.ts`: runtime feature toggles (language/theme/font-size) and defaults.
- `src/app/translate.config.ts`: ngx-translate loader setup.

### Layouts
- `src/app/layouts/header/*`: reusable header shell.
- `src/app/layouts/footer/*`: reusable footer shell.

### Public Pages
- `src/app/public/home/*`: routed home page (`/:lang/home`) with empty starter layout and language/theme/font controls; header/footer are provided by root app shell.
  > **⚠ LOCKED — Do NOT edit any file inside `src/app/public/home/`** unless explicitly instructed by the user.
- `src/app/public/services/*`: routed services listing page (`/:lang/services`); breadcrumb + hero + search bar + 4-column card grid reusing `app-service-offering-card`; header/footer provided by root app shell.
- `src/app/public/service-details/*`: routed service details page (`/:lang/service-details`); receives selected service via query param (`service=<serviceId>` GUID) from card Apply Now actions, resolves service metadata from `/api/v1/home-page/services-card/{id}` (including `serviceName` category number), and renders service title + intro hero + `app-service-about-section`.
- `src/app/public/service-request/*`: routed service request page (`/:lang/service-request`); one page renders every service form (currently 4 variants covering all 15 services) driven by backend `serviceName` (1..15). Query params: `service=<serviceId>` (GUID from card Apply Now, or legacy slug like `tanker`) and optional `serviceName=<1-15>` (numeric shortcut). **All service metadata + form catalog live in [`forms/`](src/app/public/service-request/forms/)** — the component itself is thin. Structure: [`service-name.enum.ts`](src/app/public/service-request/forms/service-name.enum.ts) declares `ServiceName` (1..15) + `isServiceName` / `toServiceName` guards; [`form-variant.enum.ts`](src/app/public/service-request/forms/form-variant.enum.ts) declares `ServiceFormVariant` (`Water` | `Standard` | `Tanker` | `Noc`); [`service-catalog.ts`](src/app/public/service-request/forms/service-catalog.ts) is the **single source of truth** — `SERVICE_CATALOG: Record<ServiceName, { variant, titleKey, slug }>` maps every service to its variant + title + legacy slug, plus `getServiceMetadata()`, `getServiceByLegacySlug()`, `isServiceGuid()`, and `DEFAULT_SERVICE_NAME` helpers; [`form-config.types.ts`](src/app/public/service-request/forms/form-config.types.ts) defines `ServiceRequestFormConfig` (union of every section key across variants); [`registry.ts`](src/app/public/service-request/forms/registry.ts) exposes `FORM_REGISTRY: Record<ServiceFormVariant, ServiceRequestFormConfig>` composed from per-variant JSON files; [`index.ts`](src/app/public/service-request/forms/index.ts) is the barrel — components must import only from `./forms`. Form JSONs: [`customer.section.json`](src/app/public/service-request/forms/customer.section.json) is shared by variants that don't override it; [`water.form.json`](src/app/public/service-request/forms/water.form.json), [`standard.form.json`](src/app/public/service-request/forms/standard.form.json), [`tanker.form.json`](src/app/public/service-request/forms/tanker.form.json), [`noc.form.json`](src/app/public/service-request/forms/noc.form.json) each hold only that variant's sections. NOC overrides `customerInformation` with its own applicant fields (applicant name lookup, company lookup, GSM, email). The component's `requestFields` is a `computed<ServiceRequestFormConfig>()` that deep-clones `FORM_REGISTRY[variant]` so per-instance dropdown mutations don't leak across navigations. Sections a variant doesn't use fall back to empty arrays via `compose()` so templates never see `undefined`. Template uses `@switch (selectedServiceFormVariant())` with `@case (Variant.Water)` / `@case (Variant.Standard)` / `@case (Variant.Tanker)` / `@case (Variant.Noc)` branches — the enum is exposed on the component as `protected readonly Variant = ServiceFormVariant`. The first-section header key is dynamic via `firstSectionTitleKey()` (Customer Details for water/standard/tanker; Applicant Details for NOC). **Adding a new service in 4 steps:** (1) add a member to `ServiceName` enum; (2) add an entry to `SERVICE_CATALOG` (variant + titleKey + slug); (3) if the form structure genuinely differs from every existing variant, add a member to `ServiceFormVariant`, create `<variant>.form.json` with only its sections, add fields to `ServiceRequestFormConfig`, register in `FORM_REGISTRY`, and add a `@case` branch in the template; (4) add title + form-field i18n keys under `serviceRequestPage.services.<slug>.title` + `serviceRequestPage.form.<variant>.*` in both `en.json` and `ar.json`. Dropdowns whose options come from Dataverse option-sets use `LookupApi.optionSet({ entityLogicalName, fieldName })` with a `computed` factory that stays idle for non-matching variants (currently: tanker Geographic Area via `ntw_tankerfillinglicenserequest.ntw_opsgeographicarea`). Guarded by `loginPromptGuard`. Success modal uses `app-success-alert-modal variant="service-request"`.
- `src/app/public/faq/*`: dedicated FAQ page (`/:lang/faq`); 2-column layout (left inquiry card + right accordion); breadcrumb strip with `faq-breadcrumb-bg.svg`; back button with `back.svg`; data driven by `FAQ_PAGE_ITEMS` from `faq-items.ts` (shared with home FAQ section). Use `app-faq-section` for inline previews on other pages.
- `src/app/public/inquiry/*`: inquiry page (`/:lang/inquiry`) with breadcrumb, hero, inquiry composer (textarea + attachment), inquiry history cards, and pagination.
- `src/app/public/login/*`: standalone login UI based on Figma assets.
- `src/app/public/create-account/*`: standalone create-account UI reusing login shell + Formly custom-input + shared button.
- `src/app/public/notifications/*`: dedicated notifications center page (`/:lang/notifications`) with breadcrumb, hero intro, month/year filters, notification timeline cards, and pagination.
- `src/app/public/complaints/*`: complaints landing page (`/:lang/complaints`); breadcrumb (`faq-breadcrumb-bg.svg`) + hero (back button with `back.svg`, title, subtitle, select-type prompt) + **3 primary complaint-type cards** in this order: **Water Leakage Complaints**, **Water Quality Complaints**, **General Complaints** (titles bound to `complaintsPage.cards.{waterLeakage|waterQuality|general}.title`; each with PNG icon, card/icon bg via CSS vars, `regulation-arrow.svg`) + "MY COMPLAINTS" section with month/year `app-filter-dropdown` filters (default to current month/year via `new Date()`; both bound to numeric `selectedMonth` / `selectedYear` signals passed as params to `ComplaintsApi.list()` — **server-side filtering**, the resource re-fires automatically on filter change), 2-column complaint item card grid driven by `ComplaintsApi.list()` (`GET /api/v1/cases/complaints?month=MM&year=YYYY` via `httpResource`), and client-side pagination (4 per page, `linkedSignal`-clamped) using `regulation-arrow.svg`. Each card binds `title` / `description` / `ticketNumber` (via `complaintsPage.caseRef` translation key with `{{number}}`) / `createdOn` (formatted with `Intl.DateTimeFormat`, Latin digits in both locales) / language-matched `status.descriptionEn|Ar`. Status badge branches on `status.id` via the `statusVariant()` helper (`1` = In Progress → `--pending` with `inquiry-status-pending.svg`; anything else → `--approved` with `inquiry-status-approved.svg`). Tokens come from `--color-inquiry-status-{pending,approved}[-bg]`. Extend the map when the backend ships additional codes. Loading goes through `app-skeleton-loader variant="card" [count]="4"`; error branch shows `errors.loadFailedDetail` + a `common.retry` button calling `complaintsResource.reload()`; empty branch shows `complaintsPage.empty.{title,detail}`. Navigating a category card calls `navigateToComplaintForm(type)` → `/:lang/complaint-request?type=<type>`. Clicking a submitted complaint card calls `viewComplaintDetails(ticketNumber)` → `/:lang/request-details?ref=<ticketNumber>&kind=complaint` — item cards are rendered as `<button>` so keyboard + `aria-label="complaintsPage.viewDetailsAriaLabel"` navigation are wired for free. The Wastewater complaint category is intentionally excluded.
- `src/app/public/complaint-request/*`: complaint submission page (`/:lang/complaint-request`) opened from the complaints landing page (or Home) using query param `type=<complaintType>`; back button navigates to `/:lang/complaints`; renders dynamic complaint title in breadcrumb/hero and JSON-driven Formly sections (applicant, complaint details, required document). **Customer Request Details** prefills `customerName`, `mobileNumber`, `email`, and `permanentAddress` from the component's `model` (currently a hardcoded stub — replace with `AuthService.fetchContactInfo()` or a dedicated profile service when the backend endpoint is available; keep the same field keys). These four fields are rendered with `props.disabled: true` + `props.dimmed: true` + `className: "request-col request-col--dimmed"` so the user sees their data prefilled but cannot edit it. `accountNumber` stays editable. **Complaint Details** is now a multi-level cascading hierarchy driven by [`form.json`](src/app/public/complaint-request/form.json) + [`complaint-request.component.ts`](src/app/public/complaint-request/complaint-request.component.ts):
  - `complaintType` (top-level dropdown) is **pre-selected from the route and rendered locked + dimmed** (`props.disabled: true, props.dimmed: true`).
  - `complaintSubCategory` options are recomputed per primary category (Water Leakage → leakage/shortage/pressure/other; Water Quality → color/odor/turbidity/salinity/taste/pollution/other; General → billing/meter/other). Options are translated through `complaintRequestPage.complaintOptions.subCategories.*`.
  - `meterIssue` (tertiary dropdown) only renders when `complaintType === 'general' && complaintSubCategory === 'meterIssues'` via Formly `expressions.hide`. Options come from `complaintRequestPage.complaintOptions.meterIssueTypes.*` (Meter Faulty / Stolen or Missing Meter / Meter Tampering / Other Reasons).
  - `anotherReason` (compact 2-line textarea, `props.compact: true`) only renders when the user picks **Other Reasons** at any depth; `expressions['props.required']` makes it required only in that case. `resetFieldOnHide: true` (set globally in `FormlyConfigModule`) clears the value as soon as the field hides.
  - The legacy `securityCode` field has been removed.
  - Deep-link compatibility: `?type=meterIssues` still works — the component resolves it to `primary: 'general'` with `complaintSubCategory: 'meterIssues'` pre-selected so the meter-issue tertiary dropdown appears immediately.
- `src/app/public/dashboard/*`: dashboard page (`/:lang/dashboard`) with breadcrumb + hero, requests summary widget, due payments table, my requests table with category tabs, quick actions feed, and recent submitted services cards.
- `src/app/public/request-details/*`: "MY REQUESTS" details page (`/:lang/request-details`). Signal-bound query params: `ref=<ticketNumber>`, `kind` (`complaint` opens the complaint variant; anything else keeps the legacy static service-request layout), and optional `titleKey` (translation key for the service-variant summary title). **Complaint variant** — `ComplaintsApi.detail(() => ref)` reads `GET /api/v1/cases/complaints/{ticketNumber}` via `httpResource`; option-set ids in the response are resolved to labels through `LookupApi.optionSet(...)` using the same `entityLogicalName: 'incident'` + field names as [`complaint-request.component.ts`](src/app/public/complaint-request/complaint-request.component.ts) (`ntw_opscomplainttypeforwaterleakagecomplaints` / `ntw_opscomplainttypequatlity` / `ntw_opscomplainttypegeneral`, plus secondary `ntw_opssubcomplaintmeterissues` / `ntw_opssubcomplaintwaterbillingpayments`). Applicant fields (name/account/mobile/email/address) are seeded from `AuthService.profile()` + `AuthService.getSelectedAccountId()` (same source as the complaint form); complaint fields (type/case type/meter-issue/water-billing/description/anotherReason) come from the detail API. Status pill branches on `status.id` (`1` = In Progress → `--pending`; else `--approved`), tokens `--color-inquiry-status-{pending,approved}[-bg]`. Loading uses `app-skeleton-loader variant="card"`; error branch renders `errors.loadFailedDetail` + a `common.retry` button that calls `complaintDetailResource.reload()`. Empty/absent values fall back to `common.notAvailable`. Documents section is hidden in the complaint variant (API doesn't ship attachments yet). Legacy service-variant rendering is untouched so dashboard's `onViewRef(refNo, titleKey)` navigation still works.
- `src/app/public/media-center/*`: dedicated media center page (`/:lang/media-center`) with breadcrumb, hero (title/subtitle/description), filter tabs (All/News/Videos/Announcements/Gallery), results bar with category/sort dropdowns and grid/list toggle, 3-column media card grid (image+badge+title+date+arrow), and pagination. Badge colors: News=`--color-teal-dark`, Gallery=`--color-orange`, Announcement=`--color-primary-blue`, Videos=`--color-light-green`. New tokens: `--color-border-subtle`, `--color-card-shadow-subtle`.
- `src/app/public/about-us/*`: About Us page (`/:lang/about-us`) with breadcrumb strip, teal hero (title/subtitle/description + back button), 4-tab nav bar (Overview/Our Mission/Our Vision/Our Values with Figma-exported `<img>` icons (`au-tab-*.svg`, black strokes) tinted by `--filter-icon-teal` / `--filter-icon-orange` + orange active underline), and API-driven section mapping from `AboutUsApi.detail()` (`GET /api/v1/about-us`): hero title/description from `result.aboutUs`, subtitle + Overview panel content from `result.overview`, Mission tab from `result.mission`, Vision tab from `result.vision`, and Values tab from `result.values[0]`/`description` (line-split). Overview keeps the existing 4 stat cards and right-side image/tagline visuals. Uses `httpResource` branches (`isLoading` → `app-skeleton-loader`, `error` → `errors.loadFailedDetail` + `common.retry`, else data with translation fallbacks). RTL-safe. Animate tab content with `auTabFadeIn` (0.25s). Respects `prefers-reduced-motion`.
- `src/app/public/not-found/*`: 404 Not Found page (`/:lang/not-found`, wildcard `**`). Full-viewport centered layout with gradient `404` numeral, orange divider, title, subtitle, and "Back to Home" CTA pill button. Also reachable from root-level `**` which redirects to `/en/not-found`. Translation namespace: `notFound`.
- `src/app/public/account-summary/*`: bill-account summary page (`/:lang/account-summary?account=<id>`). Opened from the **Bill Account Number** table on `my-profile` — both the account-number cell (`onSelectBillAccount`) and the chevron button (`onViewBillAccount`) in [`my-profile.component.ts`](src/app/public/my-profile/my-profile.component.ts) navigate here, forwarding the row's account id as the `account` query param. Standalone Angular 22 layout: gradient breadcrumb (`My Profile > Account Summary`) + hero (teal 32px title "ACCOUNT SUMMARY" + blue 22px subtitle "Account Details and Usage") + **4 stat cards** in a row (Account Number / Current Consumption / Billing Cycle / Account Type), each with a 75×75 tinted-circle icon (`account-summary-{number,consumption,billing,type}.svg`) and 26px value; below that a **2-column grid** — left column shows `ACCOUNT INFORMATION` + `LINKED METER` `<dl>` panels with 14px `AvantGarde Md BT` labels (`--color-account-summary-label`) / values (`--color-account-summary-value`) separated by `--color-account-summary-divider` and a green **Active** status via `--color-account-summary-status-active`; right column shows `CONSUMPTION OVERVIEW` (24px teal title, orange-border `This Month` chip, 26px hero value, and an **inline SVG line chart** with cubic-Bézier smoothing + gradient area fill using `--color-account-summary-chart-{line,fill-start,fill-end}` — the chart is force-`direction: ltr` so timeline flows oldest→newest in every locale) + `QUICK ACTION` with 2 blue cards reusing `profile-quick-pay.svg` / `profile-quick-history.svg`. Data is currently seeded from the Figma mock (Ahmed Ali / MT-765432 / DUQM / etc.) via `computed` view-models that depend on the language signal so labels re-translate on switch — swap the mocks for an `httpResource` keyed on the `account()` input signal when the backend endpoint lands. Guarded by `loginPromptGuard`. Translation namespace: `accountSummary`.

### Shared (Primary Reuse Zone)
- `src/app/shared/components/*`: reusable standalone visual components.
- `src/app/shared/formly/*`: dynamic form system and custom field types.
- `src/app/shared/services/*`: reusable business/platform services.
- `src/app/shared/interceptors/*`: cross-cutting HTTP behaviors.
- `src/app/shared/guards/*`: route protection logic.

### Styling & Localization
- `src/styles/global.theme.scss`: global typography/accessibility/loading classes and shared motion utilities (for example `.page-enter` route content transition with reduced-motion fallback). Also defines:
  - `@keyframes skeleton-shimmer` — consumed by `SkeletonLoaderComponent`.
  - `.stagger-1` → `.stagger-5` — animation-delay utilities (60ms steps) for list enter animations.
  - `.card-lift` — reusable hover-elevation class (`translateY(-3px)` + shadow); safe to apply to any interactive card.
  - `.focus-ring` — reusable `:focus-visible` outline using `--color-teal`.
  - `.reveal-fade`, `.reveal-fade-up`, `.reveal-fade-in-x` — initial hidden states consumed by `[appScrollReveal]`. The directive adds `.is-visible` when the element enters the viewport. RTL-safe (logical translate). Respects `prefers-reduced-motion`.
  - `::view-transition-old(root)` / `::view-transition-new(root)` — native browser cross-fade for route transitions (Angular `withViewTransitions()`). Unsupported browsers degrade gracefully (no animation, no JS cost).
  - Global cursor baseline: `button:not(:disabled)` → `cursor: pointer`, `button:disabled` → `cursor: not-allowed`.
- `src/styles/themes/_light-theme.scss`, `_dark-theme.scss`, `_green-theme.scss`: CSS variable theme classes.
- `src/assets/i18n/en.json`, `src/assets/i18n/ar.json`: translation catalogs.

---

## 1.5) Modern Angular 22 Patterns (Mandatory for new code)

This project targets **Angular 22**. New components, services, and directives must use the modern reactive APIs below. Legacy files may continue to use older APIs until they are touched; when you edit a legacy file for any reason, migrate the surrounding code in the same change.

### Dependency Injection
- Use `inject()` for all dependencies. **Do not** use constructor parameter injection in new code.
  ```ts
  // GOOD
  private readonly router = inject(Router);
  // AVOID
  constructor(private router: Router) {}
  ```
- For reactive cleanup, prefer `DestroyRef`:
  ```ts
  private readonly destroyRef = inject(DestroyRef);
  someStream$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(...);
  ```

### Component API
- `standalone: true` is the only acceptable mode (also the Angular 19+ default; do not declare it explicitly unless overriding a tool).
- Inputs: `input()` / `input.required<T>()` signals. Avoid `@Input()` in new components.
- Outputs: `output<T>()`. Avoid `EventEmitter` in new components.
- Two-way binding: `model<T>()`.
- Queries: `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()` signal queries. Avoid `@ViewChild()`.
- Change detection: `changeDetection: ChangeDetectionStrategy.OnPush` for every new component. Reactivity comes from signals, not Zone.

### Reactivity
- Local state: `signal()`. Derived values: `computed()`. Side effects: `effect()`.
- Convert RxJS streams to signals with `toSignal()`; convert signals to streams with `toObservable()`.
- Prefer `linkedSignal()` for state that resets when an upstream signal changes (Angular 19+).
- For HTTP-backed reactive state, prefer `httpResource()` (Angular 19+) or `resource()` over manual `BehaviorSubject` plumbing.

### Templates
- Built-in control flow only: `@if`, `@else if`, `@else`, `@for`, `@switch`. Never use `*ngIf` / `*ngFor` / `*ngSwitch` in new templates.
- Every `@for` must have a `track` expression (`@for (item of items(); track item.id)`).
- Use `@let` to bind expensive expressions or async signal reads.
- Lazy-load below-fold sections, heavy widgets, and conditional UI with `@defer`:
  ```html
  @defer (on viewport) {
    <app-media-center-section />
  } @placeholder {
    <app-skeleton-loader variant="card" [count]="3" />
  }
  ```

### Routing
- All routes are lazy: `loadComponent: () => import('./...').then(m => m.XComponent)`. Never add an eager `component:` reference for a new route.
- `withComponentInputBinding()` is enabled — bind route params / query params / `data` directly as component `input()`s:
  ```ts
  // route: /:lang/service-details?service=water
  readonly service = input<string>(); // auto-bound from query param
  readonly lang = input<string>();    // auto-bound from path param
  ```
- `withViewTransitions()` is enabled — never re-add `@angular/animations` route triggers for page-level fades. Use the `::view-transition-*` styles in `global.theme.scss` to customize.
- `withPreloading(PreloadAllModules)` warms lazy chunks after first paint. Don't disable.

### HTTP / Services
- Never call `HttpClient` from a component. Use [base-crud.service.ts](src/app/shared/services/base-crud.service.ts) or a feature service.
- Endpoint strings live in [src/app/constants.ts](src/app/constants.ts). Never inline a URL.
- Inside services, prefer `httpResource()` for read-mostly reactive endpoints.

### Images
- Use Angular's `NgOptimizedImage` (`<img ngSrc="...">`) for any `<img>` with known intrinsic dimensions — automatic lazy loading, srcset, LCP priority. Mark above-fold hero images with `priority`.
- Decorative or background images stay in CSS via theme tokens.

### Animations
- Page transitions: handled by `withViewTransitions()` (native CSS, no `@angular/animations` needed).
- Scroll-reveal: `[appScrollReveal]` directive (see §2).
- List / grid / accordion item add-remove-reorder: `[appAutoAnimate]` directive backed by `@formkit/auto-animate` (see §2).
- Reduced motion: read from `MotionService.prefersReducedMotion()` signal (see §3). Do not call `window.matchMedia` directly in components.
- Custom keyframe animations stay in component SCSS and must include a `@media (prefers-reduced-motion: reduce)` block.

### SSR Safety
- Hydration is on (`provideClientHydration(withEventReplay())`). Any code that touches `window`, `document`, `navigator`, `localStorage`, `IntersectionObserver`, or `matchMedia` must be wrapped in `isPlatformBrowser(this.platformId)`.

### Error handling
- All HTTP transport errors flow through [`errorInterceptor`](src/app/shared/interceptors/error.interceptor.ts). **Do not** add component-local `try/catch`, `hasError` flags, `console.error`, or `alert()` for HTTP failures.
- All user-facing toasts go through [`ToastService`](src/app/shared/services/toast.service.ts) — never inject PrimeNG `MessageService` directly. Pass a translation key, never a hardcoded string.
- For reactive read-mostly state, prefer `httpResource()` and surface `resource.error()` in the template via `app-skeleton-loader` for loading and a small "could not load" UI for the error branch (`errors.loadFailedTitle` / `errors.loadFailedDetail` are in both i18n catalogs).

### Accessibility (WCAG AA)
- `@angular/cdk` is installed. Reuse CDK primitives before hand-rolling ARIA:
  - **Modals / popups** must use `cdkTrapFocus cdkTrapFocusAutoCapture` on the dialog container (already applied to `app-otp-modal`, `app-success-alert-modal`, and the home video preview).
  - **Toast announcements** are auto-routed through `LiveAnnouncer` by `ToastService`.
- **Icon-only buttons** must have `aria-label` (use a translation key); the icon `<img>` gets `aria-hidden="true"` and empty `alt=""`.
- **Skip-link** target `id="main-content"` must remain on the primary `<main>` of every page — do not remove or rename.
- Custom interactive widgets (filter dropdowns, custom selects, expanders) must respond to `Escape` (close), `Enter` / `Space` (activate), and `Tab` / `Shift+Tab` (navigate).
- Color contrast: all token combinations in §1 are WCAG AA-verified. Any new badge/pill combination must be checked before adoption.

### Performance
- **Lazy routes** (see §1.5 Routing) — no eager `component:` route in [app.routes.ts](src/app/app.routes.ts).
- **`OnPush`** on every new component (already applied across the project).
- **`@defer`** any below-fold heavy section (chart, map, video, large grid) with an `app-skeleton-loader` placeholder.
- **`NgOptimizedImage`** (`<img ngSrc="...">`) on every raster `<img>`. Mark above-fold/LCP heroes with `priority`. Skip for small SVG icons (no benefit).
- **`takeUntilDestroyed(inject(DestroyRef))`** on every `.subscribe()` outside a constructor's auto-context. No `Subject<void>` `destroy$` patterns.

---

#### Design Token CSS Variables (defined in all three theme files)
| Variable | Value (light) | Figma token |
|---|---|---|
| `--color-teal` | `#008c98` | Primary/blue |
| `--color-primary-blue` | `#0076bf` | Primary/Blue (section kicker) |
| `--color-teal-dark` | `#00788b` | Secondary/Dark Green |
| `--color-orange` | `#e8a712` | Primary/Orange |
| `--color-dark-blue` | `#083a81` | Secondary/Dark Blue |
| `--color-body-text` | `#2b2b2b` | Black #2b2b2b |
| `--color-text-neutral` | `#4a4a4a` | Neutral text tone used in auth/help text |
| `--color-text-strong` | `#0d121c` | Strong text tone used for labels/dividers |
| `--color-gray` | `#959ca2` | Secondary/Gray |
| `--color-light-green` | `#5db4bb` | Light Green |
| `--color-otp-border` | `#b3dde0` | Secondary Color |
| `--color-modal-bg` | `#ffffff` | White (modal card — theme-invariant) |
| `--color-modal-input-bg` | `#ffffff` | White (OTP input bg — theme-invariant) |
| `--color-modal-scrim` | `rgba(47, 58, 73, 0.58)` | Global modal/page-dimming overlay behind popup cards |
| `--color-otp-overlay` | `rgba(0, 10, 24, 0.62)` | OTP modal deep-navy scrim (darker than modal-scrim; used in auth flows) |
| `--color-input-border` | `#e0e0e0` | Login/Create-account input outline |
| `--color-placeholder-dimmed` | `#859293` | Dimmed placeholder and helper-text tone (quick-action labels, form hints) |
| `--color-placeholder-muted` | `rgba(133, 146, 147, 0.57)` | Further-muted placeholder variant (57% opacity of dimmed) |
| `--color-orange-hover` | `#cf9210` | Primary/Orange hover state |
| `--color-alert-danger` | `#ff0000` | Notification danger badge |
| `--color-auth-card-shadow` | `#c9e7e9` | Auth card drop-shadow tint |
| `--color-surface-soft` | `#fafafa` | Soft surface/hover background |
| `--color-skip-link-bg` | `#005fcc` | Accessibility skip-link background |
| `--color-page-backdrop` | `#001a3f` | Auth page base background |
| `--color-overlay-start` | `rgba(0, 26, 63, 0)` | Auth hero overlay start |
| `--color-overlay-mid` | `rgba(0, 120, 139, 0.536)` | Auth hero overlay mid |
| `--color-overlay-end` | `rgba(0, 26, 63, 0.8)` | Auth hero overlay end |
| `--color-request-panel-border` | `#92b5b8` | Service request section panel border |
| `--color-request-panel-bg` | `rgba(146, 181, 184, 0.04)` | Service request section panel surface |
| `--color-request-panel-shadow` | `rgba(0, 0, 0, 0.05)` | Service request section panel drop shadow tint |
| `--color-request-summary-bg` | `#f0f8f9` | Request details summary hero card background |
| `--color-filter-dropdown-bg` | `rgba(232, 167, 18, 0.10)` | Filter dropdown trigger pill background (warm orange tint) |
| `--color-notification-success` | `#00870e` | Notifications success state title/icon/border tone |
| `--color-notification-warning` | `#f4b41e` | Notifications warning state title/icon/border tone |
| `--color-notification-danger` | `#c80003` | Notifications danger state title/icon/border tone |
| `--color-dashboard-rejected` | `#e30d0d` | Dashboard rejected status text/icon color |
| `--color-dashboard-rejected-bg` | `#e30d0d1a` | Dashboard rejected status pill background (10%) |
| `--color-dashboard-recent-inquiry-bg` | `#fff9f1` | Dashboard recent submitted inquiry card background |
| `--color-dashboard-recent-service-bg` | `#9fdaff` | Dashboard recent submitted service card background |
| `--color-dashboard-recent-complaint-bg` | `#c9e7e9` | Dashboard recent submitted complaint card background |
| `--color-summary-surface` | `#22b9ff12` | Dashboard summary card panel background |
| `--color-quick-actions-surface` | `#fefcf6` | Dashboard quick actions panel background |
| `--color-quick-action-danger-icon-bg` | `#8c1e3921` | Dashboard quick action danger icon circle background |
| `--color-quick-action-warning-icon-bg` | `#e8a71217` | Dashboard quick action warning icon circle background |
| `--color-recent-services-surface` | `#ebf6f7` | Dashboard recent services panel background |
| `--color-chart-services` | `#9ad2d7` | Donut chart services segment fill (Figma Ellipse 12) |
| `--color-chart-complaints` | `#b8dbf2` | Donut chart complaints segment fill |
| `--color-chart-inquiries` | `#ffd370` | Donut chart inquiries segment fill (Figma Ellipse 11) |
| `--color-chart-services-dot` | `#cce8eb` | Legend dot for services (lighter than segment fill) |
| `--color-chart-complaints-dot` | `#b8dbf2` | Legend dot for complaints |
| `--color-chart-inquiries-dot` | `#ffe9b7` | Legend dot for inquiries (lighter than segment fill) |
| `--color-chart-services-pct` | `#0562b9` | Donut percentage label color — services |
| `--color-chart-complaints-pct` | `#ea5e08` | Donut percentage label color — complaints |
| `--color-chart-inquiries-pct` | `#338526` | Donut percentage label color — inquiries |
| `--color-border-subtle` | `#e4e2e6` (light), `#3a3a3a` (dark), `#c8dcd5` (green) | Filter tab base line, dropdown/pagination borders |
| `--color-card-shadow-subtle` | `rgba(0,0,0,0.06)` (light/green), `rgba(0,0,0,0.25)` (dark) | Media card box-shadow |
| `--color-about-overlay-base` | `rgba(0,26,63,0.85)` (light/green), `rgba(0,26,63,0.92)` (dark) | About Us image overlay gradient strong stop (bottom) |
| `--color-about-overlay-fade` | `rgba(0,26,63,0.40)` (light/green), `rgba(0,26,63,0.55)` (dark) | About Us image overlay gradient mid stop (50%) |
| `--filter-icon-teal` | `brightness(0) saturate(100%) invert(35%) ... hue-rotate(152deg)` | CSS filter to tint black-stroke SVG `<img>` to `--color-teal` |
| `--filter-icon-orange` | `brightness(0) saturate(100%) invert(72%) ... hue-rotate(5deg)` | CSS filter to tint black-stroke SVG `<img>` to `--color-orange` |
| `--color-dropdown-shadow` | `rgba(0,0,0,0.08)` (light/green), `rgba(0,0,0,0.35)` (dark) | Dropdown menu panel drop-shadow |
| `--color-pagination-btn-hover-bg` | `rgba(232, 167, 18, 0.10)` (all themes) | Pagination button hover background tint |
| `--radius-sm` | `6px` | Small border radius (inputs, focus rings, skeleton) |
| `--radius-md` | `12px` | Medium border radius |
| `--radius-lg` | `16px` | Large border radius (cards, modals) |
| `--radius-xl` | `24px` | Extra-large border radius |
| `--radius-pill` | `50px` | Full pill border radius (badges, tags) |
| `--transition-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` | Fast micro-interaction (hover state, button active) |
| `--transition-base` | `250ms cubic-bezier(0.4, 0, 0.2, 1)` | Standard UI state transition |
| `--transition-slow` | `400ms cubic-bezier(0.22, 1, 0.36, 1)` | Slow/spring enter animation |
| `--skeleton-base` | `#e9ecef` (light), `#2a2a2a` (dark), `#d4e6d5` (green) | Skeleton loader base fill |
| `--skeleton-highlight` | `#f8f9fa` (light), `#3d3d3d` (dark), `#e8f2e9` (green) | Skeleton loader shimmer highlight |
| `--color-notification-surface` | `rgba(232, 167, 18, 0.04)` | Notifications container panel background |
| `--color-notification-scroll-track` | `rgba(218, 156, 12, 0.09)` | Notifications custom scrollbar track tint |
| `--color-notification-pagination-active` | `rgba(232, 167, 18, 0.22)` | Notifications active pagination item background |
| `--color-inquiry-status-approved` | `#00BD13` | Inquiry page approved status text/icon color |
| `--color-inquiry-status-approved-bg` | `#00BD131A` | Inquiry page approved status pill background |
| `--color-inquiry-status-pending` | `#da9c0c` | Inquiry page pending status text/icon color |
| `--color-inquiry-status-pending-bg` | `rgba(218, 156, 12, 0.09)` | Inquiry page pending status pill background |
| `--color-account-selected-bg` | `#fbf4e3` | My Profile — selected row in "Select your account" list (warm cream) |
| `--color-account-scroll-track` | `rgba(0, 26, 63, 0.04)` | My Profile — scrollable accounts list scrollbar track |
| `--color-account-scroll-thumb` | `rgba(232, 167, 18, 0.55)` | My Profile — scrollable accounts list scrollbar thumb |
| `--color-account-overview-label` | `#5e73a2` | My Profile — Account Overview row label color (muted dark-blue) |
| `--color-table-divider` | `rgba(71, 144, 204, 0.14)` | My Profile — Bill Account table 1px row divider (Figma soft blue tint) |
| `--color-quick-action-bg` | `#eff7fa` | My Profile — Quick Action 2×2 card background (soft blue) |
| `--color-quick-action-icon-bg` | `#ffffff` | My Profile — Quick Action circular icon chip background |
| `--color-quick-action-icon-ring` | `rgba(8, 58, 129, 0.10)` | My Profile — Quick Action icon chip subtle 1px ring |
| `--color-account-summary-number-icon` | `#00bd13` | Account Summary — Account Number stat icon stroke (green) |
| `--color-account-summary-number-bg` | `rgba(0, 189, 19, 0.12)` | Account Summary — Account Number icon circle background |
| `--color-account-summary-consumption-icon` | `#0376b9` | Account Summary — Current Consumption droplet icon stroke |
| `--color-account-summary-consumption-bg` | `#e4f6ff` | Account Summary — Current Consumption icon circle background |
| `--color-account-summary-billing-icon` | `#9747ff` | Account Summary — Billing Cycle calendar icon stroke (purple) |
| `--color-account-summary-billing-bg` | `#efe4ff` | Account Summary — Billing Cycle icon circle background |
| `--color-account-summary-type-icon` | `#f4b41e` | Account Summary — Account Type house icon stroke (amber) |
| `--color-account-summary-type-bg` | `rgba(232, 167, 18, 0.16)` | Account Summary — Account Type icon circle background |
| `--color-account-summary-status-active` | `#00870e` | Account Summary — Account Information "Active" status text |
| `--color-account-summary-value` | `#5e5e62` | Account Summary — Information/Meter row value color |
| `--color-account-summary-label` | `#2b3d56` | Account Summary — Information/Meter row label color |
| `--color-account-summary-divider` | `rgba(71, 144, 204, 0.14)` | Account Summary — 1px row divider between info fields |
| `--color-account-summary-chart-line` | `#008c98` | Account Summary — Consumption Overview line stroke |
| `--color-account-summary-chart-fill-start` | `rgba(0, 140, 152, 0.24)` | Account Summary — Chart area gradient top stop |
| `--color-account-summary-chart-fill-end` | `rgba(0, 140, 152, 0)` | Account Summary — Chart area gradient bottom stop |
| `--color-account-summary-chart-grid` | `#efefef` | Account Summary — Chart baseline gridline color |
| `--color-account-summary-chart-chip-bg` | `rgba(179, 221, 224, 0.13)` | Account Summary — "This Month" filter chip background |
| `--color-account-summary-chart-chip-border` | `#00788b` | Account Summary — "This Month" filter chip 1px border |
| `--color-account-summary-quick-icon-bg` | `rgba(34, 185, 255, 0.07)` | Account Summary — Quick Action Pay/View card icon chip background |
| `--color-account-summary-fast-access` | `#859293` | Account Summary — "Fast Access" panel subtitle text |
| `--color-icon-muted` | `#cdcdcd` | Subtle dropdown/caret icon tint |
| `--color-inquiry-surface-start` | `#15a0ec` | Home inquiry card gradient start |
| `--color-inquiry-surface-end` | `#0084d4` | Home inquiry card gradient end |
| `--color-inquiry-glow` | `rgba(213, 237, 242, 0.78)` | Home inquiry card top glow |
| `--color-complaint-card-warm` | `#fff1dd` | Home complaints warm card background |
| `--color-complaint-card-sky` | `#b5efff` | Home complaints sky card background |
| `--color-complaints-water-quality-bg` | `#b3dde0` | Complaints page Water Quality card background |
| `--color-complaints-water-quality-icon-bg` | `#d1f5f8` | Complaints page Water Quality icon circle background |
| `--color-complaints-leakage-icon-bg` | `#ffe3ba` | Complaints page Water Leakage icon circle background |
| `--color-complaints-general-icon-bg` | `#89e5ff` | Complaints page General card icon circle background |
| `--color-section-soft-bg` | `#ebf6f7` | Soft section background |
| `--color-white-12` | `rgba(255, 255, 255, 0.12)` | White border tint |
| `--color-white-14` | `rgba(255, 255, 255, 0.14)` | White avatar tint |
| `--color-white-24` | `rgba(255, 255, 255, 0.24)` | White divider tint |
| `--color-white-07` | `rgba(255, 255, 255, 0.07)` | White subtle gradient tint |
| `--color-white-55` | `rgba(255, 255, 255, 0.55)` | White semi-transparent tint (post-auth splash progress bar) |
| `--color-white-78` | `rgba(255, 255, 255, 0.78)` | White lightly-muted tint (post-auth splash sub-message) |
| `--color-card-glow` | `rgba(202, 231, 233, 1)` | Card resting box-shadow glow color |
| `--color-card-glow-hover` | `rgba(202, 231, 233, 0.8)` | Card hover box-shadow glow color |
| `--color-faq-row-bg` | `rgba(255, 255, 255, 0.11)` | Home FAQ collapsed item background |
| `--color-nav-shell-bg` | `rgba(235, 246, 247, 0.08)` | Header nav pill background (Figma `#ebf6f714`) |
| `--color-regulations-section-bg` | `rgba(34, 185, 255, 0.06)` | Home APSR regulations section surface |
| `--color-regulations-card-border` | `rgba(176, 220, 232, 0.7)` | Home regulations card border (subtle teal) |
| `--color-regulations-card-glow` | `rgba(100, 200, 220, 0.22)` | Home regulations card outer glow |
| `--color-regulations-view-more-glow` | `rgba(191, 222, 255, 0.85)` | Home regulations header CTA glow |
| `--color-regulations-card-start` | `#ffffff` | Home regulations card gradient start (white) |
| `--color-regulations-card-end` | `#bce4ee` | Home regulations card gradient end (light teal-blue) |
| `--color-who-main-start` | `#74c9d2` | Home "Who we are" main card gradient start |
| `--color-who-main-end` | `#d5dde2` | Home "Who we are" main card gradient end |
| `--color-who-side-top` | `#65b8c4` | Home side card gradient top |
| `--color-who-side-mid` | `#2f699f` | Home side card gradient middle |
| `--color-who-side-bottom` | `#17325a` | Home side card gradient bottom |
| `--color-who-side-shadow-end` | `rgba(15, 33, 60, 0.48)` | Home side card decorative shadow gradient |
| `--color-service-process-gradient-start` | `rgba(164, 198, 198, 0)` | Service process gradient start (Figma linear stop 0%) |
| `--color-service-process-gradient-mid` | `rgba(116, 193, 219, 0.185)` | Service process gradient middle (Figma stop 37% with 50% layer opacity applied) |
| `--color-service-process-gradient-end` | `rgba(0, 140, 152, 0.5)` | Service process gradient end (Figma stop 100% with 50% layer opacity applied) |

> **Rule**: Never hardcode these hex values in component SCSS. Always reference via `var(--color-*)`.  
> `--color-modal-bg` and `--color-modal-input-bg` are intentionally `#ffffff` in all themes because the modal card is always rendered as a white surface (dark-theme only darkens the page background behind it).

---

## 1.7) Cross-browser & Safari Compatibility (Mandatory)

The app must render and behave correctly on Chromium, Firefox, **and Safari (macOS + iOS 15.4+)**. Safari/WebKit still lags on a handful of modern CSS features — always satisfy these rules when writing new styles:

### CSS prefixes (always pair the prefixed declaration BEFORE the unprefixed one)
- `backdrop-filter` → also write `-webkit-backdrop-filter` (Safari shipped the unprefixed property only in 18.0).
- `mask-image` / `mask-size` / `mask-position` / `mask-repeat` → mirror each with `-webkit-mask-*` (Safari < 15.4 supports only the prefixed form, several iOS Safari builds in active circulation still need it).
- `appearance: none` on `<button>` / `<input>` / `<select>` resets → also write `-webkit-appearance: none`.
- `background-clip: text` → also write `-webkit-background-clip: text` and pair with `-webkit-text-fill-color: transparent`.

### Viewport & meta (set once in [src/index.html](src/index.html), do not remove)
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` — `viewport-fit=cover` is required for `env(safe-area-inset-*)` to work on iPhone notch / Dynamic Island.
- `<meta name="color-scheme" content="light dark">` and per-theme `color-scheme: light|dark;` in [src/styles/themes/](src/styles/themes/) so Safari paints native scrollbars, the text caret and form controls in the right tone.
- `<meta name="apple-mobile-web-app-capable" content="yes">` (+ `mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`) for iOS Add-to-Home-Screen.
- `<meta name="theme-color" ...>` (light + dark variants) controls the Safari iOS address-bar tint. The two hex literals in those tags (`#008c98` mirrors `--color-teal`, `#001a3f` mirrors `--color-page-backdrop`) are the **only acceptable hardcoded color values** in the codebase — meta tags are parsed before any CSS loads, so they cannot reference a CSS variable. If the brand teal or page-backdrop tokens change, update these two values in the same commit.
- `<meta name="format-detection" content="telephone=no">` stops Safari iOS from auto-linking phone-shaped strings inside copy.

### Global baseline (in [src/styles/global.theme.scss](src/styles/global.theme.scss))
- `html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }` blocks iOS Safari from inflating text on orientation change.
- `body { -webkit-tap-highlight-color: transparent; }` removes the gray tap flash.
- Touch-only media query bumps form-input font-size to `max(16px, 1em)`, because **iOS Safari auto-zooms any focused input whose font-size is below 16px**. Keep new form fields styled within that query — do not duplicate the rule per page.

### Viewport units
- Never use `100vh` for full-screen layouts on its own — iOS Safari subtracts the URL bar from `vh`. Use `100dvh` (already at Safari 15.4+) and keep `100vh` as a fallback declared **first** so older engines still get a sensible height:
  ```scss
  min-height: 100vh;   /* fallback */
  min-height: 100dvh;  /* modern, Safari/iOS 15.4+ */
  ```

### JS / platform APIs
- Anything touching `window`, `document`, `navigator`, `localStorage`, `matchMedia`, `IntersectionObserver`, `ResizeObserver` must be gated by `isPlatformBrowser(inject(PLATFORM_ID))` — Safari is fine, the gate is for SSR / hydration.
- View Transitions API (`withViewTransitions()`) is Safari 18+ only; older Safari degrades silently to a static swap. Do not write `view-transition-name` rules without an `@supports (view-transition-name: foo)` fallback.

### When in doubt
- Verify in **macOS Safari 16+** and **iOS Safari 15.4+** (the floor versions the project supports) before shipping. Run `npm run build` to surface any prerender / SSR regressions.

---

## 2) Reusable Components Inventory

### Layout Components
1. Header
    - File: `src/app/layouts/header/header.component.ts`
    - Selector: `app-header`
    - Reuse for all authenticated/public shells unless a page explicitly hides it.
    - Reusable inputs: `logoSrc`, `navLinks`.
    - Behavior: language-aware route building, FAQ-page navigation, active-link highlighting, and language toggle.
    - Auth-aware variants: guest state renders Login CTA; authenticated state renders expanded nav (`Complaints`, `Inquiry`, `My Dashboard`) with notifications and profile chip.
    - Reusable behavior: notifications icon routes to `/:lang/notifications`.
2. Footer
    - File: `src/app/layouts/footer/footer.component.ts`
    - Selector: `app-footer`
    - Reuse for all shells except routes intentionally excluded.
    - Reusable inputs: `logoSrc`, `menuLinks`, `contactInfo`, `socialLinks`, `legalLinks`.
    - Behavior: language-aware route building, ngx-translate labels, RTL-ready layout, and theme-token-based gradient/background styles.

### Shared UI Components
1. Global Loader
    - File: `src/app/shared/components/loader.type.ts`
    - Selector: `app-global-loader`
    - Reuse for global async feedback; controlled by `LoaderService` and `loaderInterceptor`.
2. Card
    - File: `src/app/shared/components/card.component.ts`
    - Selector: `app-card`
    - Reuse for content cards. Supports reusable inputs: `title`, `subtitle`, `imageSrc`, `customClass`.
3. Map
    - File: `src/app/shared/components/maps.type.ts`
    - Selector: `app-map`
    - Reuse when map/marker behavior is needed; do not recreate map logic in pages.
4. Reusable Button
    - File: `src/app/shared/components/button.component.ts`
    - Selector: `app-button`
    - Variants: `login-primary`, `login-outline`, `action-primary`, `action-outline`, `otp-verify`, `service-apply`.
    - Use `fullWidth: true` for full-width login actions.
    - Use `otp-verify` for compact OTP/verification modal primary actions.
    - Use `service-apply` for compact CTA buttons inside service offering cards (`226x35`, radius `20`).
5. Service Offering Card
    - File: `src/app/shared/components/service-offering-card/service-offering-card.component.ts`
    - Selector: `app-service-offering-card`
    - Reuse for Home/services-style cards with full-bleed background image, bottom translucent gradient + glass blur text overlay (`backdrop-filter`), and CTA layout.
    - Reusable inputs: `titleKey`, `descriptionKey`, `imageSrc`, `imageAltKey`, `actionLabelKey`.
    - Reusable output: `apply`.
    - RTL behavior: CTA chevron icon auto-mirrors when page direction is `rtl` via `:host-context([dir='rtl'])` in component SCSS.
    - Note: internal `.service-card` uses `width: 100%` — the host element width controls the card size. Default host width is `268px` (set via `:host`); override from parent with `app-service-offering-card { width: <n>px; }` or set the parent grid columns.
6. OTP Modal
    - File: `src/app/shared/components/otp-model/otp-modal.component.ts`
    - Selector: `app-otp-modal`
    - Reuse for OTP verification popups on auth flows (`login`, `create-account`) instead of page-level duplicated OTP markup/logic.
    - Inputs: `isOpen`, `otpLength` (default `4`), `maskedMobileNumber`, `expiresAtUtc` (ISO string or `Date` — drives the built-in countdown), `submitting` (disables verify + resend), `errorKey` (translation key for an inline `role="alert"` error message — e.g. `login.otp.errors.wrongCode`), `otpIllustrationSrc`, `closeIconSrc`.
    - Outputs: `verified` (emits the entered code as a string), `resend` (emits when the user taps resend after the timer hits 0), `closed`.
    - Behavior: shows an `MM:SS` countdown derived from `expiresAtUtc`; `Resend` is disabled while `remainingSeconds > 0` or `submitting` is true; rotating `expiresAtUtc` (e.g. after a successful resend) auto-resets the digits and refocuses position 0; expiry expiration shows `login.otp.expired`. SSR-safe: countdown only runs in the browser.
7. Success Alert Modal
    - File: `src/app/shared/components/success-alert/success-alert-modal.component.ts`
    - Selector: `app-success-alert-modal`
    - Reuse for post-action confirmation popups (for example: account-created confirmation with Done CTA).
    - Variants: `default`, `service-request` (Figma-aligned compact top-positioned modal with reference number, custom icon assets, and dimmed backdrop).
8. Media Center Section
    - File: `src/app/shared/components/media-center-section/media-center-section.component.ts`
    - Selector: `app-media-center-section`
    - Reuse for media/news gallery blocks with featured video preview modal and responsive card layout.
    - Reusable outputs/behaviors: click-to-open full-screen video preview, language-aware "View More" navigation.
9. FAQ Section
    - File: `src/app/shared/components/faq-section/faq-section.component.ts`
    - Selector: `app-faq-section`
    - Reuse for two-column FAQ blocks with left intro content and right accordion list.
    - Reusable behaviors: language-aware "View More" navigation to `/:lang/faq`, expandable/collapsible FAQ rows, and translatable content keys.
10. Regulations Section
    - File: `src/app/shared/components/regulations-section/regulations-section.component.ts`
    - Selector: `app-regulations-section`
    - Reuse for APSR regulations/policy cards section with header CTA, file-type visual, metadata rows, and dual actions (View Details / Download PDF).
    - Reusable behaviors: language-aware "View More", view-details, and download CTA navigation hooks.
11. Service About Section
    - File: `src/app/shared/components/service-about-section/service-about-section.component.ts`
    - Selector: `app-service-about-section`
    - Reuse for service detail summaries with underlined section title, Apply Now CTA, metadata pills (time/fees/eligibility), and required-documents bullet list.
    - Reusable inputs: `embedded` (renders compact card mode for 2-column detail layouts), `rootClass` (optional host class hook for page-level styling), `estimatedTime`/`fees`/`eligibility`/`dynamicDocuments` (API-driven content overrides), and `serviceName` (for forwarding backend category number to `/:lang/service-request`).
    - Assets: uses Figma-exported icon assets in `src/assets/images/service-icon-*.svg` (`clock`, `fees`, `eligibility`, `document`).
    - Reusable behaviors: language-aware Apply Now routing to `/:lang/service-request` and translation-driven document list content.

11. Skeleton Loader
    - File: `src/app/shared/components/skeleton-loader/skeleton-loader.component.ts`
    - Selector: `app-skeleton-loader`
    - Variants: `text` (paragraph lines), `card` (image+body), `avatar` (circle+lines), `table-row` (horizontal cells).
    - Reusable inputs: `variant` (SkeletonVariant), `count` (number of repeated items).
    - Uses `--skeleton-base` / `--skeleton-highlight` CSS tokens (theme-aware, defined in all three theme files).
    - Respects `prefers-reduced-motion`: shimmer animation disabled, static fill shown instead.
12. Post-Auth Splash
    - File: `src/app/shared/components/post-auth-splash/post-auth-splash.component.ts`
    - Selector: `app-post-auth-splash`
    - Reuse for full-viewport branded loading overlays shown between auth success and the first navigated route (login → home, create-account → home).
    - Reusable inputs: `greetingKey` (translate key, string), `messageKey` (translate key, string), `logoSrc` (image path, string).
    - Renders: teal gradient background, white-tinted logo, greeting + sub-message text, three bouncing dots, 2-second progress bar at bottom.
    - Uses `--color-teal-dark`, `--color-teal`, `--color-dark-blue`, `--color-modal-bg`, `--color-white-55`, `--color-white-78`.
    - Respects `prefers-reduced-motion`: all animations disabled, progress bar shown at full width.

13. Filter Dropdown
    - File: `src/app/shared/components/filter-dropdown/filter-dropdown.component.ts`
    - Selector: `app-filter-dropdown`
    - Reuse for month/year (and any label-value) filter pills across all pages (notifications, inquiry, dashboard).
    - Reusable inputs: `options: FilterOption[]`, `selectedValue: string` (labelKey of selected option).
    - Reusable output: `selectionChange: EventEmitter<FilterOption>`.
    - Exported constants: `MONTH_OPTIONS` (Jan–Dec using `filterDropdown.months.*`), `YEAR_OPTIONS` (2024–2027 using `filterDropdown.years.*`).
    - Behavior: toggle open/close on click, close on outside click (`@HostListener`), orange pill border styling (Figma-accurate), animated panel (`fd-panel-in`), smooth chevron rotation.
    - Uses only theme tokens: `--color-orange`, `--color-orange-soft-shadow`, `--color-modal-bg`, `--color-input-border`, `--color-dropdown-shadow`, `--color-section-soft-bg`, `--color-teal`, `--color-body-text`, `--radius-pill`, `--radius-md`.
14. Login Prompt Dialog
    - File: `src/app/shared/components/login-prompt-dialog/login-prompt-dialog.component.ts`
    - Selector: `app-login-prompt-dialog`
    - Mounted **once** in [app.component.html](src/app/app.component.html); do not embed it on individual pages.
    - Driven entirely by `AuthPromptService` (signal `isOpen` + `confirm()` / `cancel()`). The dialog itself has no public inputs/outputs.
    - Renders a centered `role="alertdialog"` modal (logo + title + message + Cancel / Log in buttons) with `cdkTrapFocus cdkTrapFocusAutoCapture`. Esc key, scrim click, and Cancel all call `cancel()`. Log in calls `confirm()`.
    - Translation keys live under `auth.loginRequired.*`.
15. Add Account Modal
    - File: `src/app/shared/components/add-account-modal/add-account-modal.component.ts`
    - Selector: `app-add-account-modal`
    - Reuses the co-located `src/app/public/create-account/form.json` (base fields only — first 7 entries, before the org-only company section) so the same Formly types (`account-type-toggle`, `section-header`, `custom-input`), validators, and translation keys drive both the standalone registration page and this in-app "add another account" popup.
    - Inputs: `isOpen: boolean` (default `false`), `submitting: boolean` (parent-driven — disables the submit button + swaps its label to `common.submitting`).
    - Outputs: `closed`, `created<AddAccountFormValue>`. Esc key, scrim click, and the orange X all fire `closed`. Submit builds an `AddAccountFormValue` (`accountType`, `firstName`, `lastName`, `civilId`, `emailAddress`, `address`, `phone`, plus optional `companyName` / `crNumber` / `companyPhone` / `companyAddress` when Organization is selected) and emits `created`. The parent is responsible for calling the backend and resetting `isOpen`.
    - `role="dialog" aria-modal="true"` with `cdkTrapFocus cdkTrapFocusAutoCapture`. Reuses `ButtonComponent` (`variant="login-primary"` full-width) for the submit CTA. Translation keys live under `myProfile.addAccountModal.*`.

### Reusable Directives
Source folder: `src/app/shared/directives/` (barrel export at `index.ts`).

1. `ScrollRevealDirective`
    - File: `src/app/shared/directives/scroll-reveal.directive.ts`
    - Selector: `[appScrollReveal]`
    - Reveal-on-scroll via `IntersectionObserver`. Adds `.reveal-<variant>` initially (hidden state) and `.is-visible` when the element enters the viewport.
    - Reusable inputs: `variant` (`'fade-up' | 'fade' | 'fade-in-x'`, default `'fade-up'`), `delay` (ms), `threshold` (0–1, default `0.15`), `once` (default `true`).
    - SSR-safe (skips observer on server; element renders visible). Respects `prefers-reduced-motion` via `MotionService`.
    - Pair with CSS classes defined in `global.theme.scss`. RTL-aware translate via `[dir="rtl"]`.
2. `AutoAnimateDirective`
    - File: `src/app/shared/directives/auto-animate.directive.ts`
    - Selector: `[appAutoAnimate]`
    - Drop-in smooth add/remove/reorder animations for any container of children (lists, grids, filter results, accordions). Backed by `@formkit/auto-animate` (2.3 kB MIT).
    - Reusable inputs: `animateDuration` (ms, default `220`), `animateEasing` (default `'ease-in-out'`).
    - Auto-disables when `MotionService.prefersReducedMotion()` is true.

### Reusable Formly Field Types (Registered)
Source of truth: `src/app/shared/formly/formly-config.module.ts`

1. `custom-input`
    - File: `src/app/shared/formly/custom-components/custom-input.type.ts`
    - Reusable props: `variant`, `dimmed`, `disabled`, `prefixIconSrc`, `type`, `inputmode`, `autocomplete`, `dir`.
    - Direction behavior: input supports `props.dir` (`'ltr' | 'rtl' | 'auto'`); defaults to `'auto'` so mixed-language placeholders/values keep natural direction without page-level overrides.
2. `custom-dropdown`
    - Active file: `src/app/shared/formly/custom-components/drop-down/custom-dropdown.types.ts`
    - Reusable props: `placeholder`, `options`, `optionLabel`, `optionValue`, `showClear`, `dimmed`, `disabled`.
3. `custom-calendar`
    - File: `src/app/shared/formly/custom-components/custom-calendar.types.ts`
4. `custom-multiselect`
    - File: `src/app/shared/formly/custom-components/custom-multiselect.types.ts`
5. `searchable-select`
    - File: `src/app/shared/formly/custom-components/custom-searchable-select.types.ts`
6. `file`
    - File: `src/app/shared/formly/custom-components/custom-file.types.ts`
    - Reusable props: `multiple`, `accept`, `maxFileSize`, `chooseLabel`, `maxAttachmentSizeLabel`, `noFileSelectedLabel`, `dimmed`.
7. `custom-textarea`
    - File: `src/app/shared/formly/custom-components/custom-textarea.types.ts`
    - Reusable props: `label`, `placeholder`, `helperText`, `maxLength`, `readonly`, `compact` (renders the short 2-line variant — used for the "Another Reason" field on the complaint form), `rows`.
8. `account-type-toggle`
    - File: `src/app/shared/formly/custom-components/account-type-toggle.type.ts`
    - Two-tab segmented control (radio-group semantics) wired into a Formly field. Renders a full-width pill with two tabs; the active tab uses `--color-orange`.
    - Reusable props: `options` (array of `{ value, labelKey }`), `ariaLabel` (i18n key).
    - Sets the field's form-control value when a tab is clicked. Pair with sibling fields' `expressions.hide` (e.g. `model.accountType !== 'organization'`) to drive conditional sections.
9. `section-header`
    - File: `src/app/shared/formly/custom-components/section-header.type.ts`
    - Renders a translated `<h3>` heading inside a Formly field stream — used to label sections (e.g. "Applicant Details", "Company Details") without breaking out of the JSON form schema.
    - Reusable props: `labelKey` (translation key), `headerClass` (CSS class, defaults to `create-account-section-header`).

Important note:
- There is a duplicate dropdown implementation at `src/app/shared/formly/custom-components/custom-dropdown.types.ts`.
- Reuse and edit the registered dropdown path under `drop-down/` first unless a cleanup task explicitly removes duplication.

### Formly Reuse Helpers
1. Formly config registration
    - File: `src/app/shared/formly/formly-config.module.ts`
2. Translation extension
    - Files: `src/app/shared/formly/formly.validation.ts`, `src/app/shared/formly/formly.translate-extension.ts`
3. Common validators
    - File: `src/app/shared/formly/formly.validators.ts`
    - Standard reusable rules include `emailPattern`, `numbersOnly`, `fullNamePattern`, `mobileNumberLength`.
4. Field mutation helper service
    - File: `src/app/shared/services/formly.service.ts`

### JSON-Driven Form Configuration (Mandatory Pattern)
Every page that renders a Formly form MUST define its field configurations in a `form.json` file co-located with the page component, not inline in TypeScript.

**Rule**: Do NOT define `FormlyFieldConfig[]` arrays inline in component TypeScript. Every form field (including labels, placeholders, validators, props, and type) must live in a `form.json` file.

Pattern (followed by `create-account` and `login`):
1. Create `form.json` in the page folder (e.g., `src/app/public/my-page/form.json`).
2. Import it in the component: `import formConfig from './form.json';`
3. Assign to the fields property: `fields: FormlyFieldConfig[] = formConfig as unknown as FormlyFieldConfig[];`
4. Apply any runtime-only values (dropdown options, dynamic defaults) using `FormlyService` after load.

What belongs in `form.json`:
- `key`, `type`, `className`
- `validators.validation` (named validator string arrays)
- All `props` including `placeholder` (translation key string), `variant`, `required`, `type`, `inputmode`, `autocomplete`, `maxLength`, `pattern`, `prefixIconSrc` (static asset path string), `containerClass`, `inputClass`, `iconClass`, `dimmed`, `multiple`, `accept`, `maxFileSize`, `chooseLabel`, etc.

What stays in TypeScript (set programmatically after load):
- Dropdown `options` arrays (via `FormlyService.setDropdownValue()`)
- Any prop that depends on a runtime variable or API response.

Existing `form.json` references:
- `src/app/public/create-account/form.json`
- `src/app/public/login/form.json`

---

## 3) Reusable Services Inventory

1. API base CRUD abstraction
    - `src/app/shared/services/base-crud.service.ts`
    - Reuse for API GET/POST/PUT/DELETE before writing direct HTTP calls.
2. Resilient CRUD (timeout + retry + Retry-After honoring)
    - `src/app/shared/services/resilient-crud.service.ts`
    - Extension of `BaseCrudService<T>` that applies cross-cutting SLAs once: reads get an adaptive `timeout()` (from `NetworkService`) plus 2 retries with exponential backoff and `Retry-After` honoring on `429` / `503`; writes get `timeout()` only and are never retried (writes are not idempotent at the API layer). Also exposes `protected post<TReq, TRes>(url, body, context?: HttpContext): Observable<TRes>` for endpoints whose request and response shapes differ (the inherited `create<T>` constrains both sides to the same `T`) — same write SLA applied, and the optional `HttpContext` argument is the canonical way to opt out of cross-cutting interceptors per call (e.g. `skipErrorToast()` from [http-context.tokens.ts](src/app/shared/interceptors/http-context.tokens.ts)). **Feature services should extend this class instead of `BaseCrudService` so every endpoint inherits the same SLA.** Don't add ad-hoc `timeout()` / `retry()` operators in components or feature services.
3. Adaptive network timeout source
    - `src/app/shared/services/network.service.ts`
    - SSR-safe wrapper over the Network Information API. Exposes `readTimeoutMs()` / `writeTimeoutMs()` so 2G/3G clients don't fail fast while desktop clients still hit a hard cap. Single source of timeout literals — never hardcode milliseconds in a `timeout(...)` call.
4. Auth/session state
    - `src/app/shared/services/auth.service.ts`
    - OTP-flow session store for **dual-token cookie auth** (see [AUTH.md](.github/instructions/AUTH.md) for the verified end-to-end probe). The HttpOnly `refresh_token` cookie is set by `/api/v1/auth/otp/verify` and rotated by `/api/v1/auth/token/refresh`; JS never touches it. The access JWT (~1h) is held in an **in-memory `signal<string | null>`** (private to `AuthService`) and exposed via `getAccessToken()` for the interceptor — never persisted to `sessionStorage` / `localStorage`, so XSS cannot exfiltrate it. `setSession({ accessToken, accessTokenExpiresAtUtc })` after `AuthApiService.verifyOtp` decodes the JWT's `contact_id` / `account_type` claims (`account_type` is the string `"Personal"`/`"Organization"` — normalized to the numeric `0`/`1` enum via the file-local `mapAccountType` helper) and persists those non-secret bits plus the expiry to `sessionStorage` so `isAuthenticated` and `getSession()` stay synchronous across page reloads. `isAuthenticated` is a `computed()` signal that is true iff the stored expiry is still in the future. `refresh()` does **single-flight** access-token rotation via `shareReplay({ bufferSize: 1, refCount: false })` so concurrent 401s share one in-flight `/auth/token/refresh` call — used by the `errorInterceptor` 401 retry path, **and also by page reloads**: the in-memory JWT is empty after reload, the first protected call 401s, the existing single-flight refresh repopulates the signal via the cookie. `logout()` returns `Observable<void>`: it calls the backend so the server clears the HttpOnly `refresh_token` cookie (the only way — JS cannot delete HttpOnly cookies), then clears local metadata via `finalize` regardless of API outcome. `clearLocalSession()` resets local state without hitting the API (used by interceptor 401-bootstrap fallbacks). Contact-info cache is **in-memory only** (signal) — never persisted, so PII can't be read post-XSS. An **idle watchdog** auto-logs-out after 15 min of inactivity (`pointerdown` / `keydown` / `scroll` / `touchstart`, throttled to one refresh per 5 s); fires a translated toast and routes to `/:lang/login`. The constructor performs a one-time purge of legacy `auth_token` / `auth_contact` / `auth_access_token` keys from existing devices. `logDevCode(code)` prints the dev OTP to the console **only** in non-production builds. SSR-safe — every `sessionStorage`/`document` access is gated by `isPlatformBrowser`.
5. Auth API (login + registration OTP cycle + cookie lifecycle)
    - `src/app/shared/services/auth/auth-api.service.ts`
    - Extends `ResilientCrudService<never>`. Single surface for `/api/v1/auth/*`: `requestLoginOtp({ phone })`, `verifyOtp({ correlationId, code })`, `resendOtp({ correlationId })`, `startRegistration({ phone, civilId })`, `verifyRegistration(payload)`, `refresh()`, `logout()`. Every method goes through the inherited `post<TReq, TRes>(url, body, context?)` helper so the project's adaptive write `timeout()` is applied uniformly (writes are never retried). `refresh()` posts to `POST /api/v1/auth/token/refresh` (constant: `Constants.refreshTokenUrl`) — the browser auto-sends the HttpOnly `refresh_token` cookie, the server rotates it via fresh `Set-Cookie` (single-use — replaying returns `400 code:4012 "Refresh token has already been used or revoked."`), and returns `{ accessToken, accessTokenExpiresAtUtc }` in the body. `logout()` calls `POST /api/v1/auth/logout` so the server clears the cookie via `Set-Cookie: refresh_token=; expires=Thu, 01 Jan 1970 ...; path=/` (JS cannot delete HttpOnly cookies). Every call passes `skipErrorToast()` as the `HttpContext` argument so OTP/login/create-account components and the interceptor own the 4xx UI (wrong code, expired, locked, rate-limited, refresh-failed) without a duplicate global toast. Returns the full `ApiEnvelope<T>` (`{ result, isSuccess, errorMessageEn, errorMessageAr, code, ... }`) — see [auth.types.ts](src/app/shared/services/auth/auth.types.ts) for DTO shapes. `VerifyOtpResult` / `RefreshTokenResult` only carry `{ accessToken, accessTokenExpiresAtUtc }`; identity (`contactId`, `accountType`) is decoded from the JWT's `contact_id` / `account_type` claims by `AuthService.setSession`.
6. Complaints (cases) API
    - `src/app/shared/services/complaints/complaints-api.service.ts` + co-located [complaints.types.ts](src/app/shared/services/complaints/complaints.types.ts). Extends `ResilientCrudService<never>` — reads use `httpResource`, writes go through the inherited `post<TReq, TRes>()` helper so they always get the project's adaptive write `timeout()` (never retried).
    - `list()` returns an `httpResource<ApiEnvelope<ComplaintListItem[]>>` over `GET /api/v1/cases/complaints` (constant: `Constants.getComplaintsListUrl`). Component consumers store the resource as a field (`protected readonly data = api.list()`) and branch on `data.isLoading()` / `data.error()` / `data.value()?.result` in the template — loading state goes through `app-skeleton-loader`, the error branch reuses `errors.loadFailedDetail` + `common.retry`, and pagination is computed client-side via `linkedSignal` until the backend exposes page/size params. `ComplaintListItem` shape: `{ incidentId, ticketNumber, title, description, createdOn, status: { id, description, descriptionEn, descriptionAr } }`. Use the language-matched `status.descriptionEn` / `descriptionAr` for the badge text (the project's standard envelope is reused from [auth.types.ts](src/app/shared/services/auth/auth.types.ts)).
    - `detail(ticketNumber: () => string | null | undefined)` returns an `httpResource<ApiEnvelope<ComplaintDetailResult>>` over `GET /api/v1/cases/complaints/{ticketNumber}` (constant: `Constants.getComplaintDetailsUrl`, append the ticket). Stays idle when the factory returns null/empty. `ComplaintDetailResult` mirrors the create-payload discriminant fields (`opsComplaintCategory` + the matching primary sub-category id + optional secondary meter-issue / water-billing ids + `anotherReason`) plus `caseNumber`, `description`, `status`, and the CRM lookup names (`customerAccountName`, `primaryContactName`, etc.). Consumers resolve option-set ids to labels through `LookupApi.optionSet(...)` using the same field names as the complaint form. See [request-details.component.ts](src/app/public/request-details/request-details.component.ts) for the canonical wiring.
    - `submit(payload: CreateComplaintPayload)` calls `this.post<CreateComplaintPayload, CreateComplaintResponse>(Constants.createComplaintUrl, payload)` — inheriting the resilient write SLA. Returns the full envelope `ApiEnvelope<CreateComplaintResult>`. `CreateComplaintPayload` is a discriminated union by `opsComplaintCategory` (`1` = Water Leakage, `2` = Water Quality, `3` = General) — only send the sub-category field matching the active primary (`opsComplaintTypeForWaterLeakageComplaints` / `opsComplaintTypeQuality` / `opsComplaintTypeGeneral`). For general, conditionally include `opsSubComplaintMeterIssues` or `opsSubComplaintWaterBillingPayments` based on the visible secondary dropdown. `strComplaintDetails` and `strComplaintDescription` are both populated from the single complaint-details textarea. `strAnotherReason` is included only when the trigger id for "Other Reasons" is selected (id-matched via the form's `subCategoryTriggerIds` table). `caseTypeCode: '2'` (Complaint) and `caseOriginCode: '3'` (Portal) are static for the public web flow. Consumers gate with `if (!form.valid) { markAllAsTouched(); return; }`, hold a local `isSubmitting` signal to lock the submit button while the call is in flight, and on the response: if `isSuccess` → set a `submitReferenceNumber` signal from `result?.ticketNumber` and open the success modal; if `isSuccess === false` → `toast.error('…submitFailedTitle', '…submitFailedDetail', response)` so the server's localized `errorMessageEn`/`Ar` shows verbatim. The error branch is a no-op because `errorInterceptor` toasts 5xx / 0 / 503 / timeout automatically. See [complaint-request.component.ts](src/app/public/complaint-request/complaint-request.component.ts) for the canonical wiring (note: the imported `form.json` is `structuredClone`d at field-initializer time so per-instance mutations from `formlyService.setDropdownValue()` / `setFieldVisibility()` don't leak across navigations).
7. Inquiry (cases) API
    - `src/app/shared/services/inquiry/inquiry-api.service.ts` + co-located [inquiry.types.ts](src/app/shared/services/inquiry/inquiry.types.ts). Extends `ResilientCrudService<never>`.
    - `list()` returns an `httpResource<ApiEnvelope<InquiryListResult>>` over `GET /api/v1/cases/inquiries` (constant: `Constants.getInquiriesListUrl`). `InquiryListResult` shape: `{ inquiries: InquiryListItem[] }` where each item is `{ inquiryId, name, inquiry, createdOn, status: { id, description, descriptionEn, descriptionAr } }`. `name` holds the reference number (e.g. `INQ-000008`). Use language-matched `status.descriptionEn` / `descriptionAr` for the badge. Consumer pattern: same as `ComplaintsApi.list()` — branch on `isLoading()` / `error()` / `value()?.result?.inquiries` in the template; loading → `app-skeleton-loader`, error → `errors.loadFailedDetail` + `common.retry` button.
    - `submit(payload: CreateInquiryPayload)` calls `this.post<CreateInquiryPayload, CreateInquiryResponse>(Constants.createInquiryUrl, payload)` — inheriting the resilient write SLA. `CreateInquiryPayload` shape: `{ inquiry: string }`. `CreateInquiryResult` shape: `{ name: string }` (reference number). On `isSuccess` surface the reference via `inquiryPage.success.title` (contains `{{ ref }}` placeholder). On `isSuccess === false` call `toast.error(...)`.

8. Home page (CMS) API
    - `src/app/shared/services/home-page/home-page-api.service.ts` + co-located [home-page.types.ts](src/app/shared/services/home-page/home-page.types.ts).
    - `aboutUs()` returns an `httpResource<ApiEnvelope<HomePageAboutResult>>` over `GET /api/v1/home-page/about-us` (constant: `Constants.getHomeAboutUsUrl`). Same consumer contract as `ComplaintsApi.list()` — read `isLoading()` / `error()` / `value()?.result` in the template; loading goes through `app-skeleton-loader`, error reuses `errors.loadFailedDetail` + `common.retry`. Response shape: `{ titleEn, titleAr, values: HomePageAboutValue[] }` where each value is `{ valueId, titleEn, titleAr, descriptionEn, descriptionAr, order }` (`order` is a 1-based string — sort numerically). Pick the language-matched `titleEn`/`titleAr` and `descriptionEn`/`descriptionAr` based on `LanguageService.getCurrentLanguage()`. Consumed by [home.component.ts](src/app/public/home/home.component.ts) for the "Who We Are" section (first value → large primary card with `water.svg`, remaining values → side cards).
    - `banner()` returns an `httpResource<ApiEnvelope<HomePageBannerItem[]>>` over `GET /api/v1/home-page/banner` (constant: `Constants.getHomeBannerUrl`). Each item is `{ bannerId, titleEn, titleAr }`. Consumed by [home.component.ts](src/app/public/home/home.component.ts) — the first item's language-matched title drives `.hero-title`, split into first / middle / last word so the first and last word render with the `.accent` token (orange). While loading or on error the template falls back to the existing `home.hero.title.engineering|foundation|sustainable|growth` keys so the LCP hero never flashes empty.
9. About Us API
    - `src/app/shared/services/about-us/about-us-api.service.ts` + co-located [about-us.types.ts](src/app/shared/services/about-us/about-us.types.ts).
    - `detail()` returns an `httpResource<ApiEnvelope<AboutUsResult>>` over `GET /api/v1/about-us` (constant: `Constants.getAboutUsUrl`). `AboutUsResult` shape: `{ aboutUs, overview, mission, vision, values[] }`, each localized section exposing `titleEn/titleAr/descriptionEn/descriptionAr`. Consumer contract mirrors other read resources: render `isLoading()` / `error()` / `value()?.result` branches, and pick language-matched fields at render time.
10. Lookup (Dataverse option-sets) API
    - `src/app/shared/services/lookup/lookup-api.service.ts` + co-located [lookup.types.ts](src/app/shared/services/lookup/lookup.types.ts).
    - `optionSet(query: () => LookupOptionSetQuery | null)` returns an `httpResource<ApiEnvelope<LookupOption[]>>` over `GET /api/v1/lookup/optionsets?entityLogicalName=<…>&fieldName=<…>` (constant: `Constants.getLookupOptionSetsUrl`). The factory is signal-tracked — return a query to fetch, return `null` to stay idle (no request fires). `LookupOption` shape: `{ id, description, descriptionEn, descriptionAr }`. Use this for **any** dropdown whose values come from a CRM/Dataverse option-set; store the numeric `id` as the form value (it's what the backend expects on submit) and render the language-matched `descriptionEn` / `descriptionAr` as the label. Consumed by [complaint-request.component.ts](src/app/public/complaint-request/complaint-request.component.ts) for the **Case Type** (`complaintSubCategory`) dropdown on `entityLogicalName: 'incident'` — `waterLeakage → ntw_opscomplainttypeforwaterleakagecomplaints`, `waterQuality → ntw_opscomplainttypequatlity`, `general → ntw_opscomplainttypegeneral`. For general, two **secondary** dropdowns are gated on the active sub-category and stay idle otherwise: `meterIssue → ntw_opssubcomplaintmeterissues` and `waterBilling → ntw_opssubcomplaintwaterbillingpayments`. The full lookup entry of the current selection is exposed as `selectedSubCategoryEntry` (`computed<LookupOption | null>`) so the submit payload can read the chosen `id`. Conditional-field visibility (`anotherReason`, `meterIssue`, `waterBilling`) is **id-matched** via a static `subCategoryTriggerIds` table (`{ waterLeakage: { otherReasons: 6 }, waterQuality: { otherReasons: 7 }, general: { otherReasons: 3, meterIssues: 2, waterBilling: 1 } }`) — never on `descriptionEn`, so a backend label change can't silently break validation. The same table also powers the route-preselect slug → id remap (e.g. `?type=meterIssues` → general/2) once the option-set resolves.
    - `entityLookup(query: () => LookupEntityQuery | null)` returns an `httpResource<ApiEnvelope<LookupEntityOption[]>>` over `POST /api/v1/lookup/lookups` (constant: `Constants.getLookupLookupsUrl`) with body `{ entityName, columns }`. Use this when a dropdown is backed by a plain entity projection instead of an option-set (example: registration wilaya list via `entityName: 'ntw_alwilaya'`, `columns: 'ntw_alwilayaid:id,ntw_name:name'`).
    - **Conditional Formly fields under OnPush:** prefer signal-driven `field.hide` + `field.props.required` toggles over Formly's string `expressions` (e.g. `"hide": "!model.x"`). The string expressions don't re-evaluate reliably when the model is mutated outside a form-control update (e.g. when the route or an API resource flips a state), and v7's `expressions` engine has no working precedent in this repo. Pattern (see [complaint-request.component.ts](src/app/public/complaint-request/complaint-request.component.ts)): default the conditional field to `"hide": true` in `form.json`, expose a `computed<boolean>()` signal per condition (e.g. `isOtherReasonsSelected`, `isMeterIssuesSelected`, `isWaterBillingSelected`) that **matches on the numeric option-set id** (via a static trigger table) rather than `descriptionEn`, and add a single `effect()` that calls `setFieldVisibility(key, computed())` to mutate `field.hide` and `field.props.required`. Combine with `extras: { lazyRender: true, resetFieldOnHide: true }` (already configured in [formly-config.module.ts](src/app/shared/formly/formly-config.module.ts)) so hidden fields don't render, their stale values are reset, and their controls are dropped from the `FormGroup` — meaning `form.valid` is correctly gated by visible required fields only. Always gate `onSubmit()` with `if (!this.form.valid) { this.form.markAllAsTouched(); return; }`.
    - **Config-driven dropdown wiring:** when a component has multiple Formly dropdowns backed by `LookupApi.optionSet()` resources, declare them in a single `dynamicDropdowns` config array (`{ key, resource }[]`) and drive option mapping with one `effect()` that loops the array. Adding a 4th dependent dropdown is then a one-line config entry (plus the `form.json` field) — no new method, no new effect. See `complaint-request.component.ts`. Route-preselect slugs are remapped to numeric ids in the same effect via the trigger table.
11. Language orchestration
    - `src/app/shared/services/language.service.ts`
    - Reuse URL language sync, direction (`ltr/rtl`), cookie handling.
12. Theme management
    - `src/app/shared/services/theme.service.ts`
    - Reuse theme class switching and cookie persistence.
13. Global loading state
    - `src/app/shared/services/loader.service.ts`
    - Reuse computed loading signal with interceptor integration.
14. SEO metadata
    - `src/app/shared/services/seo.service.ts`
    - Reuse for page-level title/meta updates.
15. Font scaling
    - `src/app/shared/services/font-size.service.ts`
    - Reuse central font-size behavior from config.
16. Browser utilities
    - `src/app/shared/services/common.service.ts`
    - Reuse cookie/localStorage access wrappers.
17. Motion / reduced-motion
    - `src/app/shared/services/motion.service.ts`
    - Single source of truth for `prefers-reduced-motion`. Exposes `prefersReducedMotion` (read-only `Signal<boolean>`). Reactive to live OS-level setting changes. SSR-safe. Consumed by `ScrollRevealDirective` and `AutoAnimateDirective`; use it in any component that decides whether to run a non-essential animation instead of calling `window.matchMedia` directly.
18. Toast / live announcements
    - `src/app/shared/services/toast.service.ts`
    - Translation-aware facade over PrimeNG `MessageService`. Exposes `success` / `error` / `warn` / `info`, each takes a translation key for the summary, an optional translation key for the detail, and an **optional `source`** (`HttpErrorResponse | ApiEnvelope | unknown`). When `source` carries `errorMessageEn` / `errorMessageAr`, the language-matched server message is used as the detail (the translation key remains the fallback when no server message is present). The summary always comes from the translation key so titles stay consistent across the app. Internally announces every toast through `LiveAnnouncer` (`@angular/cdk/a11y`) so screen readers receive the message — including the server's localized text. **Components must NOT inject `MessageService` directly** — go through this service. Example: `this.toast.error('login.errors.notRegisteredTitle', 'login.errors.notRegisteredDetail', err)`.
19. Auth-required prompt
    - `src/app/shared/services/auth-prompt.service.ts`
    - Single owner of the "login required" modal. Exposes `isOpen` (read-only `Signal<boolean>`) for the shared `LoginPromptDialogComponent` and three methods:
      - `requireAuth(returnUrl: string): boolean` — returns `true` when the user is already authenticated; otherwise opens the modal, stashes the URL, and returns `false` so the caller (router guard) can abort the navigation.
      - `confirm()` — navigates to `/:lang/login` and forwards the stashed URL through `history.state.returnUrl` so `LoginComponent` can resume there after sign-in.
      - `cancel()` — closes the modal; if the prompt was triggered by a direct URL access (no prior in-app navigation), redirects to `/:lang/home` so the URL bar stays consistent.
    - Components do **not** open the dialog directly — they protect the destination route with `loginPromptGuard` (see Cross-Cutting Reuse §4).
20. Profile API
    - `src/app/shared/services/profile/profile-api.service.ts` + co-located [profile.types.ts](src/app/shared/services/profile/profile.types.ts). Extends `ResilientCrudService<never>`.
    - `accounts(enabled?)` returns an `httpResource<ApiEnvelope<ProfileAccount[]>>` over `GET /api/v1/profile/accounts` (constant: `Constants.getProfileAccountsUrl`). Pass `enabled` when the caller lives on public pages and should skip the request until the user is authenticated.
    - `getProfileDetails()` is a one-shot `getOne<ProfileDetailsResponse>()` over `GET /api/v1/profile` (constant: `Constants.getProfileUrl`) that opts out of the global error toast via `skipErrorToast()`. The `X-Account-Id` header is auto-attached by `authInterceptor` once `AuthService.setSelectedAccountId(...)` has been called — set the selected id before subscribing.
    - `createAccount(payload)` posts a `CreateProfileAccountPayload` to `POST /api/v1/profile/accounts` (constant: `Constants.createProfileAccountUrl`) via the inherited `this.post<TReq, TRes>()` helper — inheriting the resilient write SLA (adaptive `timeout()`, never retried). Transport errors (5xx / 0 / 503 / timeout) are toasted centrally by `errorInterceptor`; callers only handle the envelope's `isSuccess: false` branch by calling `toast.error('…failedTitle', '…failedDetail', envelope)` so the server's localized message is used verbatim. Payload rules: `accountType` is the numeric enum (`1` = personal, `2` = organization); `middleName` is always sent as an empty string; `alWilayaId` is the GUID from `LookupApi.entityLookup({ entityName: 'ntw_alwilaya' })`; `name` / `telephone1` / `crNo` are populated **only** when `accountType === 2`. Consumers build the payload via the shared `mapAddAccountFormToPayload(value: AddAccountFormValue)` mapper exported from [add-account-modal.component.ts](src/app/shared/components/add-account-modal/add-account-modal.component.ts) so `header`, `home`, and `my-profile` stay consistent. On success reload the local `accounts()` resource so the header / my-profile lists reflect the new row, and close the modal.
    - `billingAccounts(enabled?)` returns an `httpResource<ApiEnvelope<BillingAccount[]>>` over `GET /api/v1/billing-accounts` (constant: `Constants.getBillingAccountsUrl`). Pass `enabled` when the caller should skip the request until the user is authenticated. Response shape: `{ accountId, name, totalOutstanding: number | null, statusCode: number }`. Status-code mapping: `1 = active`; anything else falls back to `inactive`. Callers `computed()` a `BillAccountRow[]` from the resource value — `name` maps to `accountNumber`, `totalOutstanding` is formatted as `"N,NNN.NN OMR"` (two decimal places, `en-US` locale).`BillingAccount` and `BillingAccountsResponse` types live in [profile.types.ts](src/app/shared/services/profile/profile.types.ts).

### Cross-Cutting Reuse
1. API context-header injector
    - `src/app/shared/interceptors/auth.interceptor.ts`
    - Attaches `X-Api-Subscription-Key` (from `environment.AppConfig.subscriptionKey`), `Accept-Language`, `x-source` (from `AppConfig.source`, default `'portal'`), and — when `AuthService.getAccessToken()` returns a value — `Authorization: Bearer <token>` to requests targeting `environment.AppConfig.apiBaseUrl` (or `/api/*` in dev). The bearer JWT comes from the `verifyOtp` / `refresh` response body and lives in an **in-memory signal** inside `AuthService` (never `sessionStorage` / `localStorage` — XSS-proof). Sets `withCredentials: true` on those same requests so the HttpOnly `refresh_token` cookie auto-rides on `/token/refresh` and `/logout` and Azure App Service's `ARRAffinity*` sticky-session cookies flow back; `withCredentials` is scoped strictly to our own API so we never leak any browser-set cookies to third-party origins (translation files, CDNs). The companion `withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })` in [app.config.ts](src/app/app.config.ts) auto-echoes a CSRF cookie as a header on mutating requests if/when the backend issues one. The interceptor never overrides a pre-existing `Authorization` header on the request — callers can opt into a custom bearer (e.g. a one-shot impersonation token) by setting it themselves before the call.
2. Global loader HTTP hook
    - `src/app/shared/interceptors/loader.interceptor.ts`
    - Per-call opt-out via `context: skipLoader()` for long-running uploads, polling, or any call that owns its own progress UI. **No URL allow-lists** — use the context token.
3. Centralized HTTP error handling
    - `src/app/shared/interceptors/error.interceptor.ts`
    - Handles `401` (attempt **single-flight token refresh** via `AuthService.refresh()`; on success retry the original request once — transparent to callers; on failure clear local session and redirect to `/:lang/login`. Auth-bootstrap endpoints `/login/request-otp`, `/otp/verify`, `/otp/resend`, `/register`, `/register/verify`, `/auth/refresh`, `/auth/logout` are excluded from the refresh attempt to avoid loops — a 401 there clears the local session and redirects directly), `403` (redirect to not-found), `0/503` (network toast), `5xx` (server toast). `422` is intentionally swallowed so component-level resources surface field-level messages. Per-call opt-out via `context: skipErrorToast()` for callers that render their own domain 4xx UI (auth flows, typeahead, etc.); the 401/403 handling still fires regardless. Translation keys live under the `errors.*` namespace in [en.json](src/assets/i18n/en.json) / [ar.json](src/assets/i18n/ar.json). **Components must NOT add local `try/catch` or `hasError` flags for transport errors.**
4. HTTP context tokens
    - `src/app/shared/interceptors/http-context.tokens.ts`
    - `SKIP_LOADER` / `SKIP_ERROR_TOAST` / `SKIP_TRANSFER_CACHE` plus the helpers `skipLoader()` / `skipErrorToast()` / `skipTransferCache()`. Use these for per-call interceptor opt-outs — never URL allow-lists or custom headers. The skip-transfer-cache token is honored by `withHttpTransferCacheOptions` in [app.config.ts](src/app/app.config.ts).
5. Route guards
    - `src/app/shared/guards/auth.guard.ts` — silent redirect to `/:lang/login` (with `returnUrl` in `history.state`) for routes that require authentication without a prompt.
    - `src/app/shared/guards/login-prompt.guard.ts` — routes that should ask the guest before sending them to login. Delegates to `AuthPromptService.requireAuth(state.url)`. Currently applied to `dashboard`, `notifications`, `request-details`, `inquiry`, `complaint-request`, and `service-request`. Use this guard (not `authGuard`) for any new authenticated form/destination so the user sees the shared modal instead of a hard redirect.

---

## 4) Mandatory Reuse Workflow For Any New Design

Use this workflow every time a new Figma design is provided.

1. Classify the design blocks
    - Layout shell (header/footer/page frame)
    - Content cards/sections
    - Form controls
    - Utility widgets (map, loader, file upload)
2. Check existing reusable inventory in this file first.
3. Search matching implementation in:
    - `src/app/shared/components`
    - `src/app/shared/formly/custom-components`
    - `src/app/layouts`
    - `src/app/shared/services`
4. If match exists:
    - Extend existing component via `@Input`, variant classes, or Formly `props`.
    - Keep business logic in existing service/component.
5. If no exact match:
    - Check if existing component can be generalized safely.
    - Only create a new reusable component if extension would harm readability/maintainability.
6. Register and integrate properly:
    - For new Formly fields, register in `FormlyConfigModule`.
    - For page text, wire to translation keys.
    - For theme-sensitive styles, use CSS variables/theme classes.

---

## 5) Creation Rules (Strict)

1. Do not duplicate existing logic.
2. Prefer extending existing reusable components over creating page-specific copies.
3. New UI component must be standalone and reusable by at least one additional screen path.
4. New form control must be implemented as a Formly custom type when it belongs to dynamic forms.
5. New page-level SEO should use `SeoService`.
6. New language-visible text must use translation keys (`en.json`/`ar.json`).
7. Theme-aware colors should use CSS variables in theme files instead of hard-coded values when possible.
8. **Any page with a Formly form must define its fields in a co-located `form.json` file.** Never define `FormlyFieldConfig[]` arrays inline in TypeScript. Import the JSON and cast: `formConfig as unknown as FormlyFieldConfig[]`. This applies to every label, placeholder, prop, validator, and field type.
9. **Modern Angular API only for new code** (see §1.5):
    - `inject()` for DI — no constructor injection.
    - `input()`, `output()`, `model()`, `viewChild()` signal APIs — no `@Input`, `@Output`, `@ViewChild`.
    - `signal()` / `computed()` / `effect()` for state; `httpResource()` / `resource()` for HTTP-backed reactive state.
    - `ChangeDetectionStrategy.OnPush` on every new component.
    - Control flow `@if` / `@for` (with `track`) / `@switch` / `@let` — no `*ngIf`, `*ngFor`, `*ngSwitch`.
    - `@defer` heavy below-fold sections with a `@placeholder` skeleton.
    - `takeUntilDestroyed(inject(DestroyRef))` for subscription cleanup.
    - `NgOptimizedImage` (`<img ngSrc="...">`) for raster images with known intrinsic size; mark hero images with `priority`.
10. **New routes are always lazy.** Add `loadComponent: () => import('./...').then(m => m.XComponent)` — never `component: XComponent`. Component input binding is on; declare route params/query params/`data` as component `input()`s.
11. **SSR safety**: gate `window`, `document`, `localStorage`, `IntersectionObserver`, `matchMedia` access with `isPlatformBrowser(inject(PLATFORM_ID))`.

### Motion & Page Transition Rules (Mandatory)

1. **Page transitions** use the native View Transitions API enabled by `withViewTransitions()`. Do not add `@angular/animations` route triggers; customize via `::view-transition-old/new(root)` in `global.theme.scss`.
2. **Scroll-reveal** sections use `[appScrollReveal]` (see §2) with a `variant` of `'fade'`, `'fade-up'`, or `'fade-in-x'`. Do not write per-page IntersectionObserver code.
3. **List / grid / accordion** add-remove-reorder uses `[appAutoAnimate]` (see §2). Do not hand-write enter/leave keyframes for repeated items.
4. **Reduced motion** state comes from `MotionService.prefersReducedMotion()` signal (see §3). Do not call `window.matchMedia` directly in components. Every custom animation must visually no-op in reduced-motion mode.
5. Use meaningful motion only (state changes, hierarchy, navigation feedback), not decorative-only animation.
6. Keep animation timing short and consistent across pages — prefer the existing `--transition-fast / -base / -slow` tokens. Avoid noticeably different easing/timing unless there is a UX reason.
7. Prefer GPU-friendly properties (`opacity`, `transform`) and avoid layout-heavy animation (`width`, `height`, `left`, `top`).
8. Place shared motion utilities/patterns in `src/styles/global.theme.scss` and reuse them from page/component styles.
9. For route-level motion, keep transitions smooth and non-blocking; content must remain readable and interactive during/after animation.

### Performance Rules (Mandatory)

1. **Lazy routes** (see §1.5 Routing) — never add an eager `component:` route.
2. **`@defer`** any below-fold section that is heavy (chart, map, video preview, large grid, accordion with API data). Provide a `@placeholder` using `app-skeleton-loader` for layout stability.
3. **`NgOptimizedImage`** for every `<img>` with known intrinsic dimensions. Use `priority` for above-fold hero/LCP images.
4. **`OnPush`** change detection on every new component (see §1.5). Reactivity comes from signals.
5. **Do not** add new `Subject.subscribe(...)` without `takeUntilDestroyed`. Long-lived subscriptions in components are a leak.

---

## 6) Figma Handoff Protocol

When a Figma link + component name is provided:

1. Read this rules file first.
2. Map requested component name to nearest existing reusable component/type.
3. Propose one of these outcomes:
    - Reuse existing component with style-only edits.
    - Reuse existing component with small API extension (`@Input`/Formly `props`).
    - Create a new reusable component (only if no safe extension path exists).
4. Explain where the edited/new reusable component will live and how other pages will consume it.
5. If a new reusable pattern appears in the design, add it to this file after implementation.

---

## 7) Quick Reuse Entry Points

- Shared UI first: `src/app/shared/components`
- Reusable directives first: `src/app/shared/directives`
- Dynamic form controls first: `src/app/shared/formly/custom-components`
- Layout shell first: `src/app/layouts`
- Shared logic first: `src/app/shared/services`
- Theme tokens first: `src/styles/themes`

This project is reuse-first by default.

---

## 8) Rules Maintenance (Mandatory)

1. After any reusable-component or reusable-style edit, update this file in the same task.
2. Add any new reusable inputs/props/variants to the relevant inventory section.
3. If a new default behavior is introduced (for example dimmed field state), document the expected flag name and usage.
4. If an implementation replaces a previous pattern, mark the old pattern as deprecated in this file.
5. Never finish a design-to-code task without checking whether this file needs a delta update.
