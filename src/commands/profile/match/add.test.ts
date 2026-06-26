import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RemoteIdentity } from '../../../lib/git-context.js';
import {
  detectPositiveMatchingProfiles,
  loadProfiles,
  saveProfile,
} from '../../../lib/profiles.js';
import type { Profile } from '../../../lib/types.js';
import { profileMatchAddCommand } from './add.js';
import { profileMatchListCommand } from './list.js';
import { profileMatchRemoveCommand } from './remove.js';

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

describe('profileMatchAddCommand - host/repo/remote/case (M31 Phase 4)', () => {
  it('stores a --git-remote-host literal glob verbatim', () => {
    profileMatchAddCommand('p', { gitRemoteHost: ['*.gitlab.example.com'] });
    expect(loadProfiles().p.match?.gitRemoteHost).toEqual(['*.gitlab.example.com']);
  });

  it('extracts the host from a pasted full repo URL', () => {
    profileMatchAddCommand('p', {
      gitRemoteHost: ['https://github.com/banksheets/get-bank-sheets-web.git'],
    });
    expect(loadProfiles().p.match?.gitRemoteHost).toEqual(['github.com']);
  });

  it('stores a --git-remote-repo literal glob (owner/name with a wildcard) verbatim', () => {
    profileMatchAddCommand('p', { gitRemoteRepo: ['my-org/secret-*'] });
    expect(loadProfiles().p.match?.gitRemoteRepo).toEqual(['my-org/secret-*']);
  });

  it('extracts owner/name from a pasted full repo URL for --git-remote-repo', () => {
    profileMatchAddCommand('p', {
      gitRemoteRepo: ['git@github.com:acme-co/widgets.git'],
    });
    expect(loadProfiles().p.match?.gitRemoteRepo).toEqual(['acme-co/widgets']);
  });

  it('persists a single --remote as a STRING (collapsed, mirrors M29 shape)', () => {
    profileMatchAddCommand('p', { remote: ['upstream'] });
    expect(loadProfiles().p.match?.remote).toEqual('upstream');
  });

  it('persists multiple --remote values as a deduped ARRAY', () => {
    profileMatchAddCommand('p', { remote: ['origin', 'upstream', 'origin'] });
    expect(loadProfiles().p.match?.remote).toEqual(['origin', 'upstream']);
  });

  it('persists caseSensitive: true only when --case-sensitive is passed', () => {
    profileMatchAddCommand('p', { gitRemoteOwner: ['acme'], caseSensitive: true });
    expect(loadProfiles().p.match?.caseSensitive).toBe(true);
    // A separate add WITHOUT the flag must never write caseSensitive: false.
    saveProfile('global', 'q', { workspace: 'w' });
    profileMatchAddCommand('q', { gitRemoteOwner: ['acme'] });
    expect('caseSensitive' in (loadProfiles().q.match ?? {})).toBe(false);
  });

  it('dedupes each field independently across mixed bare + URL inputs', () => {
    profileMatchAddCommand('p', {
      gitRemoteHost: ['github.com', 'github.com', '*.gitlab.example.com'],
      gitRemoteRepo: ['my-org/secret-*', 'my-org/secret-*'],
      gitRemoteOwner: ['acme-co', 'git@github.com:acme-co/other.git', 'acme-labs'],
    });
    const match = loadProfiles().p.match;
    expect(match?.gitRemoteHost).toEqual(['github.com', '*.gitlab.example.com']);
    expect(match?.gitRemoteRepo).toEqual(['my-org/secret-*']);
    expect(match?.gitRemoteOwner).toEqual(['acme-co', 'acme-labs']);
  });

  it('accepts a bare --remote with no identity fields (the fork predicate)', () => {
    profileMatchAddCommand('p', { remote: ['upstream'] });
    expect(loadProfiles().p.match).toEqual({ remote: 'upstream' });
  });

  it('rejects --case-sensitive alone (it is a modifier, not a matchable rule)', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    expect(() => profileMatchAddCommand('p', { caseSensitive: true })).toThrow('exit:1');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(loadProfiles().p.match).toBeUndefined();
  });
});

describe('profileMatchRemoveCommand - per-field removal (M31 Phase 4)', () => {
  it('removes a host glob, deleting the field when empty', () => {
    profileMatchAddCommand('p', { gitRemoteHost: ['*.gitlab.example.com'] });
    profileMatchRemoveCommand('p', { gitRemoteHost: '*.gitlab.example.com' });
    expect('gitRemoteHost' in (loadProfiles().p.match ?? {})).toBe(false);
  });

  it('removes a repo glob verbatim', () => {
    profileMatchAddCommand('p', { gitRemoteRepo: ['my-org/secret-*', 'my-org/public-*'] });
    profileMatchRemoveCommand('p', { gitRemoteRepo: 'my-org/secret-*' });
    expect(loadProfiles().p.match?.gitRemoteRepo).toEqual(['my-org/public-*']);
  });

  it('removes a remote selector, collapsing the survivor back to a string', () => {
    profileMatchAddCommand('p', { remote: ['origin', 'upstream'] });
    profileMatchRemoveCommand('p', { remote: 'origin' });
    expect(loadProfiles().p.match?.remote).toEqual('upstream');
  });

  it('deletes the remote field entirely when the last selector is removed', () => {
    profileMatchAddCommand('p', { remote: ['upstream'] });
    profileMatchRemoveCommand('p', { remote: 'upstream' });
    expect('remote' in (loadProfiles().p.match ?? {})).toBe(false);
  });
});

describe('profileMatchListCommand - prints the new fields (M31 Phase 4)', () => {
  it('prints remote / host / owner / repo / case-sensitive lines', () => {
    const logSpy = vi.spyOn(console, 'log');
    profileMatchAddCommand('p', {
      remote: ['upstream'],
      gitRemoteHost: ['*.gitlab.example.com'],
      gitRemoteOwner: ['acme'],
      gitRemoteRepo: ['acme/secret-*'],
      caseSensitive: true,
    });
    logSpy.mockClear();
    profileMatchListCommand('p');
    const out = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(out).toContain('remote: upstream');
    expect(out).toContain('git-remote-host: *.gitlab.example.com');
    expect(out).toContain('git-remote-owner: acme');
    expect(out).toContain('git-remote-repo: acme/secret-*');
    expect(out).toContain('case-sensitive: true');
  });
});

describe('detectPositiveMatchingProfiles - ambiguity threshold (M31 Phase 4 decision A)', () => {
  const origin = (id: RemoteIdentity): Record<string, RemoteIdentity> => ({ origin: id });
  const fork: Record<string, RemoteIdentity> = {
    origin: { host: 'github.com', owner: 'alice', name: 'widgets' },
    upstream: { host: 'github.com', owner: 'acme', name: 'widgets' },
  };

  it('counts >=2 when two profiles POSITIVELY match the fork (=> warn)', () => {
    const profiles: Record<string, Profile> = {
      personal: { workspace: 'personal', match: { gitRemoteOwner: ['alice'] } },
      acme: { workspace: 'acme', match: { remote: 'upstream', gitRemoteOwner: ['acme'] } },
    };
    expect(detectPositiveMatchingProfiles(profiles, () => fork).sort()).toEqual(['acme', 'personal']);
  });

  it('an EXCLUDED match does NOT count toward the threshold', () => {
    // Both rules match the same owner, but `blocked` is linear:false -> it is a
    // deterministic exclusion, not a routing ambiguity, so the positive count is 1.
    const profiles: Record<string, Profile> = {
      blocked: { workspace: 'blocked', linear: false, match: { gitRemoteOwner: ['acme-co'] } },
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    const provider = () => origin({ host: 'github.com', owner: 'acme-co', name: 'widgets' });
    expect(detectPositiveMatchingProfiles(profiles, provider)).toEqual(['acme']);
  });
});
