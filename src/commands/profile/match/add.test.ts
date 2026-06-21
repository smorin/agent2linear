import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadProfiles, saveProfile } from '../../../lib/profiles.js';
import { profileMatchAddCommand } from './add.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-pmatch-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-pmatch-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  process.chdir(workdir);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // A profile must exist before match rules can be added to it.
  saveProfile('global', 'p', { workspace: 'w' });
});

afterEach(() => {
  process.chdir(origCwd);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('profileMatchAddCommand - --git-remote-owner normalization', () => {
  it('stores a bare owner as-is', () => {
    profileMatchAddCommand('p', { gitRemoteOwner: ['acme-co'] });
    expect(loadProfiles().p.match?.gitRemoteOwner).toEqual(['acme-co']);
  });

  it('extracts the bare owner from a full repo URL (the reported footgun)', () => {
    profileMatchAddCommand('p', {
      gitRemoteOwner: ['https://github.com/banksheets/get-bank-sheets-web.git'],
    });
    expect(loadProfiles().p.match?.gitRemoteOwner).toEqual(['banksheets']);
  });

  it('normalizes a mix of bare + URL owners and de-duplicates', () => {
    profileMatchAddCommand('p', {
      gitRemoteOwner: ['acme-co', 'git@github.com:acme-co/other.git', 'acme-labs'],
    });
    expect(loadProfiles().p.match?.gitRemoteOwner).toEqual(['acme-co', 'acme-labs']);
  });

  it('rejects a malformed owner with a non-zero exit and stores nothing', () => {
    const exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);

    expect(() => profileMatchAddCommand('p', { gitRemoteOwner: ['bad/owner'] })).toThrow('exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
    // No match rules were written.
    expect(loadProfiles().p.match).toBeUndefined();
  });
});
