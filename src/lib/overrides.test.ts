import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RemoteIdentity } from './git-context.js';
import { logger } from './logger.js';
import {
  matchWhen,
  needsGitContext,
  type OverrideContext,
  type OverrideLayer,
  resolveOverrides,
} from './overrides.js';
import type { ConfigOverride, WhenClause } from './types.js';

const REPO = '/work/acme/web';
const ORIGIN: RemoteIdentity = { host: 'github.com', owner: 'acme', name: 'web' };

function ctx(
  contextDir: string,
  repoRoot: string | null = REPO,
  extra: { branch?: string; remotes?: Record<string, RemoteIdentity> } = {}
): OverrideContext {
  return { contextDir, repoRoot, branch: extra.branch, remotes: extra.remotes ?? {} };
}

function layer(scope: 'global' | 'project', rules: ConfigOverride[]): OverrideLayer {
  return { scope, rules };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveOverrides — matching', () => {
  it('an empty `when` is a catch-all that matches and records provenance', () => {
    const r = resolveOverrides(ctx(REPO), [layer('project', [{ when: {}, defaultTeam: 'platform' }])]);
    expect(r.values.defaultTeam).toBe('platform');
    expect(r.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'project', ruleIndex: 0, when: {} });
  });

  it('a path rule applies under its subtree only', () => {
    const rules: ConfigOverride[] = [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }];
    expect(resolveOverrides(ctx(`${REPO}/cli/sub`), [layer('project', rules)]).values.defaultTeam).toBe('cli-team');
    expect(resolveOverrides(ctx(`${REPO}/apps`), [layer('project', rules)]).values.defaultTeam).toBeUndefined();
  });

  it('a trailing-slash path rule matches its subtree', () => {
    const rules: ConfigOverride[] = [{ when: { path: 'cli/' }, defaultTeam: 'cli-team' }];
    expect(resolveOverrides(ctx(`${REPO}/cli/x`), [layer('project', rules)]).values.defaultTeam).toBe('cli-team');
  });

  it('a negated path rule matches everywhere except the excluded subtree', () => {
    const rules: ConfigOverride[] = [{ when: { path: '!cli/**' }, defaultTeam: 'not-cli' }];
    expect(resolveOverrides(ctx(`${REPO}/apps`), [layer('project', rules)]).values.defaultTeam).toBe('not-cli');
    expect(resolveOverrides(ctx(`${REPO}/cli`), [layer('project', rules)]).values.defaultTeam).toBeUndefined();
  });

  it('treats a rule with no `when` as a catch-all (untyped JSON on disk)', () => {
    const rules = [{ defaultTeam: 'no-when' } as unknown as ConfigOverride];
    const r = resolveOverrides(ctx(REPO), [layer('project', rules)]);
    expect(r.values.defaultTeam).toBe('no-when');
  });

  it('returns nothing for empty layers', () => {
    const r = resolveOverrides(ctx(REPO), []);
    expect(r.values).toEqual({});
    expect(r.locations).toEqual({});
    expect(r.aliases).toEqual({});
  });
});

describe('resolveOverrides — specificity (§5.6)', () => {
  it('more leading literal segments win', () => {
    const rules: ConfigOverride[] = [
      { when: { path: '**' }, defaultTeam: 'A' },
      { when: { path: 'apps/**' }, defaultTeam: 'B' },
      { when: { path: 'apps/web/**' }, defaultTeam: 'C' },
      { when: { path: 'apps/web/src' }, defaultTeam: 'D' },
    ];
    const r = resolveOverrides(ctx(`${REPO}/apps/web/src`), [layer('project', rules)]);
    expect(r.values.defaultTeam).toBe('D');
  });

  it('with equal literal segments, fewer wildcard segments win', () => {
    const rules: ConfigOverride[] = [
      { when: { path: 'apps/*/*' }, defaultTeam: 'two-wild' },
      { when: { path: 'apps/**' }, defaultTeam: 'one-wild' },
    ];
    const r = resolveOverrides(ctx(`${REPO}/apps/web/src`), [layer('project', rules)]);
    expect(r.values.defaultTeam).toBe('one-wild');
  });

  it('breaks exact ties by declaration order (later wins)', () => {
    const rules: ConfigOverride[] = [
      { when: { path: 'cli/**' }, defaultTeam: 'first' },
      { when: { path: 'cli/**' }, defaultTeam: 'second' },
    ];
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [layer('project', rules)]);
    expect(r.values.defaultTeam).toBe('second');
  });

  it('repo scope beats global regardless of specificity', () => {
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('global', [{ when: { path: 'cli/**' }, defaultTeam: 'global-specific' }]),
      layer('project', [{ when: {}, defaultTeam: 'repo-catchall' }]),
    ]);
    expect(r.values.defaultTeam).toBe('repo-catchall');
    expect(r.locations.defaultTeam).toMatchObject({ type: 'override', scope: 'project' });
  });
});

describe('resolveOverrides — field-level resolution (U2)', () => {
  it('resolves each field independently (a specific rule does not clobber inherited fields)', () => {
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('project', [
        { when: {}, defaultTeam: 'platform', defaultInitiative: 'roadmap' },
        { when: { path: 'cli/**' }, defaultTeam: 'cli-team' },
      ]),
    ]);
    expect(r.values.defaultTeam).toBe('cli-team');
    expect(r.values.defaultInitiative).toBe('roadmap');
    expect(r.locations.defaultTeam.when).toEqual({ path: 'cli/**' });
    expect(r.locations.defaultInitiative.when).toEqual({});
  });

  it('keeps a boolean defaultAutoAssignLead: false (not dropped as falsy)', () => {
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('project', [
        { when: {}, defaultAutoAssignLead: true },
        { when: { path: 'cli/**' }, defaultAutoAssignLead: false },
      ]),
    ]);
    expect(r.values.defaultAutoAssignLead).toBe(false);
    expect('defaultAutoAssignLead' in r.values).toBe(true);
  });
});

describe('resolveOverrides — `id` is provenance-only (M31 invariant)', () => {
  it("surfaces a rule's `id` as `ruleId` provenance, never as a resolved value", () => {
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('project', [{ id: 'cli-team', when: { path: 'cli/**' }, defaultTeam: 'cli-team' }]),
    ]);
    // `id` is carried on the location only.
    expect(r.locations.defaultTeam.ruleId).toBe('cli-team');
    // …and never leaks into the resolved values map (only the overridable field).
    expect('id' in r.values).toBe(false);
    expect(r.values).toEqual({ defaultTeam: 'cli-team' });
  });

  it('omits `ruleId` for a legacy unlabeled rule (byte-identical provenance)', () => {
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('project', [{ when: { path: 'cli/**' }, defaultTeam: 'cli-team' }]),
    ]);
    expect(r.locations.defaultTeam.ruleId).toBeUndefined();
    expect('ruleId' in r.locations.defaultTeam).toBe(false);
  });
});

describe('resolveOverrides — alias overlay', () => {
  it('merges alias maps per entity type and key, strongest rule winning', () => {
    const r = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('global', [{ when: {}, aliases: { teams: { default: 'team_global', extra: 'team_x' } } }]),
      layer('project', [
        { when: { path: 'cli/**' }, aliases: { teams: { default: 'team_cli' }, initiatives: { q: 'init_q' } } },
      ]),
    ]);
    expect(r.aliases.teams).toEqual({ default: 'team_cli', extra: 'team_x' });
    expect(r.aliases.initiatives).toEqual({ q: 'init_q' });
  });
});

describe('resolveOverrides — warn and skip (§9)', () => {
  it('warns and skips a rule with an invalid glob', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(ctx(REPO), [layer('project', [{ when: { path: '' }, defaultTeam: 'x' }])]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/invalid glob/);
    expect(r.values.defaultTeam).toBeUndefined();
  });

  it('warns and skips a rule with an unsupported when key', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(ctx(REPO), [
      layer('project', [{ when: { bogus: 'x' } as never, defaultTeam: 'y' }]),
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/unsupported/);
    expect(r.values.defaultTeam).toBeUndefined();
  });

  it('warns and skips an unsupported key nested inside a composite', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(ctx(REPO, REPO, { remotes: { origin: ORIGIN } }), [
      layer('project', [{ when: { anyOf: [{ bogus: 'x' }] } as never, defaultTeam: 't' }]),
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/unsupported/);
    expect(r.values.defaultTeam).toBeUndefined();
  });
});

describe('resolveOverrides — glob-metacharacter specificity (D)', () => {
  const withOrigin = ctx(REPO, REPO, { remotes: { origin: ORIGIN } });

  it('treats a `?` repo pattern as a glob, so an exact repo wins regardless of order', () => {
    const r = resolveOverrides(withOrigin, [
      layer('global', [
        { when: { repo: 'acme/web' }, defaultTeam: 'exact' },
        { when: { repo: 'acme/w?b' }, defaultTeam: 'glob' }, // matches acme/web via `?`, declared later
      ]),
    ]);
    expect(r.values.defaultTeam).toBe('exact');
  });

  it('treats a `?` path segment as a wildcard, so a fully-literal path wins', () => {
    const rules: ConfigOverride[] = [
      { when: { path: 'apps/web' }, defaultTeam: 'exact' },
      { when: { path: 'apps/w?b' }, defaultTeam: 'glob' }, // matches apps/web via `?`, declared later
    ];
    const r = resolveOverrides(ctx(`${REPO}/apps/web`), [layer('project', rules)]);
    expect(r.values.defaultTeam).toBe('exact');
  });
});

describe('needsGitContext / resolveOverrides — malformed composite hardening (C)', () => {
  it('needsGitContext does not throw on a non-array allOf or a null not', () => {
    expect(() => needsGitContext([layer('project', [{ when: { allOf: {} } as never }])])).not.toThrow();
    expect(() => needsGitContext([layer('project', [{ when: { not: null } as never }])])).not.toThrow();
    expect(needsGitContext([layer('project', [{ when: { allOf: {} } as never }])])).toBe(false);
  });

  it('warns with an `invalid when` message and skips a non-array allOf, still resolving', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(ctx(REPO), [
      layer('project', [
        { when: { allOf: {} } as never, defaultTeam: 'bad' },
        { when: {}, defaultTeam: 'catch' },
      ]),
    ]);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0][0]).toMatch(/invalid `when/);
    expect(r.values.defaultTeam).toBe('catch');
  });

  it('warns and skips a null `not`, still resolving', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(ctx(REPO), [
      layer('project', [
        { when: { not: null } as never, defaultTeam: 'bad' },
        { when: {}, defaultTeam: 'catch' },
      ]),
    ]);
    expect(warn).toHaveBeenCalled();
    expect(r.values.defaultTeam).toBe('catch');
  });
});

describe('resolveOverrides — identity matching against origin (Phase 2)', () => {
  const withOrigin = ctx(REPO, REPO, { remotes: { origin: ORIGIN } });

  it('matches repo (exact + glob), owner, and host', () => {
    const team = (when: ConfigOverride['when']) =>
      resolveOverrides(withOrigin, [layer('global', [{ when, defaultTeam: 't' }])]).values.defaultTeam;
    expect(team({ repo: 'acme/web' })).toBe('t');
    expect(team({ repo: 'acme/*' })).toBe('t');
    expect(team({ owner: 'acme' })).toBe('t');
    expect(team({ host: 'github.com' })).toBe('t');
  });

  it('does not match on identity mismatch', () => {
    const team = (when: ConfigOverride['when']) =>
      resolveOverrides(withOrigin, [layer('global', [{ when, defaultTeam: 't' }])]).values.defaultTeam;
    expect(team({ repo: 'acme/other' })).toBeUndefined();
    expect(team({ owner: 'other' })).toBeUndefined();
    expect(team({ host: '*.gitlab.com' })).toBeUndefined();
  });

  it('identity criteria fail (not throw) without an origin remote (§9 no remote)', () => {
    const noRemote = ctx(REPO, REPO, { remotes: {} });
    const team = (when: ConfigOverride['when']) =>
      resolveOverrides(noRemote, [layer('global', [{ when, defaultTeam: 't' }])]).values.defaultTeam;
    expect(team({ repo: 'acme/web' })).toBeUndefined();
    expect(team({ owner: 'acme' })).toBeUndefined();
    expect(team({ host: 'github.com' })).toBeUndefined();
  });
});

describe('resolveOverrides — branch matching (Phase 2)', () => {
  const rule: ConfigOverride[] = [{ when: { branch: 'release/*' }, defaultInitiative: 'hardening' }];

  it('matches the current branch', () => {
    const c = ctx(REPO, REPO, { branch: 'release/1.0' });
    expect(resolveOverrides(c, [layer('project', rule)]).values.defaultInitiative).toBe('hardening');
  });

  it('does not match a different branch', () => {
    const c = ctx(REPO, REPO, { branch: 'main' });
    expect(resolveOverrides(c, [layer('project', rule)]).values.defaultInitiative).toBeUndefined();
  });

  it('does not match in detached HEAD (no branch)', () => {
    const c = ctx(REPO, REPO, {}); // branch undefined
    expect(resolveOverrides(c, [layer('project', rule)]).values.defaultInitiative).toBeUndefined();
  });
});

describe('resolveOverrides — identity/path/branch specificity (§5.6)', () => {
  const c = ctx(`${REPO}/cli/x`, REPO, { branch: 'release/1.0', remotes: { origin: ORIGIN } });

  it('repo+path beats owner beats bare path', () => {
    const all = resolveOverrides(c, [
      layer('project', [
        { when: { path: 'cli/**' }, defaultTeam: 'path' },
        { when: { owner: 'acme' }, defaultTeam: 'owner' },
        { when: { repo: 'acme/web', path: 'cli/**' }, defaultTeam: 'repo-path' },
      ]),
    ]);
    expect(all.values.defaultTeam).toBe('repo-path');

    const ownerVsPath = resolveOverrides(c, [
      layer('project', [
        { when: { path: 'cli/**' }, defaultTeam: 'path' },
        { when: { owner: 'acme' }, defaultTeam: 'owner' },
      ]),
    ]);
    expect(ownerVsPath.values.defaultTeam).toBe('owner');
  });

  it('a path criterion outranks a branch criterion', () => {
    const r = resolveOverrides(c, [
      layer('project', [
        { when: { branch: 'release/*' }, defaultTeam: 'branch' },
        { when: { path: 'cli/**' }, defaultTeam: 'path' },
      ]),
    ]);
    expect(r.values.defaultTeam).toBe('path');
  });
});

describe('needsGitContext', () => {
  it('is false for catch-all-only or empty layers', () => {
    expect(needsGitContext([])).toBe(false);
    expect(needsGitContext([layer('project', [{ when: {}, defaultTeam: 'x' }])])).toBe(false);
    expect(needsGitContext([layer('project', [{ defaultTeam: 'x' } as unknown as ConfigOverride])])).toBe(false);
  });

  it('is true when any rule declares a context matcher', () => {
    expect(needsGitContext([layer('project', [{ when: { path: 'cli/**' }, defaultTeam: 'x' }])])).toBe(true);
    expect(needsGitContext([layer('global', [{ when: { owner: 'acme' }, defaultTeam: 'x' }])])).toBe(true);
    expect(needsGitContext([layer('global', [{ when: { branch: 'main' }, defaultTeam: 'x' }])])).toBe(true);
  });

  it('recurses into composites and recognizes the remote qualifier', () => {
    expect(needsGitContext([layer('global', [{ when: { anyOf: [{ owner: 'acme' }] }, defaultTeam: 'x' }])])).toBe(true);
    expect(needsGitContext([layer('global', [{ when: { allOf: [{ branch: 'main' }] }, defaultTeam: 'x' }])])).toBe(true);
    expect(needsGitContext([layer('global', [{ when: { not: { path: 'a/**' } }, defaultTeam: 'x' }])])).toBe(true);
    expect(needsGitContext([layer('global', [{ when: { remote: 'upstream' }, defaultTeam: 'x' }])])).toBe(true);
    // A composite whose children declare no context matcher needs nothing.
    expect(needsGitContext([layer('global', [{ when: { anyOf: [] }, defaultTeam: 'x' }])])).toBe(false);
  });
});

describe('resolveOverrides — boolean composites (Phase 3)', () => {
  const c = ctx(`${REPO}/apps/foo`, REPO, { branch: 'release/1.0', remotes: { origin: ORIGIN } });
  const team = (context: OverrideContext, when: ConfigOverride['when']): string | undefined =>
    resolveOverrides(context, [layer('project', [{ when, defaultTeam: 't' }])]).values.defaultTeam;

  it('allOf requires every child; allOf:[] is vacuously true', () => {
    expect(team(c, { allOf: [{ owner: 'acme' }, { branch: 'release/*' }] })).toBe('t');
    expect(team(c, { allOf: [{ owner: 'acme' }, { branch: 'main' }] })).toBeUndefined();
    expect(team(c, { allOf: [] })).toBe('t');
  });

  it('anyOf needs at least one matching child', () => {
    expect(team(c, { anyOf: [{ owner: 'nope' }, { branch: 'release/*' }] })).toBe('t');
    expect(team(c, { anyOf: [{ owner: 'nope' }, { branch: 'main' }] })).toBeUndefined();
  });

  it('warns and skips an empty anyOf (matches nothing)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(c, [layer('project', [{ when: { anyOf: [] }, defaultTeam: 't' }])]);
    expect(warn).toHaveBeenCalledOnce();
    expect(r.values.defaultTeam).toBeUndefined();
  });

  it('not negates its child (apps/** except apps/sandbox/**)', () => {
    const when = { allOf: [{ path: 'apps/**' }, { not: { path: 'apps/sandbox/**' } }] };
    expect(team(c, when)).toBe('t'); // apps/foo
    const sandbox = ctx(`${REPO}/apps/sandbox/x`, REPO, { remotes: {} });
    expect(team(sandbox, when)).toBeUndefined();
  });

  it('nests leaf + composite: owner acme AND (mobile path OR release branch)', () => {
    const c2 = ctx(`${REPO}/apps/mobile/x`, REPO, { branch: 'main', remotes: { origin: ORIGIN } });
    expect(team(c2, { owner: 'acme', anyOf: [{ path: 'apps/mobile/**' }, { branch: 'release/*' }] })).toBe('t');
  });
});

describe('resolveOverrides — remote qualifier & fork (Phase 3, U9)', () => {
  const FORK = {
    origin: { host: 'github.com', owner: 'myuser', name: 'web' },
    upstream: { host: 'github.com', owner: 'acme', name: 'web' },
  };
  const forkCtx = ctx(REPO, REPO, { remotes: FORK });
  const team = (when: ConfigOverride['when']): string | undefined =>
    resolveOverrides(forkCtx, [layer('global', [{ when, defaultTeam: 't' }])]).values.defaultTeam;

  it('reads origin by default; a named remote / list / "*" on request', () => {
    expect(team({ owner: 'acme' })).toBeUndefined(); // default origin = myuser
    expect(team({ owner: 'myuser' })).toBe('t'); // origin
    expect(team({ remote: 'upstream', owner: 'acme' })).toBe('t'); // upstream
    expect(team({ remote: ['origin', 'upstream'], owner: 'acme' })).toBe('t'); // OR across list
    expect(team({ remote: '*', owner: 'acme' })).toBe('t'); // any remote
  });

  it('a bare remote predicate matches iff that remote exists', () => {
    const init = (when: ConfigOverride['when']) =>
      resolveOverrides(forkCtx, [layer('global', [{ when, defaultInitiative: 'fork' }])]).values.defaultInitiative;
    expect(init({ remote: 'upstream' })).toBe('fork');
    expect(init({ remote: '*' })).toBe('fork'); // any remote exists (incl. origin)
    expect(init({ remote: 'nonexistent' })).toBeUndefined();
  });

  it('fires the fork case via anyOf base-OR-upstream (U9)', () => {
    expect(team({ anyOf: [{ owner: 'acme' }, { remote: 'upstream', owner: 'acme' }] })).toBe('t');
  });
});

describe('resolveOverrides — composite specificity (§5.6)', () => {
  const FORK = {
    origin: { host: 'github.com', owner: 'myuser', name: 'web' },
    upstream: { host: 'github.com', owner: 'acme', name: 'web' },
  };

  it('anyOf contributes its most-specific matching branch (order-independent)', () => {
    const c = ctx(REPO, REPO, { remotes: { origin: ORIGIN } }); // origin = acme/web
    // The anyOf's exact-repo branch wins over a plain owner rule regardless of the
    // order the branches appear in (exercises both arms of maxSpec).
    const ascending = resolveOverrides(c, [
      layer('project', [
        { when: { owner: 'acme' }, defaultTeam: 'owner' },
        { when: { anyOf: [{ owner: 'acme' }, { repo: 'acme/web' }] }, defaultTeam: 'anyOf-exactrepo' },
      ]),
    ]);
    expect(ascending.values.defaultTeam).toBe('anyOf-exactrepo');

    const descending = resolveOverrides(c, [
      layer('project', [
        { when: { owner: 'acme' }, defaultTeam: 'owner' },
        { when: { anyOf: [{ repo: 'acme/web' }, { owner: 'acme' }] }, defaultTeam: 'anyOf-exactrepo' },
      ]),
    ]);
    expect(descending.values.defaultTeam).toBe('anyOf-exactrepo');
  });

  it('origin outranks a non-origin remote on an otherwise-equal score', () => {
    const c = ctx(REPO, REPO, { remotes: FORK });
    const r = resolveOverrides(c, [
      layer('project', [
        { when: { owner: 'myuser' }, defaultTeam: 'origin-owner' }, // via origin (bonus)
        { when: { remote: 'upstream', owner: 'acme' }, defaultTeam: 'upstream-owner' }, // via non-origin
      ]),
    ]);
    expect(r.values.defaultTeam).toBe('origin-owner');
  });

  it('not contributes presence only (loses to a value-tier match)', () => {
    const c = ctx(`${REPO}/apps/foo`, REPO, { remotes: { origin: ORIGIN } });
    const r = resolveOverrides(c, [
      layer('project', [
        { when: { owner: 'acme' }, defaultTeam: 'owner' },
        { when: { not: { path: 'zzz/**' } }, defaultTeam: 'not-only' },
      ]),
    ]);
    expect(r.values.defaultTeam).toBe('owner');
  });
});

// ============================================================================
//  M30 Phase 3 — team-aware matchWhen (additive + gated) + whenIsLocationSpecific
// ============================================================================

describe('matchWhen — team-aware, additive and gated (M30 Phase 3)', () => {
  const teamCtx = (team?: string): OverrideContext => ({
    contextDir: REPO,
    repoRoot: REPO,
    remotes: {},
    team,
  });

  it('matches `{ team }` only when allowTeam is set and ctx.team matches', () => {
    expect(matchWhen({ team: 'team_pay' } as WhenClause, teamCtx('team_pay'), { allowTeam: true }).matched).toBe(true);
    expect(matchWhen({ team: 'team_pay' } as WhenClause, teamCtx('team_other'), { allowTeam: true }).matched).toBe(false);
  });

  it('graceful-fails (no throw, no match) when ctx.team is undefined', () => {
    const r = matchWhen({ team: 'team_pay' } as WhenClause, teamCtx(undefined), { allowTeam: true });
    expect(r.matched).toBe(false);
  });

  it('supports a team glob (compares resolved ids in M1)', () => {
    expect(matchWhen({ team: 'team_*' } as WhenClause, teamCtx('team_pay'), { allowTeam: true }).matched).toBe(true);
  });

  it('recognizes `team` nested in composites under allowTeam', () => {
    const ctx = teamCtx('team_pay');
    const w = (node: object): WhenClause => node as unknown as WhenClause;
    expect(matchWhen(w({ allOf: [{ team: 'team_pay' }] }), ctx, { allowTeam: true }).matched).toBe(true);
    expect(matchWhen(w({ anyOf: [{ team: 'team_nope' }, { team: 'team_pay' }] }), ctx, { allowTeam: true }).matched).toBe(true);
    expect(matchWhen(w({ not: { team: 'team_other' } }), ctx, { allowTeam: true }).matched).toBe(true);
    expect(matchWhen(w({ not: { team: 'team_pay' } }), ctx, { allowTeam: true }).matched).toBe(false);
  });

  it('treats `team` as an UNSUPPORTED key WITHOUT allowTeam (config path)', () => {
    expect(() => matchWhen({ team: 'team_pay' } as WhenClause, teamCtx('team_pay'))).toThrow(/unsupported/);
    // Nested in a composite without allowTeam → still unsupported.
    expect(() => matchWhen({ anyOf: [{ team: 'team_pay' }] } as unknown as WhenClause, teamCtx('team_pay'))).toThrow(/unsupported/);
  });
});

describe('config overrides[] still warn-and-skip a when:{team} rule (config byte-identical)', () => {
  it('a `when: { team }` rule in a config layer is warn-skipped, leaving defaultPrompt unresolved', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    // resolveOverrides is the config path: it calls matchWhen WITHOUT allowTeam.
    const r = resolveOverrides(ctx(REPO, REPO, { remotes: { origin: ORIGIN } }), [
      layer('project', [{ when: { team: 'team_pay' } as never, defaultPrompt: 'p' }]),
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toMatch(/unsupported/);
    expect(r.values.defaultPrompt).toBeUndefined();
  });
});

describe('resolveOverrides — locationCarried tracks the matching arm (M30 fix F)', () => {
  // A mixed anyOf: one LOCATION arm (path) + one non-location arm (branch).
  const mixed: ConfigOverride = {
    when: { anyOf: [{ path: 'apps/mobile/**' }, { branch: 'main' }] },
    defaultPrompt: 'x',
  };

  it('a branch-only match in a mixed anyOf is NOT location-carried (→ general tier)', () => {
    // Non-mobile dir on `main`: only the branch arm fires.
    const r = resolveOverrides(ctx(`${REPO}/services/api`, REPO, { branch: 'main' }), [
      layer('project', [mixed]),
    ]);
    expect(r.values.defaultPrompt).toBe('x');
    expect(r.locations.defaultPrompt.locationCarried).toBe(false);
  });

  it('a path match in the same mixed anyOf IS location-carried (→ location tier)', () => {
    const r = resolveOverrides(ctx(`${REPO}/apps/mobile/x`, REPO, { branch: 'feature' }), [
      layer('project', [mixed]),
    ]);
    expect(r.values.defaultPrompt).toBe('x');
    expect(r.locations.defaultPrompt.locationCarried).toBe(true);
  });

  it('a plain path rule is location-carried; a branch-only rule and a catch-all are not', () => {
    const pathRule = resolveOverrides(ctx(`${REPO}/cli/x`), [
      layer('project', [{ when: { path: 'cli/**' }, defaultPrompt: 'p' }]),
    ]);
    expect(pathRule.locations.defaultPrompt.locationCarried).toBe(true);

    const branchRule = resolveOverrides(ctx(REPO, REPO, { branch: 'main' }), [
      layer('project', [{ when: { branch: 'main' }, defaultPrompt: 'b' }]),
    ]);
    expect(branchRule.locations.defaultPrompt.locationCarried).toBe(false);

    const catchAll = resolveOverrides(ctx(REPO), [
      layer('project', [{ when: {}, defaultPrompt: 'c' }]),
    ]);
    expect(catchAll.locations.defaultPrompt.locationCarried).toBe(false);
  });
});
