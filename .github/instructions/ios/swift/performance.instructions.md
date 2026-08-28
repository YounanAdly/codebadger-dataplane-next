---
description: "Use when an iOS change affects startup, rendering cost, memory, or responsiveness. Enforces targeted performance review without premature optimization."
applyTo: "**/*.swift"
---

# Performance (iOS)

## Scope

Applies to launch cost, main-thread efficiency, memory growth, and rendering — flag only issues with a realistic user-visible cost.

## Review rules

1. **Main-thread discipline**: heavy parsing, image processing, large file I/O, or big JSON decode on the main queue is a finding.
2. **Cell/collection efficiency**: `UITableViewCell`/`UICollectionViewCell` reuse is correct (no per-`cellForRowAt` heavy work, no repeated view creation); row-height calculations cached where the project caches them.
3. **Images**: downsample before display (`ImageIO`/`CGImageSourceCreateThumbnail` or the project's image pipeline) when full-resolution images render in small views; decode off-main for large media.
4. **Memory**: unbounded caches/grow-only arrays where paging exists; `DispatchSourceTimer`/`CADisplayLink` loops not invalidated; retained view hierarchies after dismissal.
5. **Redundant work**: repeated `DateFormatter`/`NumberFormatter` construction in hot paths (create once/reuse), repeated sorting/filtering per scroll event.
6. **Launch**: work added to `application:didFinishLaunching` must be justified — synchronous network/disk at launch is a finding.

## Positive recommendations

- Flag obvious issues (blocking I/O on main, full-res decode in cells) directly from the diff; for subtle issues, describe the suspected mechanism and its trigger condition instead of claiming profiling evidence you do not have.
- Use `os_signpost`/metrics where the project instruments hot paths.

## Anti-patterns to flag

```swift
// BAD — formatter per cell render
let df = DateFormatter(); df.dateFormat = "yyyy-MM-dd" // in cellForRowAt

// BAD — full-res image in a 40pt avatar
UIImage(contentsOfFile: hugeURL) // no downsampling

// BAD — main-thread file I/O
try Data(contentsOf: bigFileURL) // on main queue
```

## Preserve existing conventions

- **Avoid premature optimization**: readable code with no concrete cost (large N, per-frame, or measured) gets at most a low-severity note.
- Don't demand caching of trivially cheap computations.
