import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getGlobalConfigPath, setConfigValue } from './config.js';

let tmp: string;
const origCwd = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-cfg-'));
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('config.ts global path honors XDG', () => {
  it('writes global config under $XDG_CONFIG_HOME', () => {
    vi.stubEnv('XDG_CONFIG_HOME', tmp);
    setConfigValue('defaultTeam', 'team_123', 'global');
    const expected = join(tmp, 'agent2linear', 'config.json');
    expect(getGlobalConfigPath()).toBe(expected);
    expect(existsSync(expected)).toBe(true);
    expect(JSON.parse(readFileSync(expected, 'utf-8')).defaultTeam).toBe('team_123');
  });
});

describe('config.ts project path uses cwd when no ancestor is found', () => {
  it('writes project config to <cwd>/.agent2linear', () => {
    process.chdir(tmp);
    setConfigValue('defaultTeam', 'team_p', 'project');
    expect(existsSync(join(tmp, '.agent2linear', 'config.json'))).toBe(true);
  });
});
