import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RemoteIdentity } from './git-context.js';
import { logger } from './logger.js';
import { needsGitContext, type OverrideContext, type OverrideLayer, resolveOverrides } from './overrides.js';
import type { ConfigOverride } from './types.js';

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

  it('still warns+skips the remote qualifier (Phase 3)', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const r = resolveOverrides(ctx(REPO, REPO, { remotes: { origin: ORIGIN } }), [
      layer('project', [{ when: { remote: 'upstream', owner: 'acme' } as never, defaultTeam: 't' }]),
    ]);
    expect(warn).toHaveBeenCalledOnce();
    expect(r.values.defaultTeam).toBeUndefined();
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
});
