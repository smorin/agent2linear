import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getProfileScope, loadProfiles } from './profiles.js';
import type { Config, Profile } from './types.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-prof-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-prof-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  process.chdir(workdir);
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

/** Write a global config.json (under the stubbed XDG dir). */
function writeGlobalConfig(config: Partial<Config>): void {
  const dir = join(xdgConfig, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
}

/** Write a project config.json (under <cwd>/.agent2linear). */
function writeProjectConfig(config: Partial<Config>): void {
  const dir = join(workdir, '.agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config), 'utf-8');
}

describe('loadProfiles - global + project merge', () => {
  it('returns {} when no profiles are configured', () => {
    expect(loadProfiles()).toEqual({});
  });

  it('merges global and project profiles, project overriding global by name', () => {
    writeGlobalConfig({
      profiles: {
        acme: { workspace: 'acme', defaultTeam: 'global-team' } as Profile,
        personal: { workspace: 'personal' } as Profile,
      },
    });
    writeProjectConfig({
      profiles: {
        acme: { workspace: 'acme', defaultTeam: 'project-team' } as Profile,
      },
    });

    const profiles = loadProfiles();
    expect(Object.keys(profiles).sort()).toEqual(['acme', 'personal']);
    // project's acme overrides global's acme
    expect(profiles.acme.defaultTeam).toBe('project-team');
    // global-only profile survives
    expect(profiles.personal.workspace).toBe('personal');
  });
});

describe('getProfileScope - strips non-config meta keys', () => {
  it('returns {} for an undefined name (byte-identical invariant)', () => {
    expect(getProfileScope(undefined)).toEqual({});
  });

  it('returns {} for an unknown profile name', () => {
    writeGlobalConfig({ profiles: { acme: { workspace: 'acme' } as Profile } });
    expect(getProfileScope('nonexistent')).toEqual({});
  });

  it('strips workspace/match/linear/apiKeyEnv/envFile, keeps config defaults', () => {
    writeGlobalConfig({
      profiles: {
        acme: {
          workspace: 'acme',
          match: { gitRemoteOwner: ['acme-co'] },
          linear: true,
          apiKeyEnv: 'MY_KEY',
          envFile: '~/.secrets/acme.env',
          defaultTeam: 'backend',
          defaultInitiative: 'q3',
        } as Profile,
      },
    });

    const scope = getProfileScope('acme');
    expect(scope).toEqual({ defaultTeam: 'backend', defaultInitiative: 'q3' });
    // meta keys removed
    expect('workspace' in scope).toBe(false);
    expect('match' in scope).toBe(false);
    expect('linear' in scope).toBe(false);
    expect('apiKeyEnv' in scope).toBe(false);
    expect('envFile' in scope).toBe(false);
  });

  it('never leaks a raw apiKey (or nested profiles/profile) from a hand-edited config', () => {
    writeGlobalConfig({
      profiles: {
        // A config.json could carry these even though the Profile type forbids them.
        acme: {
          apiKey: 'lin_api_committed_secret',
          profile: 'other',
          profiles: { nested: {} },
          defaultTeam: 'backend',
        } as unknown as Profile,
      },
    });

    const scope = getProfileScope('acme');
    expect(scope).toEqual({ defaultTeam: 'backend' });
    expect('apiKey' in scope).toBe(false);
    expect('profiles' in scope).toBe(false);
    expect('profile' in scope).toBe(false);
  });
});
