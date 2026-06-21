import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setInvocationContext } from './invocation-context.js';
import {
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
});

afterEach(() => {
  process.chdir(origCwd);
  setInvocationContext({});
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
