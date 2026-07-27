import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetInvocationContext, setInvocationContext } from '../../lib/invocation-context.js';
import { addAliasCommand } from './add.js';

const mocks = vi.hoisted(() => ({
  addAlias: vi.fn(),
  getMemberByEmail: vi.fn(),
  render: vi.fn(),
  searchMembers: vi.fn(),
}));

vi.mock('ink', () => ({ render: mocks.render }));
vi.mock('../../lib/aliases.js', () => ({
  addAlias: mocks.addAlias,
  normalizeEntityType: (value: string) => (value === 'member' ? 'member' : null),
}));
vi.mock('../../lib/linear-client.js', () => ({
  getMemberByEmail: mocks.getMemberByEmail,
  searchMembers: mocks.searchMembers,
}));
vi.mock('../../ui/components/MemberSelector.js', () => ({ MemberSelector: () => null }));

afterEach(() => {
  resetInvocationContext();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('alias add interactive member selection', () => {
  it('[RLS-SAFE-PROMPTS] rejects --no-input before rendering an ambiguous selection', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mocks.getMemberByEmail.mockResolvedValue(null);
    mocks.searchMembers.mockResolvedValue([
      { id: 'member-1', name: 'Member One', email: 'one@example.com' },
      { id: 'member-2', name: 'Member Two', email: 'two@example.com' },
    ]);
    setInvocationContext({ noInput: true, stdinIsTTY: true });

    await expect(
      addAliasCommand('member', 'example', undefined, {
        email: 'example.com',
        interactive: true,
      })
    ).rejects.toMatchObject({ exitCode: 2, message: expect.stringContaining('--no-input') });

    expect(mocks.render).not.toHaveBeenCalled();
    expect(mocks.addAlias).not.toHaveBeenCalled();
  });
});
