---
description: "Use when a Vue change builds, composes, or refactors components. Enforces reactivity correctness, SFC hygiene, and rendering safety with the project's API style."
applyTo: "**/*.vue"
---

# Vue Components & Reactivity

## Scope

Applies to single-file components and their `<script>`/`<script setup>` blocks. State architecture has its own instruction file.

## Hard rules

1. **Reactivity is not lost to destructuring**: `const { a } = reactive(obj)` and destructured `props` in `<script setup>` lose reactivity — use `toRefs`/`storeToRefs` (Pinia) or keep property access intact. A `computed` reading destructured reactive values is a stale-value finding.
2. **`v-for` has a `:key` bound to stable identity** (`item.id`), not the loop index — index keys break component state on reorder/filter.
3. **`v-html` only with sanitized, trusted content** — user/API-provided HTML without sanitization is a critical XSS finding.
4. **No direct DOM manipulation** (`document.querySelector`, manual listeners on `document`/`window` without cleanup in `onBeforeUnmount`).

## Review rules

- `computed` for derived state; a method called in the template re-runs on every render — flag hot-path template method calls that the project expresses as computeds elsewhere.
- `ref` for primitives, `reactive` for objects — follow the project's dominant style; do not mix paradigms inside one new feature.
- Watchers: `watch(source, cb)` needs the right source (reactive property vs whole object); deep watchers on large structures without need are a perf and correctness smell; clean up manual `watch`/`watchEffect` registrations created outside setup.
- Async lifecycle: state writes after `await` in `onMounted`/event handlers guard against unmounted components where the project handles it (e.g. `onBeforeUnmount` flags); raw `fetch().then(set)` without abort/cancel follows the project's data-layer pattern.
- Props/emits are typed (`defineProps<T>()`, `defineEmits<T>()` in TS projects) and mutating props directly is a finding — emit instead.
- Template refs for components are used through the ref, not `document.getElementById`.
- Lifecycle symmetry: anything registered in `onMounted` (observers, intervals, event listeners) is removed in `onBeforeUnmount`/`onUnmounted`.

## Anti-patterns to flag

```vue
<script setup>
// BAD — destructured props lose reactivity
const { userId } = defineProps(["userId"]);
watchEffect(() => fetchUser(userId)); // userId frozen at setup

// BAD — manual listener never removed
onMounted(() => window.addEventListener("resize", onResize));
</script>

<!-- BAD — index key + v-html of API content -->
<div v-for="(c, i) in comments" :key="i" v-html="c.body" />
```

## Preserve existing conventions

- Options API code the change does not touch is not a finding; new code follows the project's dominant API style (do not force `<script setup>` onto an Options-API codebase or vice versa).
