import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { withCacheWritesSuppressed } from './cache-write-policy.js';
import { resetInvocationContext, setInvocationContext } from './invocation-context.js';
import { findProjectByName } from './linear-client.js';
import { resolveProject } from './project-resolver.js';
import { workspaceCacheKey } from './xdg-paths.js';

vi.mock('./aliases.js', () => ({ resolveAlias: (_type: string, value: string) => value }));
vi.mock('./linear-client.js', () => ({
  findProjectByName: vi.fn(),
  getProjectById: vi.fn(),
}));

let tmp: string;
const originalCwd = process.cwd();

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'a2l-project-cache-'));
  process.chdir(tmp);
  vi.stubEnv('XDG_CACHE_HOME', tmp);
  vi.stubEnv('LINEAR_API_KEY', 'lin_api_testkey');
  setInvocationContext({ apiKey: 'lin_api_testkey' });
  vi.mocked(findProjectByName).mockResolvedValue({
    id: 'project-1',
    name: 'Release',
  } as never);
});

afterEach(() => {
  process.chdir(originalCwd);
  resetInvocationContext();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  rmSync(tmp, { recursive: true, force: true });
});

describe('project resolver cache writes', () => {
  it('[RLS-SAFE-DRYRUN] does not write project-cache.json while writes are suppressed', async () => {
    const result = await withCacheWritesSuppressed(true, () => resolveProject('Release'));

    expect(result?.projectId).toBe('project-1');
    const key = workspaceCacheKey('lin_api_testkey');
    expect(existsSync(join(tmp, 'agent2linear', key, 'project-cache.json'))).toBe(false);
  });
});
