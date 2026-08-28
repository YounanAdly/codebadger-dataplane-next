# React Native Review Rules

Apply when the pull request touches React Native code: `package.json` with `react-native`, `android/`, `ios/`, RN components.

1. Never use `dangerouslySetInnerHTML` / `WebView` with untrusted content without sanitization.
2. Always provide stable `key` props on mapped elements.
3. Use `FlatList` / `SectionList` / `FlashList` for long lists — never `.map()` over large arrays in `ScrollView`.
4. Dispose listeners, timers, animations, and `AppState` subscriptions on unmount.
5. No synchronous storage (`AsyncStorage` sync APIs) for large data; no sensitive data in plain `AsyncStorage` — use secure storage (Keychain/Keystore).
6. No hardcoded API keys or endpoints in JS bundles — they are readable in the shipped app.
7. Handle network errors and render loading/error/empty states on every screen.
8. Avoid anonymous functions/objects as props in hot paths (re-render churn).
9. Permissions: request only what the feature needs; declare exactly what is used in Android/iOS manifests.
10. Navigation: use the project's navigator consistently; deep links must validate parameters.
11. Accessibility: `accessibilityLabel` on interactive elements, `accessible` props, minimum touch targets (44pt/48dp).
12. Test: Jest + React Native Testing Library for components and logic.

Severity guide:
- **critical**: secrets in bundle, unencrypted sensitive storage, missing permission justification, crashes from native module misuse.
- **high**: memory leaks from undisposed subscriptions, unbounded lists, missing error states.
- **medium**: missing a11y labels, missing tests, styling inconsistencies.
- **low**: readability, formatting, minor optimizations.
