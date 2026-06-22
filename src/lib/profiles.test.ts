import { describe, expect, it, vi } from 'vitest';

import { detectProfile } from './profiles.js';
import type { Profile } from './types.js';

describe('detectProfile - git-remote owner matching (injected provider)', () => {
  it('maps a matching owner to its profile', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co', 'acme-labs'] } },
      personal: { workspace: 'personal' },
    };
    const result = detectProfile(profiles, () => 'git@github.com:acme-co/widgets.git');
    expect(result).toEqual({ name: 'acme', exclude: false });
  });

  it('returns null when the owner matches no profile', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    expect(detectProfile(profiles, () => 'git@github.com:other-org/repo.git')).toBeNull();
  });

  it('short-circuits to null WITHOUT calling the provider when no match rules exist', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme' },
      personal: { workspace: 'personal' },
    };
    const provider = vi.fn(() => 'git@github.com:acme-co/repo.git');
    expect(detectProfile(profiles, provider)).toBeNull();
    expect(provider).not.toHaveBeenCalled();
  });

  it('matches owners case-insensitively', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    expect(detectProfile(profiles, () => 'git@github.com:ACME-CO/repo.git')).toEqual({
      name: 'acme',
      exclude: false,
    });
  });

  it('negative match wins over a positive match for the same owner', () => {
    const profiles: Record<string, Profile> = {
      // positive match declared first
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
      // excluded profile also matches the same owner
      acmeBlocked: { match: { gitRemoteOwner: ['acme-co'] }, linear: false },
    };
    expect(detectProfile(profiles, () => 'git@github.com:acme-co/repo.git')).toEqual({
      name: 'acmeBlocked',
      exclude: true,
    });
  });

  it('honors match-level linear:false as exclusion', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'], linear: false } },
    };
    expect(detectProfile(profiles, () => 'git@github.com:acme-co/repo.git')).toEqual({
      name: 'acme',
      exclude: true,
    });
  });

  it('returns null when the provider yields no URL', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    expect(detectProfile(profiles, () => null)).toBeNull();
  });
});
