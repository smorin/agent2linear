import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAliasCommand } from './clear.js';

const mocks = vi.hoisted(() => ({
  clearAliases: vi.fn(),
}));

vi.mock('../../lib/aliases.js', () => ({
  clearAliases: mocks.clearAliases,
  normalizeEntityType: (value: string) => (value === 'team' ? 'team' : null),
}));
vi.mock('../../lib/output.js', () => ({
  showError: vi.fn(),
  showInfo: vi.fn(),
  showSuccess: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('alias clear dry run', () => {
  it('[RLS-SAFE-DRYRUN] only previews aliases and never reaches the clearing path', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.clearAliases.mockReturnValue({
      success: true,
      count: 1,
      aliases: ['release-candidate'],
    });

    await clearAliasCommand('team', { global: true, dryRun: true });

    expect(mocks.clearAliases).toHaveBeenCalledTimes(1);
    expect(mocks.clearAliases).toHaveBeenCalledWith('team', 'global', { preview: true });
    expect(mocks.clearAliases.mock.calls.every(([, , options]) => options?.preview === true)).toBe(true);
  });
});
