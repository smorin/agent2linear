import { afterEach, describe, expect, it, vi } from 'vitest';

import { syncAliasesCore } from './sync-aliases.js';

const mocks = vi.hoisted(() => ({
  addAlias: vi.fn(),
  listAliases: vi.fn(),
}));

vi.mock('./aliases.js', () => ({
  addAlias: mocks.addAlias,
  listAliases: mocks.listAliases,
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('syncAliasesCore dry runs', () => {
  it.each([
    ['cycle', 'cycles'],
    ['project-status', 'project statuses'],
    ['issue-label', 'issue labels'],
    ['project-label', 'project labels'],
  ] as const)(
    '[RLS-SAFE-DRYRUN] previews %s aliases without writing them',
    async (entityType, entityTypeNamePlural) => {
      vi.spyOn(console, 'log').mockImplementation(() => undefined);
      mocks.listAliases.mockReturnValue({});

      await syncAliasesCore({
        entityType,
        entityTypeName: entityType.replace('-', ' '),
        entityTypeNamePlural,
        entities: [{ id: `${entityType}-1`, name: 'Release candidate' }],
        options: { global: true, dryRun: true },
      });

      expect(mocks.listAliases).toHaveBeenCalledWith(entityType);
      expect(mocks.addAlias).not.toHaveBeenCalled();
    }
  );
});
