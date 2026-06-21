import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetInvocationContext, setInvocationContext } from '../../lib/invocation-context.js';
import { loadProfiles } from '../../lib/profiles.js';
import { addProfileCommand } from './add.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-padd-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-padd-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  process.chdir(workdir);
  resetInvocationContext();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(origCwd);
  resetInvocationContext();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('addProfileCommand - workspace pointer (regression)', () => {
  // Regression: the program-level `--workspace` global shadows the subcommand
  // option, so the profile's workspace pointer must be sourced from the
  // invocation context. Reading it from `options` instead silently dropped it,
  // leaving auto-detected profiles with no key to source.
  it('persists the workspace pointer from the invocation context', () => {
    setInvocationContext({ workspace: 'flox' });
    addProfileCommand('pflox', { defaultTeam: 'backend' });

    const profile = loadProfiles().pflox;
    expect(profile.workspace).toBe('flox');
    expect(profile.defaultTeam).toBe('backend');
  });

  it('saves no workspace pointer when no --workspace selector is present', () => {
    setInvocationContext({});
    addProfileCommand('plain', {});

    expect(loadProfiles().plain.workspace).toBeUndefined();
  });
});
