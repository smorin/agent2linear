/**
 * Path glob matching for context-aware config overrides (M29 §5.3).
 *
 * Phase 1 ships the `path` matcher only. It implements gitignore's wildcard
 * *tokens* (`*` = one segment, `**` = zero-or-more segments, trailing `/` ≡ `/**`,
 * leading `!` = negation) but NOT gitignore's match-at-any-depth default: a
 * relative pattern is anchored at the repo root (matched against
 * `relative(repoRoot, contextDir)`), and a leading `~/` or `/` switches to an
 * absolute disk match.
 *
 * Why picomatch and not the `ignore` library (Q3 gate, §5.3): `ignore` follows
 * gitignore "contents-only" semantics, so `cli/**` does NOT match the directory
 * `cli` itself — failing 5/11 §5.3 gate cases. We need `**` to be zero-or-more
 * (so `cli/**` matches `cli`, per §6 "apps/web/** matches apps/web/src"), so we
 * use picomatch with a small anchoring transform instead.
 */

import { homedir } from 'os';
import { relative } from 'path';
import picomatch from 'picomatch';

const PICOMATCH_OPTS = { dot: true, strictSlashes: false } as const;

/** Normalize OS path separators to POSIX so globs match consistently. */
function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Apply the trailing-slash convention: `foo/` ≡ `foo/**`. Returns the pattern
 * picomatch should compile.
 */
function normalizePattern(pattern: string): string {
  return pattern.endsWith('/') ? `${pattern}**` : pattern;
}

/**
 * Compile a (already absolute or repo-relative) pattern into a matcher. A pattern
 * ending in `/**` also matches its own base directory, so `cli/**` matches `cli`
 * itself (the `**` = zero-or-more-segments contract, §5.3/§6).
 */
function compile(pattern: string): (value: string) => boolean {
  const p = normalizePattern(pattern);
  if (p.endsWith('/**')) {
    const base = p.slice(0, -3);
    const matchBase = picomatch(base, PICOMATCH_OPTS);
    const matchFull = picomatch(p, PICOMATCH_OPTS);
    return (value) => matchBase(value) || matchFull(value);
  }
  const match = picomatch(p, PICOMATCH_OPTS);
  return (value) => match(value);
}

/**
 * Does `pattern` match the resolution-context directory?
 *
 * - A leading `!` inverts the result (the only coherent single-pattern reading of
 *   gitignore's negation token).
 * - A leading `~/` or `/` is an absolute disk match against `contextDir`.
 * - Any other pattern is repo-root-anchored: matched against
 *   `relative(repoRoot, contextDir)`. When `repoRoot` is null (no repo / no
 *   `.agent2linear/`), a relative pattern cannot anchor and never matches (§9).
 *
 * Throws on an empty/blank pattern (an invalid glob); the resolver turns that into
 * a warn-and-skip (M29 §9).
 */
export function matchPath(pattern: string, contextDir: string, repoRoot: string | null): boolean {
  if (pattern.startsWith('!')) {
    return !matchPath(pattern.slice(1), contextDir, repoRoot);
  }
  if (pattern.trim() === '') {
    throw new Error(`invalid glob: empty path pattern`);
  }

  // Absolute disk match (escape hatch, §5.3): leading ~/ expands to $HOME.
  if (pattern.startsWith('/') || pattern.startsWith('~/')) {
    const expanded = pattern.startsWith('~/') ? `${homedir()}${pattern.slice(1)}` : pattern;
    return compile(toPosix(expanded))(toPosix(contextDir));
  }

  // Relative pattern: anchor at the repo root.
  if (repoRoot === null) {
    return false;
  }
  const rel = toPosix(relative(repoRoot, contextDir));
  if (rel === '') {
    // The context dir IS the repo root: only `**` (zero-or-more from root) matches.
    return normalizePattern(pattern) === '**';
  }
  return compile(pattern)(rel);
}
