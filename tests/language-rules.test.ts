// tests/language-rules.test.ts
// Level 1 (rule integrity), Level 2 (language detection), and Level 3 (rule
// selection/isolation) coverage for every non-Flutter platform Codrevia ships:
// instruction-library integrity for angular/android/ios, detection of all 19
// platforms (including the swift→ios ruleset alias and the rust/sql packs),
// per-platform rule selection, cross-language isolation, and mixed-PR handling.
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
  COMMON_RULE_FILES,
} = require("../src/lib/reviewer-core/rule-loader.ts");
const { detectPlatforms, platformForFile } = require("../src/lib/reviewer-core/platform-detector.ts");

const repoRoot = process.cwd();
const instructionsRoot = path.join(repoRoot, ".github", "instructions");

// Realistic changed paths spanning every instruction library — each instruction
// file must match at least one of these, proving its scope is reachable.
const PATH_UNIVERSE = [
  // Android
  "app/src/main/kotlin/app/ui/ProfileScreen.kt",
  "app/src/main/java/app/User.java",
  "app/src/main/AndroidManifest.xml",
  "app/src/main/res/layout/item_user.xml",
  "app/src/main/res/values/strings.xml",
  "app/src/main/res/values/themes.xml",
  "app/src/main/res/values/attrs.xml",
  "app/src/main/res/drawable/badge.xml",
  "app/src/main/res/navigation/nav_graph.xml",
  "app/src/main/res/xml/network_security_config.xml",
  "app/build.gradle.kts",
  "gradle/libs.versions.toml",
  "app/src/test/java/app/UserTest.kt",
  "app/src/androidTest/java/app/LoginTest.kt",
  // iOS
  "App/Sources/ProfileView.swift",
  "App/Tests/ProfileTests.swift",
  "App/Tests/LoginSpec.swift",
  "App/Support/Info.plist",
  "App/Support/App.entitlements",
  "App/Resources/en.lproj/Localizable.strings",
  "App/Resources/Localizable.xcstrings",
  "App/App.xcodeproj/project.pbxproj",
  "Podfile",
  "App/Package.swift",
  // Angular
  "src/app/public/login/login.component.ts",
  "src/app/public/login/login.component.html",
  "src/app/shared/services/auth/auth.service.ts",
  "src/app/shared/interceptors/auth.interceptor.ts",
  "src/app/shared/formly/custom-components/drop-down/drop-down.type.ts",
  "src/app/public/service-request/forms/form.json",
  "src/styles/global.theme.scss",
  "src/assets/i18n/en.json",
  // Frontend (react / vue / nextjs)
  "src/components/CommentList.tsx",
  "src/components/CommentList.test.tsx",
  "src/components/ProductCard.vue",
  "src/store/auth.spec.ts",
  "app/page.tsx",
  // Node.js
  "server.js",
  "src/routes/orders.js",
  // Python
  "app/main.py",
  "app/api/orders.py",
  "tests/test_orders.py",
  // Java
  "src/main/java/app/OrderService.java",
  "src/test/java/app/OrderServiceTest.java",
  // .NET
  "src/Services/OrderService.cs",
  "tests/Orders/OrderServiceTests.cs",
  // Go
  "internal/store/store.go",
  "internal/store/store_test.go",
  // PHP
  "app/Models/Order.php",
  "tests/Feature/OrderApiTest.php",
  // Ruby
  "app/models/order.rb",
  "spec/models/order_spec.rb",
];

// One representative changed-file set per supported platform. Swift sources
// resolve to the "ios" platform (its signatures cover .swift files and its
// instruction library contains the Swift/SwiftUI/UIKit packages).
const DETECTION_SAMPLES = {
  angular: ["angular.json", "src/app/app.component.ts"],
  flutter: ["pubspec.yaml", "lib/main.dart"],
  kotlin: ["build.gradle.kts", "src/main/kotlin/app/User.kt"],
  react: ["vite.config.ts", "src/App.tsx"],
  nextjs: ["next.config.ts", "app/page.tsx"],
  "react-native": ["app.json", "App.tsx"],
  vue: ["nuxt.config.ts", "src/App.vue"],
  nodejs: ["server.js", "src/routes/api.ts"],
  python: ["pyproject.toml", "app/main.py"],
  java: ["pom.xml", "src/main/java/app/App.java"],
  android: ["android/app/src/main/AndroidManifest.xml", "android/app/build.gradle"],
  ios: ["App/Sources/View.swift", "Podfile"],
  dotnet: ["App.csproj", "Program.cs"],
  go: ["go.mod", "main.go"],
  php: ["composer.json", "src/Controller/Home.php"],
  ruby: ["Gemfile", "app/models/user.rb"],
  rust: ["Cargo.toml", "src/main.rs"],
  sql: ["db/migrations/002_add_users.sql"],
};

const listInstructionFiles = (library) =>
  fs.readdirSync(path.join(instructionsRoot, library), { recursive: true })
    .map((p) => String(p).split(path.sep).join("/"))
    .filter((p) => p.endsWith(".instructions.md"));

// Every language with a baseline rules.md must also declare an instruction
// library — index/disk sync and frontmatter validity are checked for each.
const INSTRUCTION_LIBRARIES = [
  "angular", "android", "ios", "react", "vue", "nextjs", "nodejs",
  "python", "java", "dotnet", "go", "php", "ruby",
];

describe("language rules — Level 1: instruction library integrity", () => {
  for (const library of INSTRUCTION_LIBRARIES) {
    test(`${library}: index and disk stay in sync`, () => {
      const baseline = fs.readFileSync(path.join(repoRoot, "rules", library, "rules.md"), "utf8");
      const entries = parseIndexEntries(baseline);
      assert.ok(entries.length > 0, `${library} baseline declares no instruction index`);
      const indexed = new Set(entries.map((e) => e.path.replace(/^.*\//, "")));
      const onDisk = new Set(listInstructionFiles(library).map((p) => p.replace(/^.*\//, "")));
      for (const name of indexed) assert.ok(onDisk.has(name), `${library}: indexed but missing on disk: ${name}`);
      for (const name of onDisk) assert.ok(indexed.has(name), `${library}: on disk but not indexed: ${name}`);
      for (const entry of entries) assert.ok(entry.description.length > 0, `${library}: no description for ${entry.path}`);
    });

    test(`${library}: every instruction file has valid frontmatter and reachable scope`, () => {
      for (const rel of listInstructionFiles(library)) {
        const md = fs.readFileSync(path.join(instructionsRoot, library, rel), "utf8");
        const globs = parseApplyTo(md).flatMap(expandBraces);
        assert.ok(globs.length > 0, `${library}/${rel} has no applyTo frontmatter`);
        for (const glob of globs) assert.doesNotThrow(() => globToRegex(glob), `${library}/${rel} invalid glob: ${glob}`);
        const description = md.match(/^description:\s*"([^"]*)"/m);
        assert.ok(description && description[1].trim().length > 0, `${library}/${rel} has no description`);
        const reachable = globs.some((g) => PATH_UNIVERSE.some((p) => globToRegex(g).test(p)));
        assert.ok(reachable, `${library}/${rel} applyTo matches no realistic changed path`);
      }
    });
  }

  test("every referenced angular rules-extra file exists", () => {
    // PLATFORM_RULE_FILES configures angular to load rules.md + rules-extra.md;
    // a missing file would silently shrink the rulebook.
    assert.ok(fs.existsSync(path.join(repoRoot, "rules", "angular", "rules-extra.md")));
  });

  test("common rules are complete: every configured file exists on disk", () => {
    for (const f of COMMON_RULE_FILES) {
      assert.ok(fs.existsSync(path.join(repoRoot, "rules", "common", f)), `missing common rule file: ${f}`);
    }
  });
});

describe("language rules — Level 2: platform detection", () => {
  for (const [expected, files] of Object.entries(DETECTION_SAMPLES)) {
    test(`detects ${expected}`, () => {
      const r = detectPlatforms(files);
      assert.equal(r.fallbackUsed, false);
      assert.equal(r.primary, expected, `files [${files}] should detect ${expected}`);
    });
  }

  test("pure-Swift pull requests detect ios even without an Xcode manifest", () => {
    const r = detectPlatforms(["App/Sources/View.swift"]);
    assert.equal(r.primary, "ios", ".swift sources must keep the iOS rulebook reachable");
    assert.ok(!r.platforms.some((p) => p.name === "flutter"), "unrelated platforms must not appear");
  });

  test("mixed-language pull requests detect every affected platform", () => {
    const r = detectPlatforms(["src/App.tsx", "server.js", "db/migrations/003_indexes.sql"]);
    for (const expected of ["react", "nodejs", "sql"]) {
      assert.ok(r.platforms.some((p) => p.name === expected), `missing ${expected}`);
    }
  });

  test("build output directories are never review signals", () => {
    const r = detectPlatforms(["target/debug/deps/app.rlib", "app/target/classes/Main.class"]);
    assert.equal(r.fallbackUsed, true);
  });

  test("Python app/api/ layouts are not misdetected as Next.js", () => {
    const python = detectPlatforms(["app/main.py", "app/api/orders.py"]);
    assert.ok(python.platforms.some((p) => p.name === "python"));
    assert.ok(!python.platforms.some((p) => p.name === "nextjs"), "extension-agnostic app/api/ matching hijacks Python backends");
    const next = detectPlatforms(["next.config.ts", "app/api/comments/route.ts"]);
    assert.equal(next.primary, "nextjs");
  });

  test("platformForFile tags each finding to the file's own platform", () => {
    const r = detectPlatforms(["src/App.tsx", "server.js", "db/migrations/003_indexes.sql"]);
    assert.equal(platformForFile("src/components/Card.tsx", r.platforms), "react");
    assert.equal(platformForFile("server.js", r.platforms), "nodejs");
    assert.equal(platformForFile("db/migrations/004_orders.sql", r.platforms), "sql");
  });
});

describe("language rules — Level 3: rule selection and isolation", () => {
  test("every detected platform receives its baseline rulebook", () => {
    for (const [platform, files] of Object.entries(DETECTION_SAMPLES)) {
      const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
      assert.ok(
        bundle.platformRuleFiles.includes(`${platform}/rules.md`),
        `${platform} PR must load ${platform}/rules.md (loaded: ${bundle.platformRuleFiles.join(", ")})`
      );
    }
  });

  test("pure-Swift PRs load the full iOS instruction library, not the fallback", () => {
    const files = ["App/Sources/View.swift", "App/Sources/Networking/ApiClient.swift"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    assert.ok(bundle.platformRuleFiles.includes("ios/rules.md"));
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/ios/swift/swift.instructions.md"));
    assert.ok(bundle.text.includes("iOS Review Rules"));
    assert.equal(bundle.fallbackUsed, false);
  });

  test("common rules (including API & data integrity) load for every platform", () => {
    for (const files of Object.values(DETECTION_SAMPLES)) {
      const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
      for (const f of COMMON_RULE_FILES) {
        assert.ok(bundle.commonRuleFiles.includes(`common/${f}`), `common/${f} missing for [${files}]`);
      }
      assert.ok(bundle.text.includes("Common API & Data Integrity Rules"));
    }
  });

  test("mixed TypeScript + Node.js PR selects both rulebooks and tags findings per file", () => {
    const files = ["src/App.tsx", "server.js"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    assert.ok(bundle.platformRuleFiles.includes("react/rules.md"));
    assert.ok(bundle.platformRuleFiles.includes("nodejs/rules.md"));
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/react/react.instructions.md"));
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/nodejs/nodejs.instructions.md"));
    assert.ok(bundle.text.includes("React Review Rules"));
    assert.ok(bundle.text.includes("Node.js Review Rules"));
  });

  test("react PR loads the component, state, performance, security, and testing packs by scope", () => {
    const files = ["src/components/CommentList.tsx", "src/components/CommentList.test.tsx"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    for (const pack of ["react", "state-management", "performance", "security", "testing"]) {
      assert.ok(
        bundle.platformRuleFiles.includes(`.github/instructions/react/${pack}.instructions.md`),
        `missing react pack: ${pack}`
      );
    }
  });

  test("python web-layer pack loads for app/api changes, testing pack for test changes", () => {
    const api = loadRuleBundle(repoRoot, detectPlatforms(["app/api/orders.py"]), null, ["app/api/orders.py"]);
    assert.ok(api.platformRuleFiles.includes(".github/instructions/python/web.instructions.md"));
    const tests = loadRuleBundle(repoRoot, detectPlatforms(["tests/test_orders.py"]), null, ["tests/test_orders.py"]);
    assert.ok(tests.platformRuleFiles.includes(".github/instructions/python/testing.instructions.md"));
    assert.ok(!tests.platformRuleFiles.includes(".github/instructions/python/web.instructions.md"));
  });

  test("nextjs PR loads both rendering and data packs", () => {
    const files = ["app/page.tsx", "app/api/comments/route.ts"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/nextjs/nextjs.instructions.md"));
    assert.ok(bundle.platformRuleFiles.includes(".github/instructions/nextjs/data.instructions.md"));
  });

  test("python + SQL migration PR selects both rulebooks", () => {
    const files = ["app/api/users.py", "db/migrations/002_add_users.sql"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    assert.ok(bundle.platformRuleFiles.includes("python/rules.md"));
    assert.ok(bundle.platformRuleFiles.includes("sql/rules.md"));
    assert.ok(bundle.text.includes("SQL & Database Review Rules"));
  });

  test("language rules never leak into an unrelated platform's review", () => {
    const files = ["app/main.py", "pyproject.toml"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    const loaded = bundle.platformRuleFiles.join("\n");
    for (const foreign of ["angular/", "react/", "vue/", "dotnet/", "go/", "php/", "ruby/", "kotlin/", "flutter/", "android/", "ios/"]) {
      assert.ok(!loaded.includes(foreign), `python PR must not load ${foreign}`);
    }
  });

  test("instruction files stay scoped to their library for Swift-only changes", () => {
    // A Swift-source PR must not pull android or flutter instructions.
    const files = ["App/Sources/View.swift"];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    const loaded = bundle.platformRuleFiles.join("\n");
    assert.ok(!loaded.includes("instructions/android/"));
    assert.ok(!loaded.includes("instructions/flutter/"));
  });

  test("a five-platform pull request stays inside the prompt budget", () => {
    const files = [
      "app/main.py", "db/migrations/002_add_users.sql", "src/App.tsx",
      "server.js", "main.go", "internal/store/store.go",
    ];
    const bundle = loadRuleBundle(repoRoot, detectPlatforms(files), null, files);
    assert.equal(bundle.truncated, false);
    const baselines = bundle.platformRuleFiles.filter((f) => f.endsWith("rules.md"));
    assert.ok(baselines.length >= 5, `expected >= 5 baselines, got: ${baselines.join(", ")}`);
  });
});
