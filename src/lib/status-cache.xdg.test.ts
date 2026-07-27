import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withCacheWritesSuppressed } from './cache-write-policy.js';
import { resetInvocationContext, setInvocationContext } from './invocation-context.js';
import { saveTeamsCache } from './status-cache.js';
import { workspaceCacheKey } from './xdg-paths.js';

let tmp: string;
const origCwd = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-cache-'));
  // Keep this cache-path test independent of the developer's configured
  // workspace profiles and repository match rules.
  setInvocationContext({ apiKey: 'lin_api_testkey' });
});

afterEach(() => {
  process.chdir(origCwd);
  resetInvocationContext();
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

  it('[RLS-SAFE-DRYRUN] does not write cache state while writes are suppressed', async () => {
    process.chdir(tmp);
    vi.stubEnv('XDG_CACHE_HOME', tmp);
    vi.stubEnv('LINEAR_API_KEY', 'lin_api_testkey');

    await withCacheWritesSuppressed(true, async () => {
      saveTeamsCache([{ id: 'team_1', name: 'Team', key: 'T', timestamp: Date.now() } as never]);
    });

    const key = workspaceCacheKey('lin_api_testkey');
    expect(existsSync(join(tmp, 'agent2linear', key, 'cache.json'))).toBe(false);
  });
});
