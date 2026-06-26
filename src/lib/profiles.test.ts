import { describe, expect, it, vi } from 'vitest';

import type { RemoteIdentity } from './git-context.js';
import { detectMatchingProfiles, detectProfile } from './profiles.js';
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

describe('detectProfile - host/owner/repo identity matching (M31 Phase 3)', () => {
  const gh = (owner: string, name: string, host = 'github.com'): Record<string, RemoteIdentity> =>
    origin({ host, owner, name });

  it('ANDs present fields: host + owner + repo must ALL match', () => {
    const profiles: Record<string, Profile> = {
      acme: {
        workspace: 'acme',
        match: {
          gitRemoteHost: ['github.com'],
          gitRemoteOwner: ['acme-co'],
          gitRemoteRepo: ['acme-co/widgets'],
        },
      },
    };
    expect(detectProfile(profiles, () => gh('acme-co', 'widgets'))).toEqual({
      name: 'acme',
      exclude: false,
    });
    // Same owner, different host -> the host AND-term fails.
    expect(detectProfile(profiles, () => gh('acme-co', 'widgets', 'gitlab.com'))).toBeNull();
    // Same host+owner, different repo name -> the repo AND-term fails.
    expect(detectProfile(profiles, () => gh('acme-co', 'other'))).toBeNull();
  });

  it('ORs within a field list (any pattern matches the value)', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteHost: ['gitlab.com', 'github.com'] } },
    };
    expect(detectProfile(profiles, () => gh('x', 'y', 'github.com'))).toEqual({
      name: 'acme',
      exclude: false,
    });
    expect(detectProfile(profiles, () => gh('x', 'y', 'gitlab.com'))).toEqual({
      name: 'acme',
      exclude: false,
    });
    expect(detectProfile(profiles, () => gh('x', 'y', 'bitbucket.org'))).toBeNull();
  });

  it('matches globs in each identity field (host wildcard, repo prefix)', () => {
    const profiles: Record<string, Profile> = {
      gl: { workspace: 'gl', match: { gitRemoteHost: ['*.gitlab.example.com'] } },
      secret: { workspace: 'secret', match: { gitRemoteRepo: ['my-org/secret-*'] } },
    };
    expect(
      detectProfile(profiles, () => gh('any', 'repo', 'eu.gitlab.example.com'))
    ).toEqual({ name: 'gl', exclude: false });
    expect(detectProfile(profiles, () => gh('my-org', 'secret-keys'))).toEqual({
      name: 'secret',
      exclude: false,
    });
    expect(detectProfile(profiles, () => gh('my-org', 'public'))).toBeNull();
  });

  it('detects a HOST-only rule (trap 1: matchable filter no longer owner-only)', () => {
    const profiles: Record<string, Profile> = {
      gh: { workspace: 'gh', match: { gitRemoteHost: ['github.com'] } },
    };
    expect(detectProfile(profiles, () => gh('whoever', 'whatever'))).toEqual({
      name: 'gh',
      exclude: false,
    });
  });

  it('detects a REPO-only rule (trap 1)', () => {
    const profiles: Record<string, Profile> = {
      repo: { workspace: 'repo', match: { gitRemoteRepo: ['acme-co/*'] } },
    };
    expect(detectProfile(profiles, () => gh('acme-co', 'anything'))).toEqual({
      name: 'repo',
      exclude: false,
    });
  });

  it('opt-in caseSensitive: Foo != foo (default insensitive unchanged)', () => {
    const sensitive: Record<string, Profile> = {
      g: { workspace: 'g', match: { gitRemoteOwner: ['Foo'], caseSensitive: true } },
    };
    expect(detectProfile(sensitive, () => gh('Foo', 'r'))).toEqual({ name: 'g', exclude: false });
    expect(detectProfile(sensitive, () => gh('foo', 'r'))).toBeNull();

    // Without caseSensitive, owner matching stays case-insensitive (nocase = true).
    const insensitive: Record<string, Profile> = {
      g: { workspace: 'g', match: { gitRemoteOwner: ['Foo'] } },
    };
    expect(detectProfile(insensitive, () => gh('foo', 'r'))).toEqual({ name: 'g', exclude: false });
  });

  it('exclusion keys off the FULL rule (trap 2): a fully-matching linear:false excludes', () => {
    const profiles: Record<string, Profile> = {
      blocked: {
        match: { gitRemoteOwner: ['acme-co'], gitRemoteRepo: ['acme-co/secret'], linear: false },
      },
    };
    // Whole rule matches -> excluded.
    expect(detectProfile(profiles, () => gh('acme-co', 'secret'))).toEqual({
      name: 'blocked',
      exclude: true,
    });
  });

  it('a PARTIALLY-matching linear:false rule does NOT exclude (trap 2)', () => {
    const profiles: Record<string, Profile> = {
      // owner matches but the repo AND-term does not -> the rule does not match,
      // so the exclusion must NOT fire.
      blocked: {
        match: { gitRemoteOwner: ['acme-co'], gitRemoteRepo: ['acme-co/secret'], linear: false },
      },
      personal: { workspace: 'personal', match: { gitRemoteOwner: ['acme-co'] } },
    };
    expect(detectProfile(profiles, () => gh('acme-co', 'public'))).toEqual({
      name: 'personal',
      exclude: false,
    });
  });
});

describe('detectProfile - remote selection + fork predicate (M31 Phase 3)', () => {
  // A fork: origin is the personal account, upstream is the org.
  const fork: Record<string, RemoteIdentity> = {
    origin: { host: 'github.com', owner: 'alice', name: 'widgets' },
    upstream: { host: 'github.com', owner: 'acme', name: 'widgets' },
  };

  it('remote: "upstream" reads the upstream owner, not origin', () => {
    const profiles: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { remote: 'upstream', gitRemoteOwner: ['acme'] } },
    };
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'acme', exclude: false });
    // The same owner read off origin (default) would NOT match.
    const originRule: Record<string, Profile> = {
      acme: { workspace: 'acme', match: { gitRemoteOwner: ['acme'] } },
    };
    expect(detectProfile(originRule, () => fork)).toBeNull();
  });

  it('remote: ["origin","upstream"] matches if EITHER selected remote satisfies', () => {
    const profiles: Record<string, Profile> = {
      p: { workspace: 'p', match: { remote: ['origin', 'upstream'], gitRemoteOwner: ['acme'] } },
    };
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'p', exclude: false });
    const aliceProfiles: Record<string, Profile> = {
      p: { workspace: 'p', match: { remote: ['origin', 'upstream'], gitRemoteOwner: ['alice'] } },
    };
    expect(detectProfile(aliceProfiles, () => fork)).toEqual({ name: 'p', exclude: false });
  });

  it('remote: "*" matches if ANY remote satisfies', () => {
    const profiles: Record<string, Profile> = {
      p: { workspace: 'p', match: { remote: '*', gitRemoteOwner: ['acme'] } },
    };
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'p', exclude: false });
  });

  it('remote: ["*"] matches if ANY remote satisfies', () => {
    const profiles: Record<string, Profile> = {
      p: { workspace: 'p', match: { remote: ['*'], gitRemoteOwner: ['acme'] } },
    };
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'p', exclude: false });
  });

  it('BARE remote: "upstream" matches a repo that HAS an upstream regardless of owner', () => {
    const profiles: Record<string, Profile> = {
      isFork: { workspace: 'isFork', match: { remote: 'upstream' } },
    };
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'isFork', exclude: false });
    // A repo with only origin (no upstream) does NOT match the bare predicate.
    const onlyOrigin: Record<string, RemoteIdentity> = {
      origin: { host: 'github.com', owner: 'alice', name: 'widgets' },
    };
    expect(detectProfile(profiles, () => onlyOrigin)).toBeNull();
  });

  it('detectMatchingProfiles returns >1 on the fork overlap (origin->personal, upstream->acme)', () => {
    const profiles: Record<string, Profile> = {
      personal: { workspace: 'personal', match: { gitRemoteOwner: ['alice'] } }, // via origin
      acme: { workspace: 'acme', match: { remote: 'upstream', gitRemoteOwner: ['acme'] } }, // via upstream
    };
    expect(detectMatchingProfiles(profiles, () => fork).sort()).toEqual(['acme', 'personal']);
    // detectProfile still returns a single result: first-positive by declaration order.
    expect(detectProfile(profiles, () => fork)).toEqual({ name: 'personal', exclude: false });
  });
});

describe('detectProfile / detectMatchingProfiles - bare-rule guard + short-circuit (trap 1)', () => {
  it('a match rule with NO identity fields AND no explicit remote -> NO MATCH (even with an origin)', () => {
    // The load-bearing negative test: `match: {}` must NOT match every repo that has
    // an origin. A second, matchable-but-non-matching profile forces the provider to
    // run, so this exercises ruleMatches (not just the short-circuit).
    const provider = vi.fn(() => origin({ host: 'github.com', owner: 'acme-co', name: 'widgets' }));
    const profiles: Record<string, Profile> = {
      bare: { workspace: 'bare', match: {} },
      needle: { workspace: 'needle', match: { gitRemoteOwner: ['nobody'] } },
    };
    expect(detectProfile(profiles, provider)).toBeNull();
    expect(detectMatchingProfiles(profiles, provider)).toEqual([]);
    expect(provider).toHaveBeenCalled(); // origin present -> bare did not spuriously match
  });

  it('a match rule with linear:false but no identity/remote fields -> NO MATCH (no spurious exclude)', () => {
    const provider = vi.fn(() => origin({ host: 'github.com', owner: 'acme-co', name: 'widgets' }));
    const profiles: Record<string, Profile> = {
      bare: { match: { linear: false } },
      needle: { workspace: 'needle', match: { gitRemoteOwner: ['nobody'] } },
    };
    expect(detectProfile(profiles, provider)).toBeNull();
    expect(provider).toHaveBeenCalled();
  });

  it('short-circuits WITHOUT calling the provider when NO rule has any matchable field', () => {
    // Separate from the negative test: here nothing is matchable, so detection must
    // never invoke git (provider untouched).
    const provider = vi.fn(() => origin({ host: 'github.com', owner: 'acme-co', name: 'repo' }));
    const profiles: Record<string, Profile> = {
      a: { workspace: 'a', match: {} },
      b: { workspace: 'b' },
    };
    expect(detectProfile(profiles, provider)).toBeNull();
    expect(detectMatchingProfiles(profiles, provider)).toEqual([]);
    expect(provider).not.toHaveBeenCalled();
  });
});
