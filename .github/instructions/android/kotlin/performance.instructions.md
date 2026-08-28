---
description: "Use when an Android change affects startup, rendering cost, memory, ANR risk, or battery. Enforces targeted performance review without premature optimization."
applyTo: "**/*.kt,**/*.java,**/AndroidManifest.xml"
---

# Performance (Android)

## Scope

Applies to startup cost, main-thread discipline, memory, rendering, and battery. Flag only issues with a realistic user-visible cost (ANR, jank, leak, battery drain).

## Review rules

1. **Main-thread discipline**: network, disk I/O, bitmap decode, large JSON parsing on the main thread — critical finding (ANR risk).
2. **Startup work**: heavy initialization in `Application.onCreate` or first `Activity.onCreate` must be justified; synchronous work at startup that delays first frame is a finding.
3. **Memory**: `Bitmap` sizes downsampled for target views; `onTrimMemory` handled where the project handles it; ever-growing collections where paging exists; Activity/View references retained by singletons/statics — leaks are critical findings.
4. **RecyclerView/list efficiency**: no per-bind allocations of heavy objects, `setHasFixedSize(true)` where applicable, DiffUtil instead of `notifyDataSetChanged` on large lists where the project uses DiffUtil.
5. **Battery/wakeups**: `AlarmManager`/`WorkManager` periodic intervals justified; no polling where push exists; location updates at the minimum interval/accuracy the feature needs.
6. **Overdraw/transparency**: trivial unless measured; prefer `low` severity notes.

## Positive recommendations

- Prefer WorkManager for deferrable background work (consistent with the project's existing background strategy).
- Flag obvious issues (main-thread I/O, leaked contexts) directly from the diff; for subtle issues, describe the suspected mechanism and its trigger condition instead of claiming profiling evidence you do not have.

## Anti-patterns to flag

```kotlin
// BAD — main-thread I/O
sharedPrefs.getStringSet(...).map { heavyTransform(it) } // on main, large set

// BAD — context leak
companion object { lateinit var activity: Activity }

// BAD — full-res bitmap in a 48dp ImageView
BitmapFactory.decodeFile(hugeFile) // no inSampleSize
```

## Preserve existing conventions

- **Avoid premature optimization**: readable code with no concrete cost gets at most a low-severity note.
- Don't demand caching of trivially cheap computations.
