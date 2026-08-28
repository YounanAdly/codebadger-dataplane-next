// src/lib/reviewer-core/platform-detector.ts
/**
 * Multi-platform detection for the AI reviewer.
 *
 * Detection is based primarily on pull-request changed files, with repository
 * manifests used as boosting signals. Every matched file is recorded as
 * evidence so detection is auditable, and each platform gets an independent
 * confidence score (0-1). Platforms scoring above CONFIDENCE_THRESHOLD are
 * all reported — a repo can legitimately be multi-platform.
 */

export type Platform =
  | "angular"
  | "flutter"
  | "kotlin"
  | "swift"
  | "react"
  | "nextjs"
  | "react-native"
  | "vue"
  | "nodejs"
  | "python"
  | "java"
  | "android"
  | "ios"
  | "dotnet"
  | "go"
  | "php"
  | "ruby"
  | "generic";

export const ALL_PLATFORMS: Platform[] = [
  "angular", "flutter", "kotlin", "swift", "react", "nextjs", "react-native",
  "vue", "nodejs", "python", "java", "android", "ios", "dotnet", "go", "php", "ruby",
];

/** Platforms below this confidence are ignored; at 0 we fall back to `generic`. */
export const CONFIDENCE_THRESHOLD = 0.4;

export interface DetectedPlatform {
  name: Platform;
  confidence: number;
  /** Changed/manifest files that produced the signal. */
  evidence: string[];
}

export interface PlatformDetectionResult {
  platforms: DetectedPlatform[];
  /** Primary platform: highest confidence, or "generic" on fallback. */
  primary: Platform;
  fallbackUsed: boolean;
}

interface PlatformPattern {
  platform: Platform;
  /** Weight — manifest/config files carry more signal than source extensions. */
  weight: number;
  patterns: RegExp[];
}

/**
 * Weights: explicit project configuration (5) > dependency manifest (4) >
 * distinctive source layout (2) > file extension (1).
 */
const PLATFORM_SIGNATURES: PlatformPattern[] = [
  {
    platform: "angular",
    weight: 5,
    patterns: [
      /(^|\/)angular\.json$/,
      /(^|\/)nx\.json$/,
      /\.component\.ts$/,
      /\.module\.ts$/,
      /\.directive\.ts$/,
      /\.pipe\.ts$/,
      /app\.config\.ts$/,
      /\.service\.ts$/,
    ],
  },
  {
    platform: "flutter",
    weight: 5,
    patterns: [
      /(^|\/)pubspec\.yaml$/,
      /(^|\/)pubspec\.lock$/,
      /(^|\/)\.metadata$/,
    ],
  },
  {
    platform: "flutter",
    weight: 2,
    patterns: [/\.dart$/, /(^|\/)lib\/.+\.dart$/, /widget_test\.dart$/],
  },
  {
    platform: "nextjs",
    weight: 5,
    patterns: [
      /(^|\/)next\.config\.(js|ts|mjs)$/,
      /(^|\/)middleware\.ts$/,
    ],
  },
  {
    platform: "nextjs",
    weight: 2,
    patterns: [
      /(^|\/)app\/.+\.(tsx|ts|jsx|js)$/,
      /(^|\/)pages\/.+\.(tsx|ts|jsx|js)$/,
      /(^|\/)app\/api\//,
      /(^|\/)next-env\.d\.ts$/,
    ],
  },
  {
    platform: "react-native",
    weight: 5,
    patterns: [/(^|\/)app\.json$/, /(^|\/)babel\.config\.js$/],
  },
  {
    platform: "react-native",
    weight: 2,
    patterns: [/(^|\/)App\.(tsx|jsx|ts|js)$/, /\.ios\.(tsx|jsx|ts|js)$/, /\.android\.(tsx|jsx|ts|js)$/],
  },
  {
    platform: "react",
    weight: 4,
    patterns: [/(^|\/)vite\.config\.(ts|js)$/, /(^|\/)react-router\.config\.ts$/],
  },
  {
    platform: "react",
    weight: 2,
    patterns: [/\.tsx$/, /\.jsx$/, /\.css\.module\.(css|scss)$/],
  },
  {
    platform: "vue",
    weight: 5,
    patterns: [/(^|\/)vue\.config\.(js|ts)$/, /(^|\/)nuxt\.config\.(ts|js)$/],
  },
  {
    platform: "vue",
    weight: 2,
    patterns: [/\.vue$/],
  },
  {
    platform: "nodejs",
    weight: 4,
    patterns: [
      /(^|\/)server\.(js|ts|mjs)$/,
      /(^|\/)(express|fastify|nest|serverless)\.config\.(js|ts)$/,
      /(^|\/)serverless\.yml$/,
    ],
  },
  {
    platform: "nodejs",
    weight: 1,
    patterns: [/\.mjs$/, /(^|\/)scripts\/.+\.(js|ts)$/],
  },
  {
    platform: "python",
    weight: 5,
    patterns: [
      /(^|\/)pyproject\.toml$/,
      /(^|\/)requirements(\.dev|\.txt)?\.txt$/,
      /(^|\/)setup\.py$/,
      /(^|\/)Pipfile$/,
    ],
  },
  {
    platform: "python",
    weight: 2,
    patterns: [/\.py$/],
  },
  {
    platform: "java",
    weight: 5,
    patterns: [/(^|\/)pom\.xml$/, /(^|\/)build\.gradle$/],
  },
  {
    platform: "java",
    weight: 2,
    patterns: [/\.java$/, /src\/main\/java\//],
  },
  {
    platform: "kotlin",
    weight: 5,
    patterns: [/(^|\/)build\.gradle\.kts$/, /(^|\/)settings\.gradle\.kts$/],
  },
  {
    platform: "kotlin",
    weight: 2,
    patterns: [/\.kt$/, /\.kts$/],
  },
  {
    platform: "android",
    weight: 5,
    patterns: [/(^|\/)AndroidManifest\.xml$/],
  },
  {
    platform: "android",
    weight: 2,
    patterns: [
      /(^|\/)android\/app\//,
      /(^|\/)android\/build\.gradle(\.kts)?$/,
      /res\/layout\/.+\.xml$/,
    ],
  },
  {
    platform: "ios",
    weight: 5,
    patterns: [
      /(^|\/)Podfile$/,
      /(^|\/)Package\.swift$/,
      /\.xcodeproj\//,
      /\.xcworkspace\//,
    ],
  },
  {
    platform: "ios",
    weight: 2,
    patterns: [/\.swift$/, /\.storyboard$/, /\.xib$/],
  },
  {
    platform: "dotnet",
    weight: 5,
    patterns: [/\.csproj$/, /\.sln$/, /\.fsproj$/],
  },
  {
    platform: "dotnet",
    weight: 2,
    patterns: [/\.cs$/, /\.razor$/],
  },
  {
    platform: "go",
    weight: 5,
    patterns: [/(^|\/)go\.mod$/, /(^|\/)go\.sum$/],
  },
  {
    platform: "go",
    weight: 2,
    patterns: [/\.go$/],
  },
  {
    platform: "php",
    weight: 5,
    patterns: [/(^|\/)composer\.(json|lock)$/, /(^|\/)artisan$/],
  },
  {
    platform: "php",
    weight: 2,
    patterns: [/\.php$/],
  },
  {
    platform: "ruby",
    weight: 5,
    patterns: [/(^|\/)Gemfile$/, /(^|\/)Gemfile\.lock$/, /(^|\/)\.rubocop\.yml$/],
  },
  {
    platform: "ruby",
    weight: 2,
    patterns: [/\.rb$/, /\.erb$/],
  },
];

interface ScoreAccumulator {
  score: number;
  evidence: Set<string>;
}

/**
 * Detect all platforms affected by a change.
 *
 * @param changedFiles  Pull-request changed file paths (primary signal).
 * @param repositoryFiles  Optional repository file tree (secondary signal).
 * @param manifests  Optional manifest/config file paths from the repo root
 *   (strongest signal — e.g. fetched separately from the VCS API).
 */
export function detectPlatforms(
  changedFiles: string[],
  repositoryFiles: string[] = [],
  manifests: string[] = []
): PlatformDetectionResult {
  const acc = new Map<Platform, ScoreAccumulator>();

  const addMatch = (platform: Platform, weight: number, file: string) => {
    // Changed-file signals count double: the review scope is the PR, not the repo.
    const effectiveWeight = repositoryFiles.includes(file) ? weight : weight * 2;
    const entry = acc.get(platform) || { score: 0, evidence: new Set<string>() };
    entry.score += effectiveWeight;
    entry.evidence.add(file);
    acc.set(platform, entry);
  };

  for (const file of [...changedFiles, ...repositoryFiles, ...manifests]) {
    for (const sig of PLATFORM_SIGNATURES) {
      for (const pat of sig.patterns) {
        if (pat.test(file)) {
          // Base weight from the signature, boosted for strong manifest hits.
          addMatch(sig.platform, sig.weight, file);
          break;
        }
      }
    }
  }

  const platforms: DetectedPlatform[] = [];
  for (const [name, { score, evidence }] of acc) {
    // Confidence saturates at a score of 10 (e.g. one manifest hit + a few sources).
    const confidence = Math.min(score / 10, 1);
    if (confidence >= CONFIDENCE_THRESHOLD) {
      platforms.push({ name, confidence: round2(confidence), evidence: [...evidence] });
    }
  }
  platforms.sort((a, b) => b.confidence - a.confidence);

  if (platforms.length === 0) {
    return {
      platforms: [{ name: "generic", confidence: 1, evidence: [] }],
      primary: "generic",
      fallbackUsed: true,
    };
  }

  return {
    platforms,
    primary: platforms[0].name,
    fallbackUsed: false,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Back-compatible single-platform detection.
 * Returns the highest-confidence platform or "generic".
 */
export function detectPlatform(
  filePaths: string[]
): { platform: Platform; confidence: number } {
  const result = detectPlatforms(filePaths);
  return { platform: result.primary, confidence: result.platforms[0]?.confidence ?? 0 };
}

/** Map a single changed file to a detected platform (for finding tags). */
export function platformForFile(file: string, detected: DetectedPlatform[]): Platform | null {
  for (const d of detected) {
    if (d.name === "generic") continue;
    for (const sig of PLATFORM_SIGNATURES.filter((s) => s.platform === d.name)) {
      for (const pat of sig.patterns) {
        if (pat.test(file)) return d.name;
      }
    }
  }
  return null;
}

/** Directories and file patterns that are never review signals. */
const GENERATED_FILE_PATTERN =
  /(^|\/)(node_modules|\.dart_tool|build|dist|\.gradle|Pods|\.venv|coverage|vendor|\.next|\.angular)\//;

export function isGeneratedFile(filePath: string): boolean {
  if (GENERATED_FILE_PATTERN.test(filePath)) return true;
  return /\.(g|freezed)\.dart$/.test(filePath);
}

/**
 * Extract file paths from a unified diff string.
 */
export function extractFilePaths(diff: string): string[] {
  const paths: string[] = [];
  const regex = /^diff --git a\/.+ b\/(.+)$/gm;
  let match;
  while ((match = regex.exec(diff)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}
