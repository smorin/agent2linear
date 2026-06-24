import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { matchGlob, matchPath } from './glob-match.js';

afterEach(() => vi.unstubAllEnvs());

const REPO = '/work/acme/web';

describe('matchPath — repo-root-anchored relative globs (§5.3 Q3 gate)', () => {
  it('cli/** matches the context dir `cli` itself (** = zero-or-more)', () => {
    expect(matchPath('cli/**', `${REPO}/cli`, REPO)).toBe(true);
  });

  it('cli/** matches under cli at any depth', () => {
    expect(matchPath('cli/**', `${REPO}/cli/sub`, REPO)).toBe(true);
    expect(matchPath('cli/**', `${REPO}/cli/a/b`, REPO)).toBe(true);
  });

  it('cli/** is anchored at the repo root — not any cli/ at any depth', () => {
    expect(matchPath('cli/**', `${REPO}/a/b/cli`, REPO)).toBe(false);
  });

  it('cli/** does not bleed into sibling names', () => {
    expect(matchPath('cli/**', `${REPO}/clix`, REPO)).toBe(false);
    expect(matchPath('cli/**', `${REPO}/cli2/sub`, REPO)).toBe(false);
  });

  it('**/cli/** matches a cli dir at any depth (incl. root level)', () => {
    expect(matchPath('**/cli/**', `${REPO}/a/b/cli`, REPO)).toBe(true);
    expect(matchPath('**/cli/**', `${REPO}/cli`, REPO)).toBe(true);
    expect(matchPath('**/cli/**', `${REPO}/a/b/cli/d`, REPO)).toBe(true);
  });

  it('apps/web/** matches the dir itself and its contents (§6 example)', () => {
    expect(matchPath('apps/web/**', `${REPO}/apps/web`, REPO)).toBe(true);
    expect(matchPath('apps/web/**', `${REPO}/apps/web/src`, REPO)).toBe(true);
    expect(matchPath('apps/web/**', `${REPO}/apps/website`, REPO)).toBe(false);
  });

  it('trailing / is equivalent to /**', () => {
    expect(matchPath('cli/', `${REPO}/cli`, REPO)).toBe(true);
    expect(matchPath('cli/', `${REPO}/cli/sub`, REPO)).toBe(true);
  });

  it('a single * matches exactly one path segment', () => {
    expect(matchPath('*', `${REPO}/cli`, REPO)).toBe(true);
    expect(matchPath('*', `${REPO}/cli/sub`, REPO)).toBe(false);
  });

  it('only ** matches the repo root itself (empty relative path)', () => {
    expect(matchPath('**', REPO, REPO)).toBe(true);
    expect(matchPath('cli/**', REPO, REPO)).toBe(false);
  });
});

describe('matchPath — negation', () => {
  it('a leading ! inverts the match', () => {
    expect(matchPath('!cli/**', `${REPO}/cli`, REPO)).toBe(false);
    expect(matchPath('!cli/**', `${REPO}/apps`, REPO)).toBe(true);
  });
});

describe('matchPath — absolute disk patterns (escape hatch, §5.3)', () => {
  it('a leading / matches the absolute context dir', () => {
    expect(matchPath('/work/acme/web/**', '/work/acme/web/apps', null)).toBe(true);
    expect(matchPath('/work/acme/web/**', '/work/acme/web', null)).toBe(true);
    expect(matchPath('/work/acme/web/**', '/work/acme/other', null)).toBe(false);
  });

  it('a leading ~/ expands to the (canonicalized) $HOME', () => {
    const home = realpathSync(homedir());
    expect(matchPath('~/scratch/**', join(home, 'scratch', 'proj'), null)).toBe(true);
    expect(matchPath('~/scratch/**', join(home, 'other'), null)).toBe(false);
  });

  it('~/ canonicalizes $HOME so it matches even when home traverses a symlink', () => {
    const base = realpathSync(mkdtempSync(join(tmpdir(), 'a2l-home-')));
    mkdirSync(join(base, 'target', 'scratch', 'proj'), { recursive: true });
    const link = join(base, 'homelink');
    symlinkSync(join(base, 'target'), link); // $HOME points through a symlink
    try {
      vi.stubEnv('HOME', link);
      // context dir is the canonical (realpath) location under the symlink target
      expect(matchPath('~/scratch/**', join(base, 'target', 'scratch', 'proj'), null)).toBe(true);
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });

  it('~/ degrades gracefully (no throw) when $HOME cannot be resolved', () => {
    vi.stubEnv('HOME', '/no/such/home-xyz');
    expect(matchPath('~/scratch/**', '/somewhere/scratch/proj', null)).toBe(false);
  });
});

describe('matchPath — edge cases (§9)', () => {
  it('a relative pattern cannot anchor without a repo root', () => {
    expect(matchPath('cli/**', '/somewhere/cli', null)).toBe(false);
  });

  it('throws on an empty/blank pattern (invalid glob → resolver warn+skip)', () => {
    expect(() => matchPath('', REPO, REPO)).toThrow(/invalid glob/);
    expect(() => matchPath('   ', REPO, REPO)).toThrow(/invalid glob/);
  });
});

describe('matchGlob — identity/branch globs (plain, unanchored)', () => {
  it('matches exact and wildcard identity values', () => {
    expect(matchGlob('github.com', 'github.com')).toBe(true);
    expect(matchGlob('github.com', 'gitlab.com')).toBe(false);
    expect(matchGlob('acme', 'acme')).toBe(true);
  });

  it('treats * as one segment and ** as nested for repo/owner', () => {
    expect(matchGlob('acme/*', 'acme/web')).toBe(true);
    expect(matchGlob('acme/*', 'acme/platform/web')).toBe(false);
    expect(matchGlob('acme/**', 'acme/platform/web')).toBe(true);
  });

  it('matches host and branch wildcards', () => {
    expect(matchGlob('*.gitlab.com', 'group.gitlab.com')).toBe(true);
    expect(matchGlob('*.gitlab.com', 'gitlab.com')).toBe(false);
    expect(matchGlob('release/*', 'release/1.2')).toBe(true);
    expect(matchGlob('release/*', 'main')).toBe(false);
  });
});
