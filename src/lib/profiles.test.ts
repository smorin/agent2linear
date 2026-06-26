import { describe, expect, it, vi } from 'vitest';

import type { RemoteIdentity } from './git-context.js';
import { detectProfile } from './profiles.js';
import type { Profile } from './types.js';

/**
 * The injected provider now returns the repo's full REMOTES MAP (M31 Phase 2),
 * not a single origin URL string. `detectProfile` reads `remotes['origin']`, so a
 * missing `origin` key (the old "no origin URL" / null case) yields no match.
 */
const origin = (identity: RemoteIdentity): Record<string, RemoteIdentity> => ({ origin: identity });

describe('detectProfile - git-remote owner matching (injected provider)', () => {
  it('maps a matching owner to its profile', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co', 'acme-labs'] } },
      personal: { workspace: 'personal' },
    };
    const result = detectProfile(profiles, () =>
      origin({ host: 'github.com', owner: 'acme-co', name: 'widgets' })
    );
    expect(result).toEqual({ name: 'acme', exclude: false });
  });

  it('returns null when the owner matches no profile', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    expect(
      detectProfile(profiles, () => origin({ host: 'github.com', owner: 'other-org', name: 'repo' }))
    ).toBeNull();
  });

  it('short-circuits to null WITHOUT calling the provider when no match rules exist', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme' },
      personal: { workspace: 'personal' },
    };
    const provider = vi.fn(() => origin({ host: 'github.com', owner: 'acme-co', name: 'repo' }));
    expect(detectProfile(profiles, provider)).toBeNull();
    expect(provider).not.toHaveBeenCalled();
  });

  it('matches owners case-insensitively', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    expect(
      detectProfile(profiles, () => origin({ host: 'github.com', owner: 'ACME-CO', name: 'repo' }))
    ).toEqual({
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
    expect(
      detectProfile(profiles, () => origin({ host: 'github.com', owner: 'acme-co', name: 'repo' }))
    ).toEqual({
      name: 'acmeBlocked',
      exclude: true,
    });
  });

  it('honors match-level linear:false as exclusion', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'], linear: false } },
    };
    expect(
      detectProfile(profiles, () => origin({ host: 'github.com', owner: 'acme-co', name: 'repo' }))
    ).toEqual({
      name: 'acme',
      exclude: true,
    });
  });

  it('returns null when the remotes map has no origin (e.g. no origin remote)', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme-co'] } },
    };
    // Empty map == the old "no origin URL" / null case: no `origin` key -> no match.
    expect(detectProfile(profiles, () => ({}))).toBeNull();
  });

  it('resolves a nested-group origin owner as group/sub (all-but-last) — INTENDED change (D2)', () => {
    // M31 Phase 2 unifies on git-context.ts, which segments a nested GitLab group
    // (git@gitlab.com:group/sub/repo.git -> { owner: 'group/sub', name: 'repo' }).
    // This is the DELIBERATE delta from the retired first-segment parser (which
    // yielded `group`): a rule must now use `group/sub` (or `group/*`) — NOT a
    // regression. Asserted so no one reverts it to first-segment segmentation.
    const profiles: Record<string, Profile> = {
      group: { workspace: 'group', match: { gitRemoteOwner: ['group/sub'] } },
    };
    expect(
      detectProfile(profiles, () => origin({ host: 'gitlab.com', owner: 'group/sub', name: 'repo' }))
    ).toEqual({ name: 'group', exclude: false });
  });
});
