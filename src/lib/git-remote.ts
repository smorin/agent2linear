/**
 * Git remote reading + parsing for profile auto-detection (Phase 3).
 *
 * `readGitOriginUrl()` is the ONLY new child_process use beyond browser.ts. It is
 * kept separate from the pure `parseRemoteOwner()` so detection logic is unit-
 * tested without shelling out (mirroring the injectable `findProjectConfigDir`).
 *
 * The origin URL is memoized per startDir for the process lifetime: a repo's
 * remote does not change within one invocation, and the resolver may ask for it
 * several times (getApiKey is called by the client + both cache modules). This
 * keeps git to a single spawn per directory. `__resetGitRemoteCache()` clears it
 * for test isolation.
 */

import { execFileSync } from 'child_process';
import { basename, dirname } from 'path';

let cache: { dir: string; url: string | null } | undefined;

/**
 * Whether `filePath` is tracked by git. Returns false for an untracked file, a
 * non-repo, or when git is unavailable (degrades gracefully — never throws).
 */
export function isTrackedByGit(filePath: string): boolean {
  try {
    execFileSync('git', ['-C', dirname(filePath), 'ls-files', '--error-unmatch', basename(filePath)], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the `origin` remote URL via git, or null when there is no repo, no
 * `origin` remote, a detached/bare repo, or git is unavailable. Prefers `origin`
 * among multiple remotes by querying it directly.
 */
export function readGitOriginUrl(startDir: string = process.cwd()): string | null {
  if (cache && cache.dir === startDir) {
    return cache.url;
  }
  let url: string | null = null;
  try {
    const out = execFileSync('git', ['-C', startDir, 'remote', 'get-url', 'origin'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    url = out.trim() || null;
  } catch {
    url = null;
  }
  cache = { dir: startDir, url };
  return url;
}

/** Clear the memoized origin URL (test isolation). */
export function __resetGitRemoteCache(): void {
  cache = undefined;
}

/**
 * Parse a git remote URL into `{ host, owner }`, or null when it can't be parsed.
 *
 * Handles SCP-style SSH (`git@github.com:acme/repo.git`), `ssh://` URLs, and
 * HTTPS URLs (with optional userinfo/port), strips a trailing `.git`, and takes
 * the first path segment as the owner (so monorepo subgroups still yield the
 * top-level owner). Non-GitHub hosts parse the same way; matching is on owner.
 */
export function parseRemoteOwner(url: string | null): { host: string; owner: string } | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  let host: string;
  let path: string;

  // scheme://[user@]host[:port]/owner/repo(.git)
  const urlMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(trimmed);
  if (urlMatch) {
    host = urlMatch[1];
    path = urlMatch[2];
  } else if (trimmed.includes('://')) {
    // A scheme:// URL that didn't fully parse (e.g. no owner/repo path) — reject
    // rather than letting the scp pattern misread the scheme as the host.
    return null;
  } else {
    // SCP-like: [user@]host:owner/repo(.git)
    const scpMatch = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(trimmed);
    if (!scpMatch) {
      return null;
    }
    host = scpMatch[1];
    path = scpMatch[2];
  }

  const segments = path
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean);
  if (segments.length === 0) {
    return null;
  }
  return { host, owner: segments[0] };
}

/**
 * Normalize a user-supplied `--git-remote-owner` value to a bare owner.
 *
 * Accepts BOTH forms for resilience: a bare owner (`acme-co`) is returned as-is,
 * and a full repo URL (SSH/HTTPS/scp) has its owner extracted via
 * `parseRemoteOwner`. Returns null for malformed input (e.g. a URL-like string
 * with no owner, or a token containing path/host separators) so the caller can
 * error instead of silently storing something that will never match.
 */
export function normalizeRemoteOwner(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  // A URL/scp form -> extract the owner.
  const parsed = parseRemoteOwner(trimmed);
  if (parsed) {
    return parsed.owner;
  }
  // A bare owner token: GitHub/GitLab owner charset, no scheme/host/path separators.
  if (/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}
