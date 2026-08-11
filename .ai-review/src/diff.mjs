// Parses the PR diff into per-file chunks that fit inside the model window.
// Uses `git diff` locally; the CI job is responsible for making sure the base ref is fetched.

import { spawnSync } from 'node:child_process';
import { REPO_ROOT } from './config.mjs';

function runGit(args) {
  const res = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

function shouldSkip(path, skipPatterns) {
  const p = path.toLowerCase().replace(/^\.\//, '');
  for (const raw of skipPatterns) {
    const pat = raw.toLowerCase();
    if (!pat) continue;
    // Explicit "match anywhere" prefix: `**/foo/` or `**/bar.ext`
    if (pat.startsWith('**/')) {
      const inner = pat.slice(3);
      if (p.includes('/' + inner) || p.startsWith(inner)) return true;
      continue;
    }
    // File-extension pattern: `.png`, `.map`, `.woff2` — anchor to end of path
    if (pat.startsWith('.') && !pat.includes('/')) {
      if (p.endsWith(pat)) return true;
      continue;
    }
    // Folder / file path pattern — must be an exact prefix of the path.
    // This is the important fix: `public/` no longer matches `src/app/public/*`.
    if (p.startsWith(pat)) return true;
    // Also match if the pattern equals the whole path (single-file skip)
    if (p === pat) return true;
  }
  return false;
}

/**
 * @returns {{ baseSha: string, headSha: string, files: Array<{path, status, diff, truncated}> }}
 */
export function collectDiff({ baseSha, headSha, cfg }) {
  // Get the list of changed files with status. `--diff-filter=d` drops deletions.
  const nameStatus = runGit([
    'diff',
    '--name-status',
    '--no-color',
    '--diff-filter=ACMR', // Added, Copied, Modified, Renamed
    `${baseSha}...${headSha}`,
  ]);

  const changed = nameStatus
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split('\t');
      // Renames come as "R100\told\tnew" — take the new path.
      const path = rest[rest.length - 1];
      return { status: status[0], path };
    })
    .filter((f) => !shouldSkip(f.path, cfg.skipPathPatterns));

  const files = [];
  let totalBytes = 0;

  for (const f of changed) {
    if (files.length >= cfg.maxFilesPerReview) break;
    let diff;
    try {
      diff = runGit([
        'diff',
        '--no-color',
        '--unified=3',
        `${baseSha}...${headSha}`,
        '--',
        f.path,
      ]);
    } catch (err) {
      console.warn(`[ai-review] could not diff ${f.path}: ${err.message}`);
      continue;
    }

    if (!diff.trim()) continue;

    let truncated = false;
    if (diff.length > cfg.maxDiffBytesPerFile) {
      diff = diff.slice(0, cfg.maxDiffBytesPerFile);
      truncated = true;
    }

    if (totalBytes + diff.length > cfg.maxTotalDiffBytes) {
      truncated = true;
      const remaining = Math.max(0, cfg.maxTotalDiffBytes - totalBytes);
      diff = diff.slice(0, remaining);
      if (diff.length === 0) break;
    }

    totalBytes += diff.length;
    files.push({ path: f.path, status: statusLabel(f.status), diff, truncated });
  }

  return { baseSha, headSha, files };
}

function statusLabel(s) {
  switch (s) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'R':
      return 'renamed';
    case 'C':
      return 'copied';
    default:
      return s;
  }
}
