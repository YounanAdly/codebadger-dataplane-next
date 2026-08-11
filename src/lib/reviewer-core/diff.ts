// Parses the PR diff into per-file chunks that fit inside the model window.
// Uses `git diff` locally; the CI job is responsible for making sure the base ref is fetched.

import { spawnSync } from 'node:child_process';

function runGit(args: string[]) {
  const res = spawnSync('git', args, { cwd: process.cwd(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${res.stderr || res.stdout}`);
  }
  return res.stdout;
}

function shouldSkip(path: string, skipPatterns: string[]) {
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
    if (p.startsWith(pat)) return true;
    // Also match if the pattern equals the whole path (single-file skip)
    if (p === pat) return true;
  }
  return false;
}

export function collectDiff({ baseSha, headSha, cfg }: { baseSha: string; headSha: string; cfg: any }) {
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
    .filter((f) => !shouldSkip(f.path, cfg.skipPathPatterns || []));

  const files: Array<{ path: string; status: string; diff: string; truncated: boolean }> = [];
  let totalBytes = 0;

  for (const f of changed) {
    if (files.length >= (cfg.maxFilesPerReview || 40)) break;
    let diff: string;
    try {
      diff = runGit([
        'diff',
        '--no-color',
        '--unified=3',
        `${baseSha}...${headSha}`,
        '--',
        f.path,
      ]);
    } catch (err: any) {
      console.warn(`[ai-review] could not diff ${f.path}: ${err.message}`);
      continue;
    }

    if (!diff.trim()) continue;

    let truncated = false;
    if (diff.length > (cfg.maxDiffBytesPerFile || 120000)) {
      diff = diff.slice(0, cfg.maxDiffBytesPerFile || 120000);
      truncated = true;
    }

    if (totalBytes + diff.length > (cfg.maxTotalDiffBytes || 800000)) {
      truncated = true;
      const remaining = Math.max(0, (cfg.maxTotalDiffBytes || 800000) - totalBytes);
      diff = diff.slice(0, remaining);
      if (diff.length === 0) break;
    }

    totalBytes += diff.length;
    files.push({ path: f.path, status: statusLabel(f.status), diff, truncated });
  }

  return { baseSha, headSha, files };
}

function statusLabel(s: string) {
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
