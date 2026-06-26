import { describe, expect, it } from 'vitest';

import type { ConfigOverride } from '../../../lib/types.js';
import {
  buildWhenFromFlags,
  hasWhenFlags,
  parseAlias,
  parseSet,
  parseWhenJson,
  resolveSelector,
  serializeRule,
  specificityTag,
  validateWhenJson,
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
    expect(buildWhenFromFlags({ whenRepo: [] })).toEqual({});
  });

  it('ANDs two single-value positive facets as direct leaf keys (no top-level allOf)', () => {
    expect(buildWhenFromFlags({ whenOwner: 'acme', whenBranch: 'main' })).toEqual({
      owner: 'acme',
      branch: 'main',
    });
  });

  it('compiles a comma-list facet into anyOf (OR within a facet)', () => {
    expect(buildWhenFromFlags({ whenRepo: 'acme/web,acme/api' })).toEqual({
      anyOf: [{ repo: 'acme/web' }, { repo: 'acme/api' }],
    });
  });

  it('compiles a repeated facet into anyOf', () => {
    expect(buildWhenFromFlags({ whenRepo: ['acme/web', 'acme/api'] })).toEqual({
      anyOf: [{ repo: 'acme/web' }, { repo: 'acme/api' }],
    });
  });

  it('combines a single-value facet with one OR-list facet on the same node', () => {
    expect(buildWhenFromFlags({ whenBranch: 'main', whenRepo: 'acme/web,acme/api' })).toEqual({
      branch: 'main',
      anyOf: [{ repo: 'acme/web' }, { repo: 'acme/api' }],
    });
  });

  it('collapses a single exclusion to not: { <facet> }', () => {
    expect(buildWhenFromFlags({ whenRepo: 'acme/web', whenNotBranch: 'wip' })).toEqual({
      repo: 'acme/web',
      not: { branch: 'wip' },
    });
  });

  it('collapses multiple exclusions to not: { anyOf: [...] } (De Morgan)', () => {
    expect(
      buildWhenFromFlags({ whenRepo: 'acme/web', whenNotBranch: 'wip', whenNotOwner: 'legacy' })
    ).toEqual({
      // Exclusions accumulate in facet-precedence order (owner before branch).
      repo: 'acme/web',
      not: { anyOf: [{ owner: 'legacy' }, { branch: 'wip' }] },
    });
  });

  it('collapses a comma-list exclusion into the single not anyOf', () => {
    expect(buildWhenFromFlags({ whenRepo: 'acme/web', whenNotBranch: 'wip,draft' })).toEqual({
      repo: 'acme/web',
      not: { anyOf: [{ branch: 'wip' }, { branch: 'draft' }] },
    });
  });

  it('allows a negative-only rule (the not is itself a criterion)', () => {
    expect(buildWhenFromFlags({ whenNotRepo: 'acme/legacy' })).toEqual({
      not: { repo: 'acme/legacy' },
    });
  });

  it('rejects 2+ positive OR-lists with a copy-pasteable --when-json', () => {
    let thrown: Error | undefined;
    try {
      buildWhenFromFlags({ whenRepo: 'a,b', whenOwner: 'c,d' });
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeDefined();
    expect(thrown?.message).toMatch(/use --when-json/);
    // The suggested JSON must itself be valid and express AND-of-ORs.
    const suggested = thrown?.message.match(/--when-json '(.+)'/)?.[1];
    expect(suggested).toBeDefined();
    expect(JSON.parse(suggested!)).toEqual({
      allOf: [
        { anyOf: [{ repo: 'a' }, { repo: 'b' }] },
        { anyOf: [{ owner: 'c' }, { owner: 'd' }] },
      ],
    });
  });

  it('rejects an empty facet value', () => {
    expect(() => buildWhenFromFlags({ whenRepo: '  ' })).toThrow(/--when-repo cannot be empty/);
    expect(() => buildWhenFromFlags({ whenRepo: 'a,,b' })).toThrow(/--when-repo cannot be empty/);
  });
});

describe('hasWhenFlags', () => {
  it('is false for no flags and for empty arrays (commander defaults)', () => {
    expect(hasWhenFlags({})).toBe(false);
    expect(hasWhenFlags({ whenRepo: [], whenNotBranch: [] })).toBe(false);
  });

  it('is true when any positive or negative facet is supplied', () => {
    expect(hasWhenFlags({ whenRepo: 'acme/web' })).toBe(true);
    expect(hasWhenFlags({ whenNotBranch: ['wip'] })).toBe(true);
  });
});

describe('validateWhenJson / parseWhenJson', () => {
  it('accepts the empty catch-all {}', () => {
    expect(validateWhenJson({})).toEqual({});
    expect(parseWhenJson('{}')).toEqual({});
  });

  it('round-trips a nested anyOf tree', () => {
    const tree = { anyOf: [{ path: 'cli/**' }, { branch: 'main' }] };
    expect(parseWhenJson(JSON.stringify(tree))).toEqual(tree);
  });

  it('round-trips allOf / not composites', () => {
    const tree = { allOf: [{ repo: 'acme/web' }], not: { branch: 'wip' } };
    expect(validateWhenJson(tree)).toEqual(tree);
  });

  it('accepts a remote list and "*"', () => {
    expect(validateWhenJson({ remote: ['origin', 'upstream'] })).toEqual({
      remote: ['origin', 'upstream'],
    });
    expect(validateWhenJson({ remote: '*' })).toEqual({ remote: '*' });
  });

  it('rejects an unknown when key (recursively) — incl. the prompt-only team', () => {
    expect(() => validateWhenJson({ team: 'eng' })).toThrow(/unsupported `when` key "team"/);
    expect(() => validateWhenJson({ anyOf: [{ bogus: 'x' }] })).toThrow(/unsupported `when` key "bogus"/);
    expect(() => validateWhenJson({ not: { team: 'eng' } })).toThrow(/unsupported `when` key "team"/);
  });

  it('rejects a non-object', () => {
    expect(() => validateWhenJson([])).toThrow(/must be a JSON object/);
    expect(() => validateWhenJson(null)).toThrow(/must be a JSON object/);
    expect(() => validateWhenJson('cli/**')).toThrow(/must be a JSON object/);
  });

  it('rejects an empty/blank leaf glob', () => {
    expect(() => validateWhenJson({ path: '' })).toThrow(/non-empty glob/);
    expect(() => validateWhenJson({ repo: '   ' })).toThrow(/non-empty glob/);
  });

  it('rejects allOf/anyOf that are not arrays', () => {
    expect(() => validateWhenJson({ anyOf: { repo: 'x' } })).toThrow(/must be an array/);
  });

  it('rejects never-matching empty anyOf / empty not, but allows vacuous allOf', () => {
    expect(() => validateWhenJson({ anyOf: [] })).toThrow(/`when.anyOf` cannot be empty/);
    expect(() => validateWhenJson({ not: {} })).toThrow(/`when.not` cannot be empty/);
    // allOf: [] is vacuous-true (a catch-all like {}), so it is allowed.
    expect(validateWhenJson({ allOf: [] })).toEqual({ allOf: [] });
  });

  it('reports a clear error for malformed JSON', () => {
    expect(() => parseWhenJson('{not json')).toThrow(/invalid --when-json/);
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

  it('classifies a composite by its most-specific positive leaf, ignoring not', () => {
    // anyOf of repo + branch → the repo leaf wins the tag.
    expect(specificityTag({ anyOf: [{ branch: 'main' }, { repo: 'acme/web' }] })).toBe('exact-repo');
    // path AND'd with a branch leaf → path is more specific.
    expect(specificityTag({ allOf: [{ branch: 'main' }], path: 'cli/**' })).toBe('path');
    // a not-only rule has no positive leaf → catch-all.
    expect(specificityTag({ not: { repo: 'acme/legacy' } })).toBe('catch-all');
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
