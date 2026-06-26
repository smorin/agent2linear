/**
 * Git-derived resolution context for config overrides (M29 §5.4).
 *
 * Resolves a directory's repo root, current branch, and ALL remotes (normalized to
 * `{host, owner, name}`) so identity (`repo`/`owner`/`host`) and `branch` matchers
 * can be evaluated. `run` is injectable (the `profiles.ts` provider pattern) so unit
 * tests stay offline; results are cached per contextDir for the process.
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

/**
 * Normalize a user-supplied `--git-remote-owner` value to an owner glob.
 *
 * Accepts BOTH forms for resilience: a full repo URL (SSH/HTTPS/scp) has its owner
 * extracted via `normalizeRemoteUrl`, and an owner PATTERN is returned as-is. Owner
 * patterns may be a bare owner, a NESTED group (`group/sub`, all-but-last), or a glob
 * (`acme-*`, `group/*`, `my-org/secret-*`) — all identity fields accept globs (M31),
 * and detection glob-matches the owner, so the CLI must store them. Returns null only
 * for genuinely malformed input — empty/whitespace, or a token carrying URL/host
 * separators (`:` / `@` / internal whitespace, e.g. a URL-like string with no owner) —
 * so the caller can error instead of silently storing a value that can never match.
 */
export function normalizeOwnerInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = normalizeRemoteUrl(trimmed);
  if (parsed) {
    return parsed.owner;
  }
  // Accept owner globs + nested-group owners (`/` and glob metacharacters), but reject
  // whitespace and URL/host separators (`:` / `@`) so a malformed paste still errors.
  if (/^[A-Za-z0-9._/*?,!{}[\]-]+$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Resolve the remote(s) a rule's identity reads (M31 Phase 3): `undefined`→`origin`,
 * a name → that remote, a list → those remotes, `'*'`→all. Shared by the M29/M30
 * override lineage (`overrides.ts`) and the profile lineage (`profiles.ts`) so both
 * use ONE remote-selection primitive. Pure over `Record<string, RemoteIdentity>` —
 * deliberately free of any `types.ts` coupling so neither lineage forms an import
 * cycle through this module.
 */
export function selectRemotes(
  spec: '*' | string | string[] | undefined,
  remotes: Record<string, RemoteIdentity>
): Array<{ name: string; identity: RemoteIdentity }> {
  const all = Object.entries(remotes).map(([name, identity]) => ({ name, identity }));
  if (spec === undefined) {
    return all.filter((r) => r.name === 'origin');
  }
  if (spec === '*') {
    return all;
  }
  const names = Array.isArray(spec) ? spec : [spec];
  return all.filter((r) => names.includes(r.name));
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
