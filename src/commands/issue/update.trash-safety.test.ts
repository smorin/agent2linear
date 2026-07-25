import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { confirmDestructiveAction } from '../../lib/confirm-destructive.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import { getFullIssueById, updateIssue } from '../../lib/linear-client.js';
import { registerIssueCommands } from './register.js';
import { updateIssueCommand } from './update.js';

vi.mock('../../lib/confirm-destructive.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/confirm-destructive.js')>(
    '../../lib/confirm-destructive.js'
  );
  return { ...actual, confirmDestructiveAction: vi.fn() };
});
vi.mock('../../lib/confirm-write.js', () => ({
  guardWorkspaceForMutation: vi.fn(),
}));
vi.mock('../../lib/linear-client.js', async () => {
  const actual = await vi.importActual<typeof import('../../lib/linear-client.js')>(
    '../../lib/linear-client.js'
  );
  return {
    ...actual,
    getFullIssueById: vi.fn(),
    updateIssue: vi.fn(),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('M33 issue trash shared confirmation regression', () => {
  it('[LPL-TST-ISSUE-TRASH] registers --no-input alongside existing --yes', () => {
    const root = new Command();
    registerIssueCommands(root);
    const issue = root.commands.find(command => command.name() === 'issue');
    const update = issue?.commands.find(command => command.name() === 'update');
    const flags = update?.options.map(option => option.flags) ?? [];

    expect(flags).toEqual(expect.arrayContaining(['-y, --yes', '--no-input']));
  });

  it('[LPL-SAFE-PROJ-TRASH] routes issue --trash through the shared destructive helper before mutation', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    vi.mocked(getFullIssueById).mockResolvedValue({
      id: uuid,
      identifier: 'ENG-1',
      title: 'Trash safety',
    } as Awaited<ReturnType<typeof getFullIssueById>>);
    vi.mocked(updateIssue).mockResolvedValue({
      id: uuid,
      identifier: 'ENG-1',
      title: 'Trash safety',
      url: 'https://linear.app/conceptm/issue/ENG-1',
    } as Awaited<ReturnType<typeof updateIssue>>);
    vi.mocked(guardWorkspaceForMutation).mockResolvedValue({
      key: 'conceptm',
      name: 'ConceptM',
      source: 'flag',
    });
    vi.mocked(confirmDestructiveAction).mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await updateIssueCommand(uuid, { trash: true, yes: true });

    expect(confirmDestructiveAction).toHaveBeenCalledWith(expect.stringContaining(uuid), {
      yes: true,
      noInput: false,
    });
    expect(updateIssue).toHaveBeenCalledWith(uuid, { trashed: true });
  });
});
