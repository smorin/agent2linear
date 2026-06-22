import { afterEach, describe, expect, it, vi } from 'vitest';

import { logger } from './logger.js';
import { type OverrideContext, type OverrideLayer, resolveOverrides } from './overrides.js';
import type { ConfigOverride } from './types.js';

const REPO = '/work/acme/web';

function ctx(contextDir: string, repoRoot: string | null = REPO): OverrideContext {
  return { contextDir, repoRoot };
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
});
