import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitRemoteCache } from './git-remote.js';
import { setInvocationContext } from './invocation-context.js';
import {
  normalizeEnvVarName,
  resolveActiveProfile,
  resolveActiveWorkspace,
  resolveWorkspaceKey,
} from './workspace-resolver.js';
import { saveWorkspace } from './workspaces.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-wsr-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-wsr-cwd-'));
  // Hermetic: empty XDG config (no global workspaces.json / config.json) and an
  // empty cwd so no project config is discovered by the walk-up.
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  // Control the legacy key explicitly so an ambient shell value can't flip the
  // legacy<->env branch.
  vi.stubEnv('LINEAR_API_KEY', '');
  // Neutralize the env declarator so an ambient value can't change selection.
  vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
  process.chdir(workdir);
  setInvocationContext({});
  // The current parser's single-slot origin-URL cache (git-remote.ts:59). The
  // real-repo guard block below shells out to git, so a leaky cache would make it
  // falsely green. Harmless to the hermetic blocks (they never populate it).
  // (Phase 2 swaps this to __resetGitContextCache().)
  __resetGitRemoteCache();
});

afterEach(() => {
  process.chdir(origCwd);
  setInvocationContext({});
  __resetGitRemoteCache();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('resolveActiveWorkspace - zero-config legacy passthrough (R4)', () => {
  it('returns the env LINEAR_API_KEY with source "env" when set', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    const res = resolveActiveWorkspace();
    expect(res.key).toBe('lin_api_envkey');
    expect(res.source).toBe('env');
    expect(res.name).toBeUndefined();
  });

  it('returns the config-file apiKey with source "legacy" when no env key is set', () => {
    // Write a global config apiKey under the stubbed XDG dir.
    saveGlobalApiKey(xdgConfig, 'lin_api_configkey');
    const res = resolveActiveWorkspace();
    expect(res.key).toBe('lin_api_configkey');
    expect(res.source).toBe('legacy');
    expect(res.name).toBeUndefined();
  });

  it('env LINEAR_API_KEY wins over config-file apiKey', () => {
    saveGlobalApiKey(xdgConfig, 'lin_api_configkey');
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    const res = resolveActiveWorkspace();
    expect(res.key).toBe('lin_api_envkey');
    expect(res.source).toBe('env');
  });

  it('returns an empty legacy resolution when no key is available anywhere', () => {
    const res = resolveActiveWorkspace();
    expect(res.key).toBe('');
    expect(res.source).toBe('legacy');
  });
});

describe('resolveActiveWorkspace - explicit selection (flag)', () => {
  it('bare --api-key is an ad-hoc workspace: source flag, no name', () => {
    setInvocationContext({ apiKey: 'lin_api_adhoc' });
    const res = resolveActiveWorkspace();
    expect(res.key).toBe('lin_api_adhoc');
    expect(res.source).toBe('flag');
    expect(res.name).toBeUndefined();
  });

  it('--workspace selects a named workspace from the secrets registry with source flag', () => {
    saveWorkspace('global', 'acme', { apiKey: 'lin_api_acme' });
    setInvocationContext({ workspace: 'acme' });
    const res = resolveActiveWorkspace();
    expect(res.name).toBe('acme');
    expect(res.key).toBe('lin_api_acme');
    expect(res.source).toBe('flag');
  });

  it('explicit selection overrides an ambient legacy env key', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    saveWorkspace('global', 'acme', { apiKey: 'lin_api_acme' });
    setInvocationContext({ workspace: 'acme' });
    const res = resolveActiveWorkspace();
    expect(res.key).toBe('lin_api_acme');
    expect(res.source).toBe('flag');
  });
});

describe('resolveWorkspaceKey - ordered key-source precedence (cli -> secrets -> legacy)', () => {
  it('cli --api-key wins over the secrets registry', () => {
    saveWorkspace('global', 'acme', { apiKey: 'lin_api_acme' });
    setInvocationContext({ apiKey: 'lin_api_cli', workspace: 'acme' });
    const res = resolveWorkspaceKey('acme');
    expect(res.key).toBe('lin_api_cli');
  });

  it('secrets registry wins over the legacy plain key', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    saveWorkspace('global', 'acme', { apiKey: 'lin_api_acme' });
    setInvocationContext({ workspace: 'acme' });
    const res = resolveWorkspaceKey('acme');
    expect(res.key).toBe('lin_api_acme');
  });

  it('falls back to the legacy key when the named workspace is unknown', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    setInvocationContext({ workspace: 'unknown' });
    const res = resolveWorkspaceKey('unknown');
    expect(res.key).toBe('lin_api_envkey');
    expect(res.source).toBe('env');
  });

  it('undefined name with zero config returns the legacy key', () => {
    saveGlobalApiKey(xdgConfig, 'lin_api_configkey');
    const res = resolveWorkspaceKey(undefined);
    expect(res.key).toBe('lin_api_configkey');
    expect(res.source).toBe('legacy');
  });
});

describe('resolveActiveProfile - selection precedence (R8, Phase 2)', () => {
  it('explicit --workspace beats AGENT2LINEAR_WORKSPACE and defaultProfile', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'personal',
      profiles: { acme: { workspace: 'acme' }, personal: { workspace: 'personal' } },
    });
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', 'acme');
    setInvocationContext({ workspace: 'personal' });

    expect(resolveActiveProfile()).toBe('personal');
    expect(resolveActiveWorkspace().source).toBe('flag');
  });

  it('AGENT2LINEAR_WORKSPACE beats defaultProfile', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'personal',
      profiles: { acme: { workspace: 'acme' }, personal: { workspace: 'personal' } },
    });
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', 'acme');

    expect(resolveActiveProfile()).toBe('acme');
    expect(resolveActiveWorkspace().source).toBe('env');
  });

  it('project-config profile beats defaultProfile', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'personal',
      profiles: { acme: { workspace: 'acme' }, personal: { workspace: 'personal' } },
    });
    writeProjectConfigJson(workdir, { profile: 'acme' });

    expect(resolveActiveProfile()).toBe('acme');
    expect(resolveActiveWorkspace().source).toBe('project');
  });

  it('falls back to defaultProfile when nothing else selects', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'acme' } },
    });

    expect(resolveActiveProfile()).toBe('acme');
    expect(resolveActiveWorkspace().source).toBe('default');
  });

  it('returns undefined (no profile) for the legacy path', () => {
    expect(resolveActiveProfile()).toBeUndefined();
  });

  it('sources the key from the profile-pointed workspace in the secrets registry', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'acme-ws' } },
    });
    saveWorkspace('global', 'acme-ws', { apiKey: 'lin_api_acme_ws' });

    const res = resolveActiveWorkspace();
    expect(res.profile).toBe('acme');
    expect(res.name).toBe('acme-ws');
    expect(res.key).toBe('lin_api_acme_ws');
    expect(res.source).toBe('default');
  });
});

describe('resolveActiveWorkspace - no-match gate + exclusion (R9, Phase 3)', () => {
  // All cases use profiles WITHOUT match rules, so detectProfile short-circuits
  // and never shells out to git — the gate is exercised hermetically.

  it('deny (default) with >=2 profiles and nothing matched -> denied', () => {
    writeGlobalConfigJson(xdgConfig, {
      profiles: { acme: { workspace: 'acme' }, beta: { workspace: 'beta' } },
    });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeDefined();
    expect(res.key).toBe('');
    // getConfig() must still work in a denied repo: no profile scope.
    expect(resolveActiveProfile()).toBeUndefined();
  });

  it('deny with a single profile does NOT deny (uses defaultProfile)', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'acme' } },
    });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.name).toBe('acme');
    expect(res.source).toBe('default');
  });

  it('default policy falls back to defaultProfile even with >=2 profiles', () => {
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'default',
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'acme' }, beta: { workspace: 'beta' } },
    });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.profile).toBe('acme');
    expect(res.source).toBe('default');
  });

  it('match-only denies even with a single profile + defaultProfile', () => {
    writeGlobalConfigJson(xdgConfig, {
      noMatchPolicy: 'match-only',
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'acme' } },
    });
    expect(resolveActiveWorkspace().denied).toBeDefined();
  });

  it('repo linear:false denies', () => {
    writeProjectConfigJson(workdir, { linear: false });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeDefined();
    expect(res.denied?.reason).toMatch(/excluded/i);
  });

  it('an excluded profile selected via project config denies', () => {
    writeGlobalConfigJson(xdgConfig, { profiles: { acme: { workspace: 'acme', linear: false } } });
    writeProjectConfigJson(workdir, { profile: 'acme' });
    expect(resolveActiveWorkspace().denied).toBeDefined();
  });

  it('explicit --workspace forces through an excluded profile', () => {
    writeGlobalConfigJson(xdgConfig, { profiles: { acme: { workspace: 'acme', linear: false } } });
    writeProjectConfigJson(workdir, { profile: 'acme' });
    setInvocationContext({ workspace: 'acme' });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.source).toBe('flag');
    expect(res.profile).toBe('acme');
  });

  it('explicit --workspace forces through the no-match gate (deny, >=2 profiles)', () => {
    writeGlobalConfigJson(xdgConfig, {
      profiles: { acme: { workspace: 'acme' }, beta: { workspace: 'beta' } },
    });
    setInvocationContext({ workspace: 'acme' });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.source).toBe('flag');
  });

  it('legacy single-key path never denies (zero profiles)', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('lin_api_envkey');
    expect(res.source).toBe('env');
  });
});

describe('normalizeEnvVarName', () => {
  it('maps a name to LINEAR_API_KEY_<NORMALIZED>', () => {
    expect(normalizeEnvVarName('acme')).toBe('LINEAR_API_KEY_ACME');
    expect(normalizeEnvVarName('acme-co')).toBe('LINEAR_API_KEY_ACME_CO');
    expect(normalizeEnvVarName('Foo.Bar 1')).toBe('LINEAR_API_KEY_FOO_BAR_1');
  });
});

describe('resolveWorkspaceKey - full R7 key-source precedence (Phase 4)', () => {
  it('cli --api-key wins over everything', () => {
    vi.stubEnv('LINEAR_API_KEY_ACME', 'env');
    saveWorkspace('global', 'acme', { apiKey: 'secret' });
    setInvocationContext({ apiKey: 'cli', workspace: 'acme' });
    expect(resolveWorkspaceKey('acme').key).toBe('cli');
  });

  it('named env var (default LINEAR_API_KEY_<NAME>) beats env-file/secrets/legacy', () => {
    vi.stubEnv('LINEAR_API_KEY_ACME', 'envkey');
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    saveWorkspace('global', 'acme', { apiKey: 'secret' });
    const res = resolveWorkspaceKey('acme');
    expect(res.key).toBe('envkey');
    expect(res.source).toBe('env');
  });

  it('honors the apiKeyEnv override instead of the default var name', () => {
    vi.stubEnv('MY_KEY', 'overridden');
    vi.stubEnv('LINEAR_API_KEY_ACME', 'default-var');
    const res = resolveWorkspaceKey('acme', { apiKeyEnv: 'MY_KEY' });
    expect(res.key).toBe('overridden');
    expect(res.source).toBe('env');
  });

  it('falls to the env-file when the named env var is unset', () => {
    const envFile = join(workdir, 'acme.env');
    writeFileSync(envFile, 'LINEAR_API_KEY_ACME=fromfile\n', 'utf-8');
    saveWorkspace('global', 'acme', { apiKey: 'secret' });
    const res = resolveWorkspaceKey('acme', { envFile });
    expect(res.key).toBe('fromfile');
    expect(res.source).toBe('env-file');
  });

  it('falls to the secrets registry when no env var / env-file provides the key', () => {
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    saveWorkspace('global', 'acme', { apiKey: 'secret' });
    const res = resolveWorkspaceKey('acme');
    expect(res.key).toBe('secret');
    expect(res.viaLegacy).toBeFalsy();
  });

  it('falls to the legacy plain key last, tagged viaLegacy', () => {
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    const res = resolveWorkspaceKey('acme');
    expect(res.key).toBe('plain');
    expect(res.source).toBe('env');
    expect(res.viaLegacy).toBe(true);
  });
});

describe('resolveActiveWorkspace - ambiguity guard (R7 Scheme-D Option 2)', () => {
  it('FIRES: non-explicit named workspace falls back to plain key with >=2 workspaces', () => {
    writeGlobalConfigJson(xdgConfig, {
      profiles: { acme: { workspace: 'wsAcme' }, beta: { workspace: 'wsBeta' } },
    });
    // AGENT2LINEAR_WORKSPACE names the workspace (so it bypasses the no-match gate)
    // but is NOT the explicit --flag, so the ambiguity guard still applies.
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', 'acme');
    vi.stubEnv('LINEAR_API_KEY', 'plain'); // no LINEAR_API_KEY_WSACME, no secrets
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeDefined();
    expect(res.denied?.reason).toMatch(/ambiguous/i);
  });

  it('SILENT when the workspace was chosen explicitly (--workspace forces through)', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'wsAcme' }, beta: { workspace: 'wsBeta' } },
    });
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    setInvocationContext({ workspace: 'acme' });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('plain');
  });

  it('SILENT for the "plain = default" single-workspace setup', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'wsAcme' } },
    });
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('plain');
  });

  it('SILENT when the named env var supplies the key (not a legacy fallback)', () => {
    writeGlobalConfigJson(xdgConfig, {
      profiles: { acme: { workspace: 'wsAcme' }, beta: { workspace: 'wsBeta' } },
    });
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', 'acme');
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    vi.stubEnv('LINEAR_API_KEY_WSACME', 'named');
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('named');
  });
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

/** Helper: write a global config.json apiKey under a stubbed XDG config dir. */
function saveGlobalApiKey(xdgDir: string, apiKey: string): void {
  const dir = join(xdgDir, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ apiKey }), 'utf-8');
}

/** Helper: write a full global config.json under a stubbed XDG config dir. */
function writeGlobalConfigJson(xdgDir: string, config: Record<string, unknown>): void {
  const dir = join(xdgDir, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
}

/** Helper: write a project config.json under <cwd>/.agent2linear. */
function writeProjectConfigJson(cwd: string, config: Record<string, unknown>): void {
  const dir = join(cwd, '.agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
}
