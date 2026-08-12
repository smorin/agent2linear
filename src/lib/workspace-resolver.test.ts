import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from './git-context.js';
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
  // The shared parser's per-contextDir git-context cache (git-context.ts). Detection
  // now flows through this Map cache (M31 Phase 2), and the real-repo guard block
  // below shells out to git, so a leaky cache would make it falsely green. Harmless
  // to the hermetic blocks (they never populate it).
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
  it('bare --api-key-file is an ad-hoc workspace: source flag, no name', () => {
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

  it('--api-key-file may override a selected workspace credential without dropping its identity', () => {
    saveWorkspace('global', 'acme', { apiKey: 'lin_api_stored' });
    setInvocationContext({ workspace: 'acme', apiKey: 'lin_api_file' });

    const res = resolveActiveWorkspace();

    expect(res.name).toBe('acme');
    expect(res.key).toBe('lin_api_file');
    expect(res.source).toBe('flag');
  });
});

describe('resolveWorkspaceKey - ordered key-source precedence (cli -> secrets -> legacy)', () => {
  it('cli --api-key-file wins over the secrets registry', () => {
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

  it('does not let plain LINEAR_API_KEY authenticate an unknown named workspace', () => {
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_envkey');
    setInvocationContext({ workspace: 'unknown' });
    const res = resolveWorkspaceKey('unknown');
    expect(res.key).toBe('');
    expect(res.source).toBe('legacy');
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
  it('cli --api-key-file wins over everything', () => {
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
  });

  it('does not fall to the legacy plain key for a named workspace', () => {
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    const res = resolveWorkspaceKey('acme');
    expect(res.key).toBe('');
    expect(res.source).toBe('legacy');
  });
});

describe('resolveActiveWorkspace - named workspaces never borrow unnamed credentials', () => {
  it('does not use a plain key for an environment-selected workspace', () => {
    writeGlobalConfigJson(xdgConfig, {
      profiles: { acme: { workspace: 'wsAcme' }, beta: { workspace: 'wsBeta' } },
    });
    // AGENT2LINEAR_WORKSPACE names the workspace (so it bypasses the no-match gate)
    // but is NOT the explicit --flag, so the ambiguity guard still applies.
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', 'acme');
    vi.stubEnv('LINEAR_API_KEY', 'plain'); // no LINEAR_API_KEY_WSACME, no secrets
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('');
  });

  it('does not use a plain key when the workspace was chosen explicitly', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'wsAcme' }, beta: { workspace: 'wsBeta' } },
    });
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    setInvocationContext({ workspace: 'acme' });
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('');
  });

  it('does not use a plain key for a default single-workspace setup', () => {
    writeGlobalConfigJson(xdgConfig, {
      defaultProfile: 'acme',
      profiles: { acme: { workspace: 'wsAcme' } },
    });
    vi.stubEnv('LINEAR_API_KEY', 'plain');
    const res = resolveActiveWorkspace();
    expect(res.denied).toBeUndefined();
    expect(res.key).toBe('');
  });

  it('still uses the selected workspace named environment variable', () => {
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
