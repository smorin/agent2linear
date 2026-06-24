import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from '../../lib/git-context.js';
import { resetInvocationContext, setInvocationContext } from '../../lib/invocation-context.js';
import { listConfig } from './list.js';

describe('config list — override provenance (M29)', () => {
  let xdg: string;
  let repo: string;

  beforeEach(() => {
    xdg = mkdtempSync(join(tmpdir(), 'a2l-list-xdg-'));
    repo = mkdtempSync(join(tmpdir(), 'a2l-list-repo-'));
    vi.stubEnv('XDG_CONFIG_HOME', xdg);
    vi.stubEnv('LINEAR_API_KEY', '');
    vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
    resetInvocationContext();
    __resetGitContextCache();
  });

  afterEach(() => {
    resetInvocationContext();
    __resetGitContextCache();
    vi.restoreAllMocks();
    rmSync(xdg, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  });

  it('labels a value supplied by an override rule with its scope + when', async () => {
    mkdirSync(join(repo, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repo, '.agent2linear', 'config.json'),
      JSON.stringify({ defaultTeam: 'platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] })
    );
    mkdirSync(join(repo, 'cli'), { recursive: true });
    setInvocationContext({ contextDir: join(repo, 'cli') }); // listConfig() resolves via getConfig()

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await listConfig();
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');

    expect(out).toContain('cli-team');
    expect(out).toContain('repo override');
    expect(out).toContain('"path":"cli/**"');
  });
});
