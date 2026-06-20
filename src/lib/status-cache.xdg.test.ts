import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveTeamsCache } from './status-cache.js';
import { workspaceCacheKey } from './xdg-paths.js';

let tmp: string;
const origCwd = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-cache-'));
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('status-cache.ts writes to the keyed XDG cache dir', () => {
  it('writes cache.json under $XDG_CACHE_HOME/agent2linear/<key>', () => {
    // chdir into the temp dir BEFORE any cache call: saveTeamsCache triggers the
    // one-time legacy cleanup, which walks from cwd up to $HOME deleting legacy
    // cache files. Starting in tmp (outside $HOME) keeps the test hermetic and
    // prevents it from deleting real cache files in the dev checkout.
    process.chdir(tmp);
    vi.stubEnv('XDG_CACHE_HOME', tmp);
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_testkey');
    saveTeamsCache([
      // minimal shape; timestamp is what the cache layer reads
      { id: 'team_1', name: 'Team', key: 'T', timestamp: Date.now() } as never,
    ]);
    const key = workspaceCacheKey('lin_api_testkey');
    expect(existsSync(join(tmp, 'agent2linear', key, 'cache.json'))).toBe(true);
  });
});
