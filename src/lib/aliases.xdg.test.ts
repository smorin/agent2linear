import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { addAlias, getGlobalAliasesPath } from './aliases.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-alias-'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('aliases.ts global path honors XDG', () => {
  it('writes global aliases under $XDG_CONFIG_HOME', async () => {
    vi.stubEnv('XDG_CONFIG_HOME', tmp);
    const expected = join(tmp, 'agent2linear', 'aliases.json');
    // Assert the resolved path BEFORE any write. At RED (pre-migration) this
    // assertion fails and aborts the test before addAlias() could write to the
    // user's real ~/.config/agent2linear/aliases.json (the unmigrated global path
    // is an absolute module-level constant that env stubbing cannot redirect).
    expect(getGlobalAliasesPath()).toBe(expected);
    const res = await addAlias('team', 'backend', 'team_123', 'global', { skipValidation: true });
    expect(res.success).toBe(true);
    expect(existsSync(expected)).toBe(true);
  });
});
