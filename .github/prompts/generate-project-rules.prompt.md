# Prompt: Generate Reuse-First Project Rules & Instruction Files

Copy this entire prompt into Copilot Chat (Agent mode) at the **root of the target project**. The agent will inspect the codebase, then generate a complete `.github/copilot-instructions.md`, a `rules.md` catalog at the repo root, and a set of per-domain `.github/instructions/*.instructions.md` files — mirroring the structure used in our reference Angular project but adapted to whatever stack the target repo actually uses.

---

## Your Task

You are an automated coding agent. Generate a **reuse-first instruction system** for this repository. Do **not** invent rules — derive them from what actually exists in the codebase. If the repo is empty or missing a layer, omit that section rather than fabricating it.

### Step 1 — Discover the project

Before writing anything, inspect the workspace and answer these for yourself:

1. **Stack:** framework + version (Angular / React / Next.js / Vue / NestJS / Django / Laravel / .NET / etc.), package manager, language (TS/JS/Python/PHP/C#/Go).
2. **Bootstrap & routing entry points:** main file, app config, route table.
3. **Layout / shell components:** headers, footers, sidebars, layout wrappers.
4. **Shared / reusable zone:** folder(s) for shared UI components, services, hooks, utilities, guards, interceptors, middleware.
5. **Forms layer:** any dynamic-form library (Formly, React Hook Form, Zod schemas, JSON-schema form, etc.) and where field types / validators live.
6. **Styling system:** SCSS / Tailwind / CSS Modules / styled-components; theme files; design tokens (CSS variables, Tailwind config, theme JSON).
7. **i18n / translations:** library (ngx-translate, i18next, next-intl, vue-i18n, gettext) and catalog file locations. Note RTL languages.
8. **HTTP / data layer:** base API service, fetch wrapper, axios instance, RTK Query, tRPC, repository pattern. Where endpoint constants live.
9. **Auth & route protection:** guards / middleware / HOCs.
10. **Feature pages:** the `pages/` or `routes/` or `app/` tree — list each top-level page and one-line purpose.
11. **Build & test commands:** read `package.json` / `pyproject.toml` / `Makefile` etc.

Use file_search, grep_search, list_dir, and read_file to verify each item. **Cite real paths only.**

### Step 2 — Produce these files

Generate the following, in this order. After each file, briefly confirm what was created.

#### A. `.github/copilot-instructions.md`

A short top-level rules file (max ~50 lines). Structure:

- Title: `# Project Guidelines`
- One-line description of the stack (e.g. "React 18 + Vite + TypeScript. Reuse-first by default.")
- Pointer to `rules.md` as the catalog.
- **Core Principles** (numbered list, 6–10 items). Pull only the ones that apply to this stack. Examples:
  1. Reuse before create — list the actual folders to search.
  2. Component style: standalone / functional / module-based — match the repo.
  3. No hardcoded design values → use the actual token system found.
  4. No hardcoded user-facing strings → use the actual i18n library found.
  5. No inline form schemas if a forms library is in use.
  6. No direct HTTP from components → use the base service found.
  7. Endpoints come from a constants file → cite the real one.
  8. Routing conventions found in the repo (lang prefix, locale segments, etc.).
  9. Motion / animation policy if the repo has any animations.
  10. Any "locked" folders the user has called out (skip if none).
- **Architecture** section: bulleted list of bootstrap / routing / layout / shared / pages paths, each linked.
- **Build & Test** section: real commands from `package.json` (or equivalent).
- **Maintenance Rule:** any change to a reusable piece must update `rules.md` in the same task.
- **When in Doubt** section: links to each `.github/instructions/*.instructions.md` file generated below.

Use markdown links with workspace-relative paths.

#### B. `rules.md` (repo root)

The single source of truth catalog. Sections (include only those that apply):

1. **Project Structure (Verified)** — annotated tree of `src/` (or equivalent) with one-line purpose per folder. Mark any locked folders.
2. **Reusable UI Components** — table: component name, file path, purpose, key inputs/props.
3. **Reusable Form Field Types / Schemas** (only if a forms library exists) — table of registered custom types with their props.
4. **Reusable Services / Hooks / Utilities** — table: name, path, purpose, public surface.
5. **Design Tokens** — table of every theme variable / Tailwind token / CSS var with values per theme.
6. **Routing Map** — table: path pattern → component/page → guard.
7. **i18n Namespaces** — list of top-level keys/namespaces and where they're used.
8. **HTTP Endpoints** — list of constants from the endpoint file.

Each row must cite a real file path. If a section has no entries, omit the section.

#### C. `.github/instructions/*.instructions.md` (one per domain)

Generate **only** the files that apply to this repo. Each file starts with YAML frontmatter:

```yaml
---
description: "Use when <specific trigger>. <one-line scope>."
applyTo: "<glob matching the files this rule governs>"
---
```

Generate these candidates (skip any that don't apply):

1. **`shared-reuse.instructions.md`** — `applyTo`: the main source glob (e.g. `src/**/*.ts`, `src/**/*.tsx`, `app/**/*.py`).
   - Workflow before writing code (classify → search → extend → only then create).
   - Component conventions (standalone vs module, naming, prefix, input/output API).
   - Service conventions (no direct HTTP in components, endpoint constants, auth/loading).
   - Routing conventions.
   - SEO / metadata if applicable.
   - "After adding/changing a reusable piece → update `rules.md`."

2. **`styling-themes.instructions.md`** — `applyTo`: `src/**/*.scss` / `src/**/*.css` / `**/*.module.css` / `tailwind.config.*` (whichever fits).
   - Hard rule: no hardcoded design values, with GOOD/BAD examples using real token names from the repo.
   - Token catalog pointer to `rules.md`.
   - How to add a new token (list every theme file the repo has).
   - Global vs component styles.
   - RTL guidance (only if the i18n catalog includes an RTL language).
   - Motion policy (only if the repo has any animations / `prefers-reduced-motion` is honored).

3. **Forms instructions** (only if a forms library is used) — `applyTo`: matching glob (e.g. `**/form.json`, `**/*formly*`, `**/*.schema.ts`, `**/*Form.tsx`).
   - Hard rule: schema location (JSON file, Zod schema, etc.) — no inline schemas in component code if that's the convention.
   - What goes in the schema vs what stays in code.
   - Registered custom field types.
   - Shared validators location.
   - Translation keys for labels/placeholders.

4. **`i18n.instructions.md`** (only if an i18n system exists) — `applyTo`: the catalog glob (e.g. `src/assets/i18n/*.json`, `src/locales/**/*.json`, `messages/*.json`).
   - Hard rules: no hardcoded user-visible strings; all locales must have parity; identical nested shape; no duplicate keys.
   - Naming convention (derive from existing keys).
   - Forms integration if applicable.
   - RTL note if applicable.

5. **Domain-specific files** — if you find clearly distinct domains (e.g. `api`, `auth`, `database migrations`, `tests`), generate matching `.instructions.md` files with appropriate `applyTo` globs. Keep them short and specific.

### Step 3 — Validation

After generating all files:

1. Open each file and confirm every cited path actually exists in the repo. Fix any broken links.
2. Confirm every `applyTo` glob actually matches files in the repo.
3. Confirm `copilot-instructions.md` references every `.instructions.md` file you created.
4. Confirm `rules.md` is referenced from `copilot-instructions.md`.
5. Print a final summary listing every file you created with its absolute path.

### Output Conventions

- Use markdown links with workspace-relative paths, never bare backticked filenames.
- Keep `copilot-instructions.md` short. Push detail into `rules.md` and the per-domain instruction files.
- Do **not** copy rules from any other project. Every rule must be justified by something you observed in this repo.
- Do **not** add rules for libraries that are not installed.
- Do **not** create example files, demo pages, or sample components — only the instruction system.

### Hard Constraints

- Standalone-component / functional-component / module preference must match the repo's existing pattern.
- Do not invent design tokens — only document tokens that already exist in theme files (or note "no token system found — recommend adding one" if absent).
- Do not invent translation keys — only document namespaces that exist.
- If the repo has zero reusable components, say so explicitly and recommend the folders to create, but do not list fictional components.

Begin now. Start by listing the top-level directory and `package.json` (or equivalent manifest).
