import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from './git-context.js';
import { setInvocationContext } from './invocation-context.js';
import { resolveActiveWorkspace } from './workspace-resolver.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-wsr-git-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-wsr-git-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  vi.stubEnv('LINEAR_API_KEY', '');
  vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
  process.chdir(workdir);
  setInvocationContext({});
  __resetGitContextCache();
});

afterEach(() => {
  process.chdir(origCwd);
  setInvocationContext({});
  __resetGitContextCache();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('resolveActiveWorkspace - owner-only + match-only regression guard (M31 §8a)', () => {
  // Characterization guard (Phase 1): pins the EXACT driving use case — two
  // match-ful profiles + an unrelated owner that must error — end-to-end through
  // the public resolveActiveWorkspace(), BEFORE any unification refactor. Unlike
  // the hermetic no-match-gate block above (match-less profiles, git short-
  // circuits), these tests build a REAL temp git repo with a controlled `origin`
  // owner and let detection shell out, so the refactor in Phase 2 must keep this
  // green. NO production code is touched in Phase 1.
  //
  // The repo is built directly in the already-chdir'd `workdir` (the global
  // beforeEach chdir's into a fresh temp dir; the global afterEach restores cwd
  // and removes it — that restore is the chdir-leak guard for the rest of the
  // suite). resolveActiveWorkspace() takes no args and reads process.cwd(), so a
  // real repo at cwd is the faithful equivalent of git-context.test.ts's
  // explicit-dir fixture.
  //
  // Deliberately NO nested-group owner case here — Phase 2 introduces `group/sub`
  // as the new expected result (D2); pinning the old `group` behavior now would
  // fight that change.

  // Build a real git repo at cwd (the chdir'd workdir) whose `origin` owner is
  // taken from <ownerUrl>. Sets a local git identity so --allow-empty commits
  // succeed without a global git config.
  const buildRepoWithOrigin = (originUrl: string): void => {
    const runGit = (args: string[]): void => {
      execFileSync('git', ['-C', workdir, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
    };
    runGit(['init', '-q', '-b', 'main']);
    runGit(['config', 'user.email', 't@t.co']);
    runGit(['config', 'user.name', 't']);
    runGit(['remote', 'add', 'origin', originUrl]);
    runGit(['commit', '-q', '--allow-empty', '-m', 'init']);
  };

  // The two driving profiles (§8a): `acme` matches org `acme-co`; `personal`
  // matches EITHER user `alice` or `bob` (OR within one profile).
  const acme = { workspace: 'acme-ws', match: { gitRemoteOwner: ['acme-co'] } };
  const personal = { workspace: 'personal-ws', match: { gitRemoteOwner: ['alice', 'bob'] } };

  it('1: origin owner acme-co + match-only resolves acme via auto-detect (not denied)', () => {
    writeGlobalConfigJson(xdgConfig, { noMatchPolicy: 'match-only', profiles: { acme, personal } });
    buildRepoWithOrigin('https://github.com/acme-co/widgets.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('acme');
    expect(res.name).toBe('acme-ws');
    expect(res.source).toBe('auto-detect');
  });

  it('2: origin owner alice resolves personal', () => {
    writeGlobalConfigJson(xdgConfig, { profiles: { acme, personal } });
    buildRepoWithOrigin('git@github.com:alice/dotfiles.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('personal');
    expect(res.source).toBe('auto-detect');
  });

  it('3: origin owner bob resolves personal (OR within a profile)', () => {
    writeGlobalConfigJson(xdgConfig, { profiles: { acme, personal } });
    buildRepoWithOrigin('git@github.com:bob/scripts.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('personal');
    expect(res.source).toBe('auto-detect');
  });

  it('4: unrelated owner + match-only + defaultProfile set => denied, no fallback', () => {
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'match-only',
      defaultProfile: 'acme',
      profiles: { acme, personal },
    });
    buildRepoWithOrigin('https://github.com/unrelated-org/thing.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeDefined();
    expect(res.denied?.reason).toMatch(/match-only/i);
    // The defaultProfile is NEVER consulted — match-only denies at the gate first.
    expect(res.profile).toBeUndefined();
    expect(res.name).toBeUndefined();
  });

  it('5: uppercase origin owner ACME-CO resolves acme (case-insensitive matching)', () => {
    writeGlobalConfigJson(xdgConfig, { noMatchPolicy: 'match-only', profiles: { acme, personal } });
    buildRepoWithOrigin('https://github.com/ACME-CO/widgets.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('acme');
    expect(res.source).toBe('auto-detect');
  });

  it('6: deny + two match-ful profiles + unrelated owner => denied; explicit --workspace forces through', () => {
    writeGlobalConfigJson(xdgConfig, { profiles: { acme, personal } });
    buildRepoWithOrigin('https://github.com/unrelated-org/thing.git');

    // Default policy is `deny`; with >=2 profiles and no match, the gate denies.
    const denied = resolveActiveWorkspace();
    expect(denied.denied).toBeDefined();

    // An explicit --workspace forces through the no-match gate.
    setInvocationContext({ workspace: 'acme-ws' });
    const forced = resolveActiveWorkspace();
    expect(forced.denied).toBeUndefined();
    expect(forced.source).toBe('flag');
  });
});

describe('resolveActiveWorkspace - host/repo/remote matching via config (M31 Phase 3)', () => {
  // End-to-end through the public resolveActiveWorkspace() against a REAL temp git
  // repo, proving the new MatchRule fields (host/repo/remote/case) flow through
  // resolution from a HAND-AUTHORED config — no CLI yet (config.json is a
  // first-class input surface). The repo is built in the chdir'd `workdir`; the
  // global afterEach restores cwd and removes it.

  // Build a real git repo at cwd with an `origin` and an optional `upstream`,
  // mirroring tests/scripts' git_repo() helper. Sets a local identity so
  // --allow-empty commits succeed without a global git config.
  const buildRepo = (originUrl: string, upstreamUrl?: string): void => {
    const runGit = (args: string[]): void => {
      execFileSync('git', ['-C', workdir, ...args], { stdio: ['ignore', 'ignore', 'ignore'] });
    };
    runGit(['init', '-q', '-b', 'main']);
    runGit(['config', 'user.email', 't@t.co']);
    runGit(['config', 'user.name', 't']);
    runGit(['remote', 'add', 'origin', originUrl]);
    if (upstreamUrl) {
      runGit(['remote', 'add', 'upstream', upstreamUrl]);
    }
    runGit(['commit', '-q', '--allow-empty', '-m', 'init']);
  };

  it('routes by a HOST-only rule', () => {
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'match-only',
      profiles: { gh: { workspace: 'gh-ws', match: { gitRemoteHost: ['github.com'] } } },
    });
    buildRepo('https://github.com/whoever/whatever.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('gh');
    expect(res.name).toBe('gh-ws');
    expect(res.source).toBe('auto-detect');
  });

  it('routes by a REPO glob (my-org/secret-*)', () => {
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'match-only',
      profiles: {
        secret: { workspace: 'secret-ws', match: { gitRemoteRepo: ['my-org/secret-*'] } },
      },
    });
    buildRepo('git@github.com:my-org/secret-keys.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('secret');
    expect(res.source).toBe('auto-detect');
  });

  it('routes by AND(host + owner + repo) when all three match', () => {
    const profiles = {
      acme: {
        workspace: 'acme-ws',
        match: {
          gitRemoteHost: ['github.com'],
          gitRemoteOwner: ['acme-co'],
          gitRemoteRepo: ['acme-co/widgets'],
        },
      },
    };
    writeGlobalConfigJson(xdgConfig, { noMatchPolicy: 'match-only', profiles });
    buildRepo('https://github.com/acme-co/widgets.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('acme');
    expect(res.name).toBe('acme-ws');
  });

  it('fork case: a remote:"upstream" + owner rule wins over a personal origin rule (declared first)', () => {
    // origin = personal fork (alice), upstream = the org (acme). Declared so the
    // upstream rule comes first -> first-positive-wins picks it for the fork.
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'match-only',
      profiles: {
        acme: { workspace: 'acme-ws', match: { remote: 'upstream', gitRemoteOwner: ['acme'] } },
        personal: { workspace: 'personal-ws', match: { gitRemoteOwner: ['alice'] } },
      },
    });
    buildRepo('git@github.com:alice/widgets.git', 'git@github.com:acme/widgets.git');

    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('acme');
    expect(res.name).toBe('acme-ws');
    expect(res.source).toBe('auto-detect');
  });

  it('bare remote:"upstream" matches a fork but NOT a repo with only an origin', () => {
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'match-only',
      profiles: { isFork: { workspace: 'fork-ws', match: { remote: 'upstream' } } },
    });
    buildRepo('git@github.com:alice/widgets.git', 'git@github.com:acme/widgets.git');
    expect(resolveActiveWorkspace().profile).toBe('isFork');

    // A non-fork (origin only) does not match -> match-only denies.
    __resetGitContextCache();
    execFileSync('git', ['-C', workdir, 'remote', 'remove', 'upstream'], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    expect(resolveActiveWorkspace().denied).toBeDefined();
  });
});

/** Write a full global config.json under the stubbed XDG config directory. */
function writeGlobalConfigJson(xdgDir: string, config: Record<string, unknown>): void {
  const dir = join(xdgDir, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
}
