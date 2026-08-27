// src/lib/reviewer-core/platform-detector.ts
/**
 * Detects the project platform/language from diff file paths.
 * Returns the platform key and confidence score.
 */

export type Platform =
  | "angular"
  | "flutter"
  | "kotlin"
  | "swift"
  | "react"
  | "vue"
  | "python"
  | "java"
  | "dotnet"
  | "generic";

interface PlatformPattern {
  platform: Platform;
  /** Weight — higher = more confident */
  weight: number;
  /** File path patterns (glob-like) */
  patterns: RegExp[];
}

const PLATFORM_SIGNATURES: PlatformPattern[] = [
  {
    platform: "angular",
    weight: 10,
    patterns: [
      /\.component\.(ts|html)$/,
      /\.module\.ts$/,
      /\.service\.ts$/,
      /\.directive\.ts$/,
      /\.pipe\.ts$/,
      /angular\.json$/,
      /@angular\//,
      /rxjs/,
      /ng\(/,
      /\.spec\.ts$/,
    ],
  },
  {
    platform: "flutter",
    weight: 10,
    patterns: [
      /\.dart$/,
      /pubspec\.yaml$/,
      /flutter/,
      /widget\.dart$/,
      /main\.dart$/,
      /lib\/.+/,
    ],
  },
  {
    platform: "kotlin",
    weight: 8,
    patterns: [
      /\.kt$/,
      /\.kts$/,
      /build\.gradle\.kts$/,
      /android\/.+/,
      /org\.jetbrains\.annotations/,
      /kotlinx\./,
    ],
  },
  {
    platform: "swift",
    weight: 8,
    patterns: [
      /\.swift$/,
      /\.xcodeproj\//,
      /\.xcworkspace\//,
      /Package\.swift$/,
      /import UIKit/,
      /import SwiftUI/,
      /\.storyboard$/,
    ],
  },
  {
    platform: "react",
    weight: 7,
    patterns: [
      /\.(tsx|jsx)$/,
      /react/,
      /next\.config/,
      /useState|useEffect|useCallback/,
      /from ['"]react['"]/,
      /\.css\.module\./,
    ],
  },
  {
    platform: "vue",
    weight: 7,
    patterns: [
      /\.vue$/,
      /vue\.config/,
      /from ['"]vue['"]/,
      /defineComponent/,
      /ref\(|computed\(|reactive\(/,
    ],
  },
  {
    platform: "python",
    weight: 6,
    patterns: [
      /\.py$/,
      /requirements\.txt$/,
      /pyproject\.toml$/,
      /setup\.py$/,
      /from django/,
      /from fastapi/,
      /import pytest/,
    ],
  },
  {
    platform: "java",
    weight: 6,
    patterns: [
      /\.java$/,
      /pom\.xml$/,
      /build\.gradle$/,
      /src\/main\/java/,
      /@SpringBoot/,
      /import java\./,
    ],
  },
  {
    platform: "dotnet",
    weight: 6,
    patterns: [
      /\.cs$/,
      /\.csproj$/,
      /\.sln$/,
      /using Microsoft/,
      /namespace .+/,
      /\.razor$/,
    ],
  },
];

/**
 * Detect platform from a list of changed file paths.
 * Returns the best match and a confidence score (0-1).
 */
export function detectPlatform(
  filePaths: string[]
): { platform: Platform; confidence: number } {
  const scores: Record<Platform, number> = {} as any;

  for (const sig of PLATFORM_SIGNATURES) {
    let hits = 0;
    for (const fp of filePaths) {
      for (const pat of sig.patterns) {
        if (pat.test(fp)) {
          hits++;
          break;
        }
      }
    }
    if (hits > 0) {
      scores[sig.platform] = (scores[sig.platform] || 0) + hits * sig.weight;
    }
  }

  let best: Platform = "generic";
  let bestScore = 0;

  for (const [plat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = plat as Platform;
    }
  }

  // Confidence: normalized by number of files
  const maxPossible = filePaths.length * 10; // max weight per match
  const confidence = Math.min(bestScore / Math.max(maxPossible * 0.3, 1), 1);

  return { platform: best, confidence };
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
