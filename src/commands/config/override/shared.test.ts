import { describe, expect, it } from 'vitest';

import type { ConfigOverride } from '../../../lib/types.js';
import {
  buildWhenFromFlags,
  parseAlias,
  parseSet,
  resolveSelector,
  serializeRule,
  specificityTag,
} from './shared.js';

describe('parseSet', () => {
  it('parses whitelisted scalar fields', () => {
    expect(parseSet(['defaultTeam=frontend'])).toEqual({ defaultTeam: 'frontend' });
  });

  it('parses multiple pairs', () => {
    expect(parseSet(['defaultTeam=frontend', 'defaultProject=q3'])).toEqual({
      defaultTeam: 'frontend',
      defaultProject: 'q3',
    });
  });

  it('coerces defaultAutoAssignLead booleans, preserving false', () => {
    expect(parseSet(['defaultAutoAssignLead=true'])).toEqual({ defaultAutoAssignLead: true });
    expect(parseSet(['defaultAutoAssignLead=false'])).toEqual({ defaultAutoAssignLead: false });
    expect(parseSet(['defaultAutoAssignLead=no'])).toEqual({ defaultAutoAssignLead: false });
    expect(parseSet(['defaultAutoAssignLead=1'])).toEqual({ defaultAutoAssignLead: true });
  });

  it('rejects a non-boolean defaultAutoAssignLead value', () => {
    expect(() => parseSet(['defaultAutoAssignLead=maybe'])).toThrow(/must be true or false/);
  });

  it('rejects apiKey structurally', () => {
    expect(() => parseSet(['apiKey=lin_api_x'])).toThrow(/cannot set "apiKey"/);
  });

  it('rejects when/aliases/id and any non-whitelisted key', () => {
    expect(() => parseSet(['when={}'])).toThrow(/cannot set "when"/);
    expect(() => parseSet(['aliases=x'])).toThrow(/cannot set "aliases"/);
    expect(() => parseSet(['id=foo'])).toThrow(/cannot set "id"/);
    expect(() => parseSet(['bogus=1'])).toThrow(/cannot set "bogus"/);
  });

  it('rejects a pair with no "="', () => {
    expect(() => parseSet(['defaultTeam'])).toThrow(/expected <key>=<value>/);
  });

  it('rejects an empty key', () => {
    expect(() => parseSet(['=value'])).toThrow(/empty key/);
  });
});

describe('parseAlias', () => {
  it('translates kebab-singular entity to its storage key', () => {
    expect(parseAlias(['team.frontend=team_123'])).toEqual({
      teams: { frontend: 'team_123' },
    });
    expect(parseAlias(['project-status.review=status_42'])).toEqual({
      projectStatuses: { review: 'status_42' },
    });
  });

  it('merges multiple aliases of the same entity', () => {
    expect(parseAlias(['team.a=t1', 'team.b=t2'])).toEqual({
      teams: { a: 't1', b: 't2' },
    });
  });

  it('rejects an unknown entity', () => {
    expect(() => parseAlias(['teams.frontend=team_123'])).toThrow(/unknown alias entity "teams"/);
  });

  it('rejects a malformed pair', () => {
    expect(() => parseAlias(['teamfrontend'])).toThrow(/expected <entity>\.<name>=<id>/);
    expect(() => parseAlias(['team.frontend'])).toThrow(/expected <entity>\.<name>=<id>/);
    expect(() => parseAlias(['team.=team_123'])).toThrow(/expected <entity>\.<name>=<id>/);
  });
});

describe('buildWhenFromFlags', () => {
  it('builds a single-facet leaf', () => {
    expect(buildWhenFromFlags({ whenRepo: 'acme/web' })).toEqual({ repo: 'acme/web' });
    expect(buildWhenFromFlags({ whenBranch: 'release/*' })).toEqual({ branch: 'release/*' });
  });

  it('returns an empty clause when no facet is supplied', () => {
    expect(buildWhenFromFlags({})).toEqual({});
  });

  it('rejects more than one facet (composites are a later phase)', () => {
    expect(() => buildWhenFromFlags({ whenRepo: 'acme/web', whenBranch: 'main' })).toThrow(
      /only one --when-<facet>/
    );
  });

  it('rejects an empty facet value', () => {
    expect(() => buildWhenFromFlags({ whenRepo: '  ' })).toThrow(/--when-repo cannot be empty/);
  });
});

describe('resolveSelector', () => {
  const rules: ConfigOverride[] = [
    { id: 'a', when: { repo: 'acme/web' } },
    { when: { branch: 'main' } },
    { id: 'c', when: {} },
  ];

  it('resolves by label', () => {
    expect(resolveSelector(rules, 'a')).toEqual({ rule: rules[0], index: 0 });
    expect(resolveSelector(rules, 'c')).toEqual({ rule: rules[2], index: 2 });
  });

  it('resolves an unlabeled rule by #index', () => {
    expect(resolveSelector(rules, '#1')).toEqual({ rule: rules[1], index: 1 });
  });

  it('returns undefined for an unknown label', () => {
    expect(resolveSelector(rules, 'nope')).toBeUndefined();
  });

  it('returns undefined for an out-of-range or non-numeric #index', () => {
    expect(resolveSelector(rules, '#9')).toBeUndefined();
    expect(resolveSelector(rules, '#-1')).toBeUndefined();
    expect(resolveSelector(rules, '#x')).toBeUndefined();
  });
});

describe('specificityTag', () => {
  it('tags single-leaf clauses by facet', () => {
    expect(specificityTag({ repo: 'acme/web' })).toBe('exact-repo');
    expect(specificityTag({ owner: 'acme' })).toBe('owner');
    expect(specificityTag({ host: 'github.com' })).toBe('host');
    expect(specificityTag({ path: 'cli/**' })).toBe('path');
    expect(specificityTag({ branch: 'main' })).toBe('branch');
    expect(specificityTag({ remote: 'origin' })).toBe('remote');
    expect(specificityTag({})).toBe('catch-all');
  });
});

describe('serializeRule', () => {
  it('labels a rule by id', () => {
    const rule: ConfigOverride = { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 'frontend' };
    expect(serializeRule(rule, 0)).toEqual({ label: 'a', index: 0, rule });
  });

  it('labels an unlabeled rule by #index', () => {
    const rule: ConfigOverride = { when: { branch: 'main' } };
    expect(serializeRule(rule, 2)).toEqual({ label: '#2', index: 2, rule });
  });
});
