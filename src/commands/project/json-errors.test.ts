import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openInBrowser } from '../../lib/browser.js';
import { areCacheWritesSuppressed } from '../../lib/cache-write-policy.js';
import { NotFoundError, RuntimeError, UsageError } from '../../lib/cli-error.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import {
  createProject,
  getFullProjectDetails,
  getProjectByName,
  getProjectRelations,
  validateTeamExists,
} from '../../lib/linear-client.js';
import { resolveProject } from '../../lib/project-resolver.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { createProjectCommand } from './create.js';
import { listProjectDependencies } from './dependencies/list.js';
import { updateProjectCommand } from './update.js';
import { viewProject } from './view.js';

vi.mock('ink', () => ({ render: vi.fn() }));
vi.mock('../../lib/aliases.js', () => ({
  resolveAlias: vi.fn((_: string, value: string) => value),
}));
vi.mock('../../lib/browser.js', () => ({ openInBrowser: vi.fn() }));
vi.mock('../../lib/config.js', () => ({
  getConfig: vi.fn(() => ({ prewarmCacheOnCreate: false })),
}));
vi.mock('../../lib/confirm-write.js', () => ({ guardWorkspaceForMutation: vi.fn() }));
vi.mock('../../lib/file-utils.js', () => ({ readContentFile: vi.fn() }));
vi.mock('../../lib/interaction-policy.js', () => ({ requireInteractiveInput: vi.fn() }));
vi.mock('../../lib/linear-client.js', () => ({
  createExternalLink: vi.fn(),
  createProject: vi.fn(),
  getCurrentUser: vi.fn(),
  getFullProjectDetails: vi.fn(),
  getLinearClient: vi.fn(() => ({})),
  getProjectByName: vi.fn(),
  getProjectRelations: vi.fn(),
  getTemplateById: vi.fn(),
  resolveMemberIdentifier: vi.fn(),
  updateProject: vi.fn(),
  validateInitiativeExists: vi.fn(),
  validateTeamExists: vi.fn(),
}));
vi.mock('../../lib/project-resolver.js', () => ({ resolveProject: vi.fn() }));
vi.mock('../../lib/workspace-resolver.js', () => ({
  resolveActiveWorkspace: vi.fn(() => ({ key: 'conceptm', name: 'ConceptM', source: 'flag' })),
}));
vi.mock('../../ui/components/ProjectForm.js', () => ({ ProjectForm: () => null }));

const resolved = {
  projectId: 'project-1',
  project: {
    id: 'project-1',
    name: 'Project one',
    state: 'started',
    url: 'https://linear.app/project/project-1',
  },
  resolvedBy: 'id' as const,
  originalInput: 'project-1',
};

let stdout: string[];
let logs: unknown[][];

beforeEach(() => {
  vi.clearAllMocks();
  stdout = [];
  logs = [];
  vi.mocked(getProjectByName).mockResolvedValue(false);
  vi.mocked(validateTeamExists).mockResolvedValue({ valid: true, name: 'Team one' });
  vi.mocked(resolveProject).mockResolvedValue(resolved);
  vi.spyOn(process.stdout, 'write').mockImplementation(value => {
    stdout.push(String(value));
    return true;
  });
  vi.spyOn(console, 'log').mockImplementation((...values) => {
    logs.push(values);
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(process, 'exit').mockImplementation(code => {
    throw new Error(`unexpected process.exit(${String(code)})`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M36 named project JSON errors', () => {
  it('[RLS-DIAG-LEVELS] returns successful project JSON creation to the process boundary', async () => {
    vi.mocked(guardWorkspaceForMutation).mockResolvedValue({
      key: 'conceptm',
      name: 'ConceptM',
      source: 'flag',
    });
    vi.mocked(createProject).mockResolvedValue({
      id: 'project-1',
      name: 'Created project',
      url: 'https://linear.app/conceptm/project/project-1',
      state: 'planned',
    });

    await createProjectCommand({
      title: 'Created project',
      team: 'team-1',
      noLead: true,
      json: true,
    });

    expect(process.exit).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-CLEAN] project create --json --dry-run emits its one final JSON result on stdout', async () => {
    vi.mocked(validateTeamExists).mockImplementation(async () => {
      expect(areCacheWritesSuppressed()).toBe(true);
      return { valid: true, name: 'Team one' };
    });

    await createProjectCommand({
      title: 'Dry run project',
      team: 'team-1',
      noLead: true,
      link: ['https://example.com|Example'],
      dependsOn: 'project-2',
      blocks: 'project-3',
      dependency: ['project-4|end|start'],
      dryRun: true,
      json: true,
    });

    expect(logs).toHaveLength(1);
    expect(JSON.parse(String(logs[0][0]))).toMatchObject({
      dryRun: true,
      operation: 'project.create',
      workspace: { name: 'ConceptM', source: 'flag' },
      project: { name: 'Dry run project', teamId: 'team-1' },
      ancillary: {
        links: ['https://example.com|Example'],
        dependsOn: 'project-2',
        blocks: 'project-3',
        dependencies: ['project-4|end|start'],
      },
      validation: { localWrites: false, serverMutation: false },
    });
    expect(resolveActiveWorkspace).toHaveBeenCalledOnce();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('[RLS-SAFE-DRYRUN] rejects browser and interactive dry-runs before side effects', async () => {
    const { render } = await import('ink');

    await expect(createProjectCommand({ web: true, dryRun: true })).rejects.toBeInstanceOf(
      UsageError
    );
    await expect(createProjectCommand({ interactive: true, dryRun: true })).rejects.toBeInstanceOf(
      UsageError
    );

    expect(openInBrowser).not.toHaveBeenCalled();
    expect(render).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] rejects project create --web and --interactive before I/O', async () => {
    await expect(createProjectCommand({ json: true, web: true })).rejects.toBeInstanceOf(
      UsageError
    );
    await expect(createProjectCommand({ json: true, interactive: true })).rejects.toBeInstanceOf(
      UsageError
    );

    expect(getProjectByName).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] turns project-create file failures into a typed JSON error without prose', async () => {
    const { readContentFile } = await import('../../lib/file-utils.js');
    vi.mocked(readContentFile).mockResolvedValue({ success: false, error: 'file unavailable' });

    await expect(
      createProjectCommand({
        title: 'Project title',
        team: 'team-1',
        contentFile: 'missing.md',
        json: true,
      })
    ).rejects.toBeInstanceOf(RuntimeError);

    expect(console.error).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
  });

  it('[RLS-OUT-JSON-ERROR] rejects invalid project dates without process.exit or prose', async () => {
    await expect(
      createProjectCommand({
        title: 'Project title',
        team: 'team-1',
        noLead: true,
        targetDate: 'not-a-date',
        json: true,
      })
    ).rejects.toBeInstanceOf(UsageError);

    await expect(
      updateProjectCommand('project-1', { targetDate: 'not-a-date', json: true })
    ).rejects.toBeInstanceOf(UsageError);

    expect(process.exit).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] throws NotFoundError for absent projects without human prose', async () => {
    vi.mocked(resolveProject).mockResolvedValue(null);

    await expect(viewProject('missing', { json: true })).rejects.toBeInstanceOf(NotFoundError);
    await expect(listProjectDependencies('missing', { json: true })).rejects.toBeInstanceOf(
      NotFoundError
    );

    expect(console.error).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
  });

  it('[RLS-EXIT-HUMAN-NOT-FOUND] gives human project views the same typed exit as JSON', async () => {
    vi.mocked(resolveProject).mockResolvedValue(null);

    await expect(viewProject('missing')).rejects.toMatchObject({
      code: 'not_found',
      exitCode: 3,
    });

    expect(process.exit).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] rethrows project read provider failures without human prose', async () => {
    const providerFailure = new Error('provider unavailable');
    vi.mocked(getFullProjectDetails).mockRejectedValue(providerFailure);
    vi.mocked(getProjectRelations).mockRejectedValue(providerFailure);

    await expect(viewProject('project-1', { json: true })).rejects.toBe(providerFailure);
    await expect(listProjectDependencies('project-1', { json: true })).rejects.toBe(
      providerFailure
    );

    expect(console.error).not.toHaveBeenCalled();
    expect(stdout).toEqual([]);
  });
});
