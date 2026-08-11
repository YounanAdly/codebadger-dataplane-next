---
description: "Use when creating or editing Angular Formly forms, form.json files, custom Formly field types, validators, or any FormlyFieldConfig. Covers JSON-driven form pattern and registered custom types."
applyTo: "src/app/**/{form.json,*formly*,*.type.ts,*.types.ts}"
---

# Formly Forms

## Hard Rule: JSON-Driven Forms

**Never** declare `FormlyFieldConfig[]` arrays inline in a component `.ts` file. Every page form must live in a co-located `form.json`.

Pattern:

```ts
import formConfig from './form.json';
fields: FormlyFieldConfig[] = formConfig as unknown as FormlyFieldConfig[];
```

Reference implementations:
- [src/app/public/login/form.json](../../src/app/public/login/form.json)
- [src/app/public/create-account/form.json](../../src/app/public/create-account/form.json)

## What goes in `form.json`

`key`, `type`, `className`, `validators.validation`, and all `props` (placeholder translation key, variant, required, type, inputmode, autocomplete, maxLength, pattern, prefixIconSrc, containerClass, inputClass, iconClass, dimmed, multiple, accept, maxFileSize, chooseLabel).

## What stays in TypeScript

Only runtime-resolved values: dropdown `options` from API, dynamic defaults. Set them via [FormlyService](../../src/app/shared/services/formly.service.ts) (e.g. `setDropdownValue()`).

## Registered Custom Types (reuse first)

Source of truth: [formly-config.module.ts](../../src/app/shared/formly/formly-config.module.ts).

`custom-input`, `custom-dropdown`, `custom-calendar`, `custom-multiselect`, `searchable-select`, `file`.

For dropdowns use the **registered** path under `custom-components/drop-down/`, not the duplicate at `custom-components/custom-dropdown.types.ts`.

## Validators

Reuse named validators from [formly.validators.ts](../../src/app/shared/formly/formly.validators.ts): `emailPattern`, `numbersOnly`, `fullNamePattern`, `mobileNumberLength`. Add new shared rules there, not inline.

## Translations

`label` and `placeholder` in `form.json` are translation **keys**, not literal strings. Add the keys to both `en.json` and `ar.json`.

## When adding a new custom field type

1. Place it under `src/app/shared/formly/custom-components/`.
2. Register it in `formly-config.module.ts`.
3. Document props in [rules.md](../../rules.md) §2 "Reusable Formly Field Types".
