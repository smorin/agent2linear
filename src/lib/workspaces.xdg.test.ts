import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getGlobalWorkspacesPath,
  loadWorkspaces,
  saveWorkspace,
} from './workspaces.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ws-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ws-cwd-'));
});

afterEach(() => {
  process.chdir(origCwd);
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('workspaces.ts global path honors XDG and writes mode 0600', () => {
  it('writes workspaces.json under $XDG_CONFIG_HOME at mode 0600', () => {
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    const expected = join(xdgConfig, 'agent2linear', 'workspaces.json');
    // Assert the resolved path BEFORE any write so a regression cannot touch the
    // user's real ~/.config/agent2linear/workspaces.json.
    expect(getGlobalWorkspacesPath()).toBe(expected);

    saveWorkspace('global', 'acme', { apiKey: 'lin_api_acme' });

    expect(existsSync(expected)).toBe(true);
    const mode = statSync(expected).mode & 0o777;
    expect(mode).toBe(0o600);

    const parsed = JSON.parse(readFileSync(expected, 'utf-8'));
    expect(parsed.acme.apiKey).toBe('lin_api_acme');
  });

  it('loadWorkspaces returns the saved global workspace', () => {
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    saveWorkspace('global', 'acme', { apiKey: 'lin_api_acme' });
    process.chdir(workdir); // empty cwd: no project secrets to merge
    const workspaces = loadWorkspaces();
    expect(workspaces.acme).toEqual({ apiKey: 'lin_api_acme' });
  });
});

describe('workspaces.ts project secrets write refreshes .gitignore', () => {
  it('writes workspaces.local.json and adds a .gitignore entry idempotently', () => {
    vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
    process.chdir(workdir);

    saveWorkspace('project', 'acme', { apiKey: 'lin_api_acme' });

    const secretsFile = join(workdir, '.agent2linear', 'workspaces.local.json');
    expect(existsSync(secretsFile)).toBe(true);
    const mode = statSync(secretsFile).mode & 0o777;
    expect(mode).toBe(0o600);

    const gitignore = join(workdir, '.agent2linear', '.gitignore');
    expect(existsSync(gitignore)).toBe(true);
    expect(readFileSync(gitignore, 'utf-8')).toContain('workspaces.local.json');

    // Second write must NOT duplicate the .gitignore entry.
    saveWorkspace('project', 'beta', { apiKey: 'lin_api_beta' });
    const lines = readFileSync(gitignore, 'utf-8')
      .split('\n')
      .filter((l) => l.trim() === 'workspaces.local.json');
    expect(lines.length).toBe(1);
  });
});
