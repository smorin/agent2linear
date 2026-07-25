import { Command } from 'commander';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { confirmDestructiveAction } from '../../lib/confirm-destructive.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import { updateProject } from '../../lib/linear-client.js';
import { resolveProject } from '../../lib/project-resolver.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { registerProjectCommands } from './register.js';
import { updateProjectCommand } from './update.js';

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
  return { ...actual, updateProject: vi.fn() };
});
vi.mock('../../lib/project-resolver.js', () => ({
  resolveProject: vi.fn(),
}));
vi.mock('../../lib/workspace-resolver.js', () => ({
  resolveActiveWorkspace: vi.fn(),
}));

const resolution = {
  projectId: 'project-1',
  project: {
    id: 'project-1',
    name: 'Lifecycle project',
    url: 'https://linear.app/project-1',
    state: 'planned',
  },
  resolvedBy: 'id' as const,
  originalInput: 'project-1',
};
const workspace = {
  key: 'conceptm',
  name: 'ConceptM',
  source: 'flag' as const,
};

function registerUpdate(): Command {
  const root = new Command();
  registerProjectCommands(root);
  const group = root.commands.find(command => command.name() === 'project');
  const update = group?.commands.find(command => command.name() === 'update');
  if (!update) throw new Error('project update was not registered');
  return update;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('M33 project lifecycle registration', () => {
  it('[LPL-CMD-PROJ-UPDATE][LPL-OPT-PROJ-TRASH][LPL-OPT-PROJ-UNTRASH][LPL-OPT-PROJ-OUTPUT] registers lifecycle and result controls', () => {
    const flags = registerUpdate().options.map(option => option.flags);
    expect(flags).toEqual(
      expect.arrayContaining([
        '--trash',
        '--untrash',
        '-o, --output <table|json>',
        '--json',
        '-y, --yes',
        '--no-input',
      ])
    );
  });
});

describe('M33 project lifecycle runner', () => {
  function arrange(): string[] {
    vi.mocked(resolveProject).mockResolvedValue(resolution);
    vi.mocked(updateProject).mockResolvedValue(resolution.project);
    vi.mocked(guardWorkspaceForMutation).mockResolvedValue(workspace);
    vi.mocked(resolveActiveWorkspace).mockReturnValue(workspace);
    vi.mocked(confirmDestructiveAction).mockResolvedValue(undefined);
    const stdout: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(value => {
      stdout.push(String(value));
      return true;
    });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return stdout;
  }

  it('[LPL-RULE-PROJ-TRASH-XOR] rejects --trash with --untrash before resolution or mutation', async () => {
    arrange();

    await expect(
      updateProjectCommand('project-1', { trash: true, untrash: true })
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
    expect(resolveProject).not.toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('[LPL-RULE-PROJ-OUTPUT] rejects conflicting JSON/table output before resolution or mutation', async () => {
    arrange();

    await expect(
      updateProjectCommand('project-1', {
        trash: true,
        json: true,
        output: 'table',
        outputSource: 'explicit',
      })
    ).rejects.toMatchObject({ code: 'usage', exitCode: 2 });
    expect(resolveProject).not.toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
  });

  it('[LPL-OPT-PROJ-TRASH][LPL-SAFE-PROJ-TRASH] confirms and sends trashed=true', async () => {
    arrange();

    await updateProjectCommand('project-1', { trash: true, yes: true });

    expect(guardWorkspaceForMutation).toHaveBeenCalledWith({
      json: false,
      yes: true,
      noInput: false,
    });
    expect(confirmDestructiveAction).toHaveBeenCalledOnce();
    expect(updateProject).toHaveBeenCalledWith('project-1', { trashed: true });
  });

  it('[LPL-OPT-PROJ-UNTRASH][LPL-ARG-PROJ-UPDATE-ID] sends trashed=false without destructive confirmation', async () => {
    arrange();

    await updateProjectCommand('project-1', { untrash: true, yes: true });

    expect(confirmDestructiveAction).not.toHaveBeenCalled();
    expect(updateProject).toHaveBeenCalledWith('project-1', { trashed: false });
  });

  it('[LPL-OPT-PROJ-DRYRUN][LPL-OPT-PROJ-JSON] emits a complete JSON plan without prompting or mutating', async () => {
    const stdout = arrange();

    await updateProjectCommand('project-1', {
      trash: true,
      dryRun: true,
      json: true,
      link: ['https://example.com|Example'],
      removeDependency: ['project-2'],
    });

    expect(guardWorkspaceForMutation).not.toHaveBeenCalled();
    expect(confirmDestructiveAction).not.toHaveBeenCalled();
    expect(updateProject).not.toHaveBeenCalled();
    expect(JSON.parse(stdout.join(''))).toMatchObject({
      dryRun: true,
      operation: 'project.update',
      workspace: { name: 'ConceptM' },
      project: { id: 'project-1' },
      updates: { trashed: true },
      ancillary: {
        addLinks: ['https://example.com|Example'],
        removeDependencies: ['project-2'],
      },
    });
  });
});
