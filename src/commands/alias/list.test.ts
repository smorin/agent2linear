import { describe, expect, it } from 'vitest';

import { aliasSourceLabel } from './list.js';

describe('aliasSourceLabel — alias provenance (H)', () => {
  it('labels an override-sourced alias as `override`, not `global`', () => {
    expect(aliasSourceLabel({ type: 'override' })).toBe('override');
  });

  it('labels project / global / unknown aliases', () => {
    expect(aliasSourceLabel({ type: 'project' })).toBe('project');
    expect(aliasSourceLabel({ type: 'global' })).toBe('global');
    expect(aliasSourceLabel(undefined)).toBe('global');
  });
});
