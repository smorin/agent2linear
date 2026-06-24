/**
 * Git-derived resolution context for config overrides (M29 §5.4).
 *
 * Resolves a directory's repo root, current branch, and ALL remotes (normalized to
 * `{host, owner, name}`) so identity (`repo`/`owner`/`host`) and `branch` matchers
 * can be evaluated. `run` is injectable (the `profiles.ts` provider pattern) so unit
 * tests stay offline; results are cached per contextDir for the process.
 *
 * `git-remote.ts:parseRemoteOwner` is left untouched — it takes the FIRST path
 * segment as owner (for profile auto-detection); §5.4 needs the LAST segment as the
 * name and the rest as the owner (nested GitLab groups). Hence a separate normalizer.
 */

import { execFileSync } from 'child_process';

export interface RemoteIdentity {
  host: string;
  owner: string;
  name: string;
}

export interface GitContext {
  repoRoot: string | null;
  branch?: string;
  remotes: Record<string, RemoteIdentity>;
}

export type GitRun = (args: string[]) => string | null;

/** Default git runner: `git -C <contextDir> <args>`, trimmed stdout, or null on any failure. */
export function defaultGitRun(contextDir: string): GitRun {
  return (args) => {
    try {
      return execFileSync('git', ['-C', contextDir, ...args], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
}

/**
 * Normalize a git remote URL to `{host, owner, name}` per §5.4: strip a trailing
 * `.git`; accept `scheme://`, `user@host:path` (scp), and `ssh://…` forms; the LAST
 * path segment is `name`, the rest is `owner` (supports nested GitLab groups).
 * Returns null for input that isn't a real `owner/name` remote.
 */
export function normalizeRemoteUrl(raw: string): RemoteIdentity | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  let host: string;
  let path: string;

  // scheme://[user@]host[:port]/owner/.../repo(.git)
  const urlMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/.exec(trimmed);
  if (urlMatch) {
    host = urlMatch[1];
    path = urlMatch[2];
  } else if (trimmed.includes('://')) {
    // A scheme:// URL with no owner/repo path — reject rather than let the scp
    // pattern misread the scheme as the host.
    return null;
  } else {
    // SCP-like: [user@]host:owner/.../repo(.git)
    const scpMatch = /^(?:[^@/]+@)?([^/:]+):(.+)$/.exec(trimmed);
    if (!scpMatch) {
      return null;
    }
    host = scpMatch[1];
    path = scpMatch[2];
  }

  const segments = path
    .replace(/\/+$/, '') // tolerate a copied URL's trailing slash before stripping .git
    .replace(/\.git$/, '')
    .split('/')
    .filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  return { host, owner: segments.slice(0, -1).join('/'), name: segments[segments.length - 1] };
}

const cache = new Map<string, GitContext>();

/**
 * Resolve the git context for a directory (repoRoot, branch, all remotes). Degrades
 * gracefully — no repo / detached HEAD / no remotes yield null/undefined/empty, never
 * a throw. Cached per contextDir for the process.
 */
export function buildGitContext(contextDir: string, run: GitRun = defaultGitRun(contextDir)): GitContext {
  const cached = cache.get(contextDir);
  if (cached) {
    return cached;
  }

  const top = run(['rev-parse', '--show-toplevel']);
  const branchOut = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  // Detached HEAD reports the literal "HEAD" — treat as no branch.
  const branch = branchOut && branchOut !== 'HEAD' ? branchOut : undefined;

  const remotes: Record<string, RemoteIdentity> = {};
  const remotesOut = run(['config', '--get-regexp', '^remote\\..*\\.url$']);
  if (remotesOut) {
    for (const line of remotesOut.split('\n')) {
      const sp = line.indexOf(' ');
      if (sp === -1) {
        continue;
      }
      const nameMatch = /^remote\.(.+)\.url$/.exec(line.slice(0, sp));
      if (!nameMatch) {
        continue;
      }
      const identity = normalizeRemoteUrl(line.slice(sp + 1));
      if (identity) {
        remotes[nameMatch[1]] = identity;
      }
    }
  }

  const context: GitContext = { repoRoot: top ? top : null, branch, remotes };
  cache.set(contextDir, context);
  return context;
}

/** Clear the per-contextDir git context cache (test isolation). */
export function __resetGitContextCache(): void {
  cache.clear();
}
