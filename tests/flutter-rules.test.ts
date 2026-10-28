// tests/flutter-rules.test.ts
// Level 1 (rule validation) and Level 2 (rule-engine selection) coverage for the
// Flutter ruleset: instruction-file integrity, applyTo scoping, baseline content,
// platform detection, deterministic scanner rules, and cross-platform isolation.
// Run: npm test  (Node built-in test runner with native TypeScript stripping)
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  parseIndexEntries,
  parseApplyTo,
  expandBraces,
  globToRegex,
  loadRuleBundle,
} = require("../src/lib/reviewer-core/rule-loader.ts");
const { detectPlatforms } = require("../src/lib/reviewer-core/platform-detector.ts");
const { scanDiff, parseUnifiedDiffFiles } = require("../src/lib/reviewer-core/rules-scanner.ts");

const repoRoot = process.cwd();
const baseline = fs.readFileSync(path.join(repoRoot, "rules", "flutter", "rules.md"), "utf8");
const instructionsDir = path.join(repoRoot, ".github", "instructions", "flutter");
const fixtureDir = path.join(repoRoot, "tests", "fixtures", "flutter-review");

const readDiff = (name) => fs.readFileSync(path.join(fixtureDir, name), "utf8").replace(/\r\n/g, "\n");

// Representative changed path for every indexed instruction file — keeps each
// concern reachable and catches accidentally over-narrowed applyTo scopes.
const INSTRUCTION_SAMPLES = {
  "dart.instructions.md": "lib/models/user.dart",
  "architecture.instructions.md": "lib/features/login/presentation/login_page.dart",
  "state-management.instructions.md": "lib/features/cart/cart_controller.dart",
  "widgets.instructions.md": "lib/widgets/profile_card.dart",
  "navigation.instructions.md": "lib/app/router.dart",
  "api-calls.instructions.md": "lib/data/api/profile_api.dart",
  "error-handling.instructions.md": "lib/data/repositories/auth_repository.dart",
  "async.instructions.md": "lib/features/search/search_controller.dart",
  "performance.instructions.md": "lib/widgets/product_grid.dart",
  "testing.instructions.md": "test/features/login/login_page_test.dart",
  "accessibility.instructions.md": "lib/widgets/filtered_list.dart",
  "localization.instructions.md": "lib/l10n/app_en.arb",
  "styling-themes.instructions.md": "lib/theme/app_theme.dart",
  "dependencies.instructions.md": "pubspec.yaml",
  "platform-integration.instructions.md": "lib/platform/battery_channel.dart",
  "security.instructions.md": "lib/auth/token_storage.dart",
};

describe("flutter rules — Level 1: rule validation", () => {
  test("index and disk stay in sync: every listed file exists, every file is listed", () => {
    const entries = parseIndexEntries(baseline);
    assert.ok(entries.length >= 16, `expected >= 16 index entries, got ${entries.length}`);
    const indexed = new Set(entries.map((e) => e.path.replace(/^.*\//, "")));
    const onDisk = new Set(fs.readdirSync(instructionsDir).filter((f) => f.endsWith(".instructions.md")));
    for (const name of indexed) {
      assert.ok(onDisk.has(name), `indexed but missing on disk: ${name}`);
    }
    for (const name of onDisk) {
      assert.ok(indexed.has(name), `on disk but not indexed in rules/flutter/rules.md: ${name}`);
    }
    for (const entry of entries) assert.ok(entry.description.length > 0, `no description for ${entry.path}`);
  });

  test("instruction frontmatter is valid and every applyTo glob compiles", () => {
    for (const name of fs.readdirSync(instructionsDir).filter((f) => f.endsWith(".instructions.md"))) {
      const md = fs.readFileSync(path.join(instructionsDir, name), "utf8");
      const globs = parseApplyTo(md);
      assert.ok(globs.length > 0, `${name} has no applyTo frontmatter`);
      for (const glob of globs.flatMap(expandBraces)) {
        assert.doesNotThrow(() => globToRegex(glob), `${name} produced an invalid glob: ${glob}`);
      }
      const description = md.match(/^description:\s*"([^"]*)"/m);
      assert.ok(description && description[1].trim().length > 0, `${name} has no description`);
    }
  });

  test("every instruction file matches its representative changed path", () => {
    for (const [name, sample] of Object.entries(INSTRUCTION_SAMPLES)) {
      const md = fs.readFileSync(path.join(instructionsDir, name), "utf8");
      const globs = parseApplyTo(md).flatMap(expandBraces);
      const matched = globs.some((g) => globToRegex(g).test(sample));
      assert.ok(matched, `${name} applyTo does not match representative path: ${sample}`);
    }
  });

  test("baseline defers to instruction files instead of overriding them", () => {
    assert.match(baseline, /takes precedence/);
    // The old absolutes produced false positives; their nuanced versions live in
    // the instruction files and must not be re-imposed from the baseline.
    assert.doesNotMatch(baseline, /No `dynamic` types/);
    assert.doesNotMatch(baseline, /Use `Keys` on items/);
    assert.doesNotMatch(baseline, /All user-visible strings must use `intl`/);
  });

  test("baseline keeps the always-on safety net", () => {
    assert.match(baseline, /Flutter Review Rules/);
    assert.match(baseline, /dispose\(\)/);
    assert.match(baseline, /mounted/);
    assert.match(baseline, /No secrets/);
    assert.match(baseline, /TLS only/);
    assert.match(baseline, /loading, error, empty, and success states/);
  });
});

describe("flutter rules — Level 2: rule-engine selection", () => {
  test("lib-only PR loads the core concerns and skips test/dependency rules", () => {
    const changed = ["lib/features/checkout/checkout_screen.dart"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    const loaded = bundle.platformRuleFiles.join("\n");
    for (const concern of ["dart", "widgets", "async", "state-management", "architecture", "api-calls", "security"]) {
      assert.ok(loaded.includes(`flutter/${concern}.instructions.md`), `missing concern: ${concern}`);
    }
    assert.ok(!loaded.includes("testing.instructions.md"), "testing rules must not load for lib-only changes");
    assert.ok(!loaded.includes("dependencies.instructions.md"), "dependency rules must not load without pubspec changes");
  });

  test("test-only PR loads testing rules, not widget rules", () => {
    const changed = ["test/widget_test.dart"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    const loaded = bundle.platformRuleFiles.join("\n");
    assert.ok(loaded.includes("flutter/testing.instructions.md"));
    assert.ok(loaded.includes("flutter/error-handling.instructions.md"), "error-handling applyTo covers test files");
    assert.ok(!loaded.includes("flutter/widgets.instructions.md"));
  });

  test("pubspec-only PR loads dependency rules plus the flutter baseline", () => {
    const changed = ["pubspec.yaml"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    assert.ok(bundle.platformRuleFiles.includes("flutter/rules.md"));
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/flutter/dependencies.instructions.md"));
  });

  test("manifest change in a Flutter app loads flutter security rules and android rules together", () => {
    const changed = ["pubspec.yaml", "lib/main.dart", "android/app/src/main/AndroidManifest.xml"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/flutter/security.instructions.md"));
    assert.ok(bundle.platformRuleFiles.includes("android/rules.md"));
  });

  test("arb changes load the localization rules when flutter is detected", () => {
    const changed = ["lib/main.dart", "lib/l10n/app_en.arb"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/flutter/localization.instructions.md"));
  });

  test("flutter rules never load for a React-only pull request", () => {
    const changed = ["src/App.tsx", "package.json", "vite.config.ts"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    const loaded = bundle.platformRuleFiles.join("\n");
    assert.ok(!loaded.includes("flutter"));
    assert.ok(!bundle.text.includes("Flutter Review Rules"));
  });

  test("a full lib PR stays inside the prompt budget without truncation", () => {
    const changed = [
      "pubspec.yaml", "lib/main.dart", "lib/app/router.dart", "lib/data/api/profile_api.dart",
      "lib/features/search/search_controller.dart", "lib/widgets/product_grid.dart",
      "lib/l10n/app_en.arb", "lib/platform/battery_channel.dart", "lib/auth/token_storage.dart",
    ];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(changed), null, changed);
    assert.equal(bundle.truncated, false);
    const loaded = bundle.platformRuleFiles.filter((f) => f.endsWith(".instructions.md"));
    assert.ok(loaded.length >= 15, `expected nearly all concerns loaded, got ${loaded.length}`);
  });
});

describe("flutter rules — deterministic scanner layer", () => {
  test("flags disabled TLS validation as critical security on lib code", () => {
    const diff = `diff --git a/lib/api_client.dart b/lib/api_client.dart
--- a/lib/api_client.dart
+++ b/lib/api_client.dart
@@ -1,3 +1,4 @@
 import 'dart:io';
+client.badCertificateCallback = (cert, host, port) => true;
+client.badCertificateCallback = (c, h, p) { return true; };
 import 'package:http/http.dart';`;
    const findings = scanDiff(parseUnifiedDiffFiles(diff));
    assert.equal(findings.length, 2);
    for (const f of findings) {
      assert.equal(f.scannerRuleId, "dart-tls-bypass");
      assert.equal(f.severity, "critical");
      assert.equal(f.category, "security");
      assert.equal(f.file, "lib/api_client.dart");
    }
    assert.deepEqual(findings.map((f) => f.line), [2, 3]);
  });

  test("does not flag validating callbacks, tests, or unrelated dart lines", () => {
    const diff = `diff --git a/lib/api_client.dart b/lib/api_client.dart
--- a/lib/api_client.dart
+++ b/lib/api_client.dart
@@ -1,3 +1,4 @@
 import 'dart:io';
+client.badCertificateCallback = (cert, host, port) => cert.host == 'example.com';
+final callback = client.badCertificateCallback;
 import 'package:http/http.dart';`;
    const testDiff = `diff --git a/test/api_client_test.dart b/test/api_client_test.dart
--- a/test/api_client_test.dart
+++ b/test/api_client_test.dart
@@ -1,3 +1,4 @@
 import 'dart:io';
+client.badCertificateCallback = (cert, host, port) => true;
 import 'package:http/http.dart';`;
    assert.equal(scanDiff(parseUnifiedDiffFiles(diff)).length, 0);
    assert.equal(scanDiff(parseUnifiedDiffFiles(testDiff)).length, 0);
  });

  test("flags cleartext traffic in shipped manifests but not debug variants", () => {
    const mainDiff = `diff --git a/android/app/src/main/AndroidManifest.xml b/android/app/src/main/AndroidManifest.xml
--- a/android/app/src/main/AndroidManifest.xml
+++ b/android/app/src/main/AndroidManifest.xml
@@ -1,2 +1,3 @@
 <manifest>
+    <application android:usesCleartextTraffic="true">
     <activity android:name=".MainActivity"/>`;
    const debugDiff = mainDiff.replaceAll("src/main/AndroidManifest.xml", "src/debug/AndroidManifest.xml");
    const findings = scanDiff(parseUnifiedDiffFiles(mainDiff));
    assert.equal(findings.length, 1);
    assert.equal(findings[0].scannerRuleId, "android-cleartext-traffic");
    assert.equal(findings[0].severity, "critical");
    assert.equal(findings[0].line, 2);
    assert.equal(scanDiff(parseUnifiedDiffFiles(debugDiff)).length, 0);
  });

  test("flutter diffs trigger no Angular scanner rules and Angular rules still fire", () => {
    const flutterDiff = readDiff("positive.diff");
    const angularFindings = scanDiff(parseUnifiedDiffFiles(flutterDiff)).filter((f) => f.category === "angular22" || f.category === "rules" && f.ruleRef?.includes("copilot"));
    assert.equal(angularFindings.length, 0);
    const angularDiff = `diff --git a/src/app/greet.component.ts b/src/app/greet.component.ts
--- a/src/app/greet.component.ts
+++ b/src/app/greet.component.ts
@@ -1,2 +1,3 @@
 import { Component } from '@angular/core';
+@Input() value = '';
 import { Component } from 'other';`;
    const ngFindings = scanDiff(parseUnifiedDiffFiles(angularDiff));
    assert.ok(ngFindings.some((f) => f.scannerRuleId === "ng-input-decorator"));
  });

  test("positive fixture produces exactly the documented scanner findings", () => {
    const findings = scanDiff(parseUnifiedDiffFiles(readDiff("positive.diff")));
    assert.deepEqual(
      findings.map((f) => `${f.file}:${f.line}:${f.scannerRuleId}`).sort(),
      [
        "android/app/src/main/AndroidManifest.xml:5:android-cleartext-traffic",
        "lib/api_client.dart:9:dart-tls-bypass",
      ]
    );
  });

  test("negative fixture produces no scanner findings", () => {
    assert.equal(scanDiff(parseUnifiedDiffFiles(readDiff("negative.diff"))).length, 0);
  });
});
