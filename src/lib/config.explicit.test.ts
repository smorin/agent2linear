import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getConfig,
  readConfigForScope,
  readGlobalConfig,
  readProjectConfig,
} from './config.js';
import { setInvocationContext } from './invocation-context.js';
import { resolveActiveProfile } from './workspace-resolver.js';

describe('explicit config replacement', () => {
  let root: string;
  let xdg: string;
  let repo: string;
  let explicitPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'a2l-config-replacement-'));
    xdg = join(root, 'xdg');
    repo = join(root, 'repo');
    explicitPath = join(root, 'selected.json');
    mkdirSync(join(xdg, 'agent2linear'), { recursive: true });
    mkdirSync(join(repo, '.agent2linear'), { recursive: true });
    vi.stubEnv('XDG_CONFIG_HOME', xdg);
    vi.stubEnv('LINEAR_API_KEY', '');
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');

    writeFileSync(
      join(xdg, 'agent2linear', 'config.json'),
      JSON.stringify({ defaultTeam: 'global-team', defaultProject: 'global-project' }),
      'utf8'
    );
    writeFileSync(
      join(repo, '.agent2linear', 'config.json'),
      JSON.stringify({ defaultTeam: 'project-team', defaultProject: 'project-project' }),
      'utf8'
    );
  });

  afterEach(() => {
    setInvocationContext({});
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it('uses only the explicit file plus its selected profile, with no discovered config leakage', () => {
    const value = {
      defaultProfile: 'selected',
      defaultTeam: 'explicit-team',
      overrides: [{ id: 'only-once', when: {} }],
      profiles: {
        selected: {
          workspace: 'selected-workspace',
          defaultInitiative: 'profile-initiative',
        },
      },
    };
    writeFileSync(explicitPath, JSON.stringify(value), 'utf8');
    setInvocationContext({ contextDir: repo, explicitConfig: { path: explicitPath, value } });

    const config = getConfig();

    expect(config.defaultTeam).toBe('explicit-team');
    expect(config.defaultInitiative).toBe('profile-initiative');
    expect(config.defaultProject).toBeUndefined();
    expect(config.locations.defaultTeam).toEqual({ type: 'explicit', path: explicitPath });
    expect(resolveActiveProfile(repo)).toBe('selected');
    expect(readGlobalConfig()).toMatchObject(value);
    expect(readProjectConfig(repo)).toEqual({});
    expect(readConfigForScope('global')).toMatchObject(value);
    expect(readConfigForScope('project')).toEqual({});
  });

  it('keeps environment values above the explicit config', () => {
    const value = { apiKey: 'file-key', defaultTeam: 'explicit-team' };
    vi.stubEnv('LINEAR_API_KEY', 'environment-key');
    writeFileSync(explicitPath, JSON.stringify(value), 'utf8');
    setInvocationContext({ contextDir: repo, explicitConfig: { path: explicitPath, value } });

    const config = getConfig();

    expect(config.apiKey).toBe('environment-key');
    expect(config.locations.apiKey).toEqual({ type: 'env' });
  });
});
