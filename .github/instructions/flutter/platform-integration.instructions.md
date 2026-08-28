---
description: "Use when a Flutter change touches platform integration: MethodChannels, EventChannels, platform-specific Dart or native code, or plugin boundaries. Apply only when platform integration actually exists in the change."
applyTo: "**/*.dart,**/android/**/*.kt,**/ios/**/*.swift"
---

# Flutter Platform Integration

## Scope

Applies to platform channels (`MethodChannel`, `EventChannel`, `BasicMessageChannel`), platform-specific Dart code, and the native Android/iOS code behind them. Apply only when the change actually touches platform integration — projects that use only plugins and no custom channels should not be reviewed against this file.

## Hard rules

1. **Channel names and message codecs match on both sides.** A Dart channel name (`MethodChannel('app/feature')`) that differs from the native registration string fails silently at runtime — verify both sides in the diff. Mixing codecs (`StandardMethodCodec` vs `JSONMethodCodec`) between Dart and native is a finding.
2. **Channel invocations are wrapped in `PlatformException` handling**: native errors propagate via `result.error(code, message, details)` and the Dart side catches `PlatformException` — not raw casts of dynamic results.
3. **EventChannels are cancelled**: the Dart side cancels the `EventChannel` subscription when the listener is disposed; the native side respects cancellation (removes listeners, stops streams).

## Review rules

- **Platform-specific logic stays at the platform boundary.** Channel calls live in the project's platform-boundary layer (a plugin/service class), not scattered through widgets or business logic. Widgets must not construct channels directly.
- **Data contracts are typed and documented**: `details` payloads use agreed shapes (typed models or documented maps) consistent on both platforms; a shape change without both-sides update is a finding.
- **Native work runs on the right thread**: UI-affecting or quick calls on the platform main thread; blocking work off it (`Dispatchers.IO` on Android, background queues on iOS) with results posted back thread-safely (`runOnUiThread`/`DispatchQueue.main` where the API requires it).
- **Lifecycle correctness**: handlers registered in `configureFlutterEngine`/`init` are torn down symmetrically; Dart-side `setMethodCallHandler` is replaced or cleared when the owning object is disposed.
- **Prefer maintained plugins over new native code**: adding custom channel/native implementation for a capability a maintained plugin already covers is a finding unless the change justifies it (no maintained plugin covers the capability, or the project's custom approach already exists).
- **Plugin compatibility**: new/upgraded plugins' Android min-SDK / iOS deployment-target requirements must not conflict with the project's build configuration — flag forced SDK bumps inside a feature PR.

## Positive recommendations

- Use Pigeon (or the project's existing codegen) for new channel contracts if the project already generates them.
- Keep per-platform differences behind one Dart interface so call sites stay platform-agnostic.

## Anti-patterns to flag

```dart
// BAD — channel constructed and called inside a widget
ElevatedButton(
  onPressed: () async {
    final battery = await MethodChannel('app/battery').invokeMethod<int>('getLevel');
  },
)

// BAD — unchecked dynamic result
final map = await channel.invokeMethod('getConfig');
final url = map['endpointUrl'] as String; // missing key = crash
```

## Preserve existing conventions

- Match the project's channel naming scheme and where its platform handlers live.
- Do not demand migration of working channels to Pigeon (or away from it) in a feature PR.
