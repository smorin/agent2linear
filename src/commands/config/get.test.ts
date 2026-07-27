import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from '../../lib/git-context.js';
import { resetInvocationContext, setInvocationContext } from '../../lib/invocation-context.js';
import { getConfigValue } from './get.js';

describe('config get [dir] — override resolution (M29)', () => {
  let xdg: string;
  let repo: string;

  beforeEach(() => {
    xdg = mkdtempSync(join(tmpdir(), 'a2l-get-xdg-'));
    repo = mkdtempSync(join(tmpdir(), 'a2l-get-repo-'));
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

  it('override-resolves the key for the positional [dir], falling back at the root', () => {
    mkdirSync(join(repo, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repo, '.agent2linear', 'config.json'),
      JSON.stringify({ defaultTeam: 'platform', overrides: [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }] })
    );
    mkdirSync(join(repo, 'cli'), { recursive: true });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    void getConfigValue('defaultTeam', join(repo, 'cli'));
    expect(log.mock.calls[0][0]).toContain('cli-team');
    expect(log.mock.calls[0][0]).toContain('repo override');

    log.mockClear();
    void getConfigValue('defaultTeam', repo); // repo root → catch-all
    expect(log.mock.calls[0][0]).toContain('platform');
    expect(log.mock.calls[0][0]).toContain('project config');
  });

  it('M31: names the winning override rule by its label (else #<index>)', () => {
    mkdirSync(join(repo, '.agent2linear'), { recursive: true });
    writeFileSync(
      join(repo, '.agent2linear', 'config.json'),
      JSON.stringify({
        defaultTeam: 'platform',
        overrides: [
          { id: 'cli-team', when: { path: 'cli/**' }, defaultTeam: 'cli-team' },
          { when: { path: 'mobile/**' }, defaultTeam: 'mobile-team' },
        ],
      })
    );
    mkdirSync(join(repo, 'cli'), { recursive: true });
    mkdirSync(join(repo, 'mobile'), { recursive: true });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    void getConfigValue('defaultTeam', join(repo, 'cli'));
    expect(log.mock.calls[0][0]).toContain('repo override cli-team');

    log.mockClear();
    void getConfigValue('defaultTeam', join(repo, 'mobile')); // unlabeled rule at index 1
    expect(log.mock.calls[0][0]).toContain('repo override #1');
  });

  it('names the selected file when an explicit-config override wins', () => {
    const path = join(repo, 'selected.json');
    setInvocationContext({
      explicitConfig: {
        path,
        value: {
          overrides: [{ id: 'selected-rule', when: {}, defaultTeam: 'explicit-team' }],
        },
      },
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    void getConfigValue('defaultTeam', repo);

    expect(log.mock.calls[0][0]).toBe(
      `defaultTeam: explicit-team (from explicit config ${path} override selected-rule)`
    );
  });
});
