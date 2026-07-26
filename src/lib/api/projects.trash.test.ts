import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLinearClient } from './client.js';
import { updateProject } from './projects.js';

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, getLinearClient: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

const project = {
  id: 'project-1',
  name: 'Lifecycle project',
  url: 'https://linear.app/project-1',
  state: 'planned',
  initiatives: vi.fn().mockResolvedValue({ nodes: [] }),
  teams: vi.fn().mockResolvedValue({ nodes: [] }),
};

describe('M33 project trash API', () => {
  it('[LPL-API-PROJ-TRASH] uses projectArchive with trash=true instead of projectUpdate.trashed', async () => {
    const sdkUpdate = vi.fn();
    const archiveProject = vi.fn().mockResolvedValue({
      success: true,
      entity: project,
    });
    vi.mocked(getLinearClient).mockReturnValue({
      updateProject: sdkUpdate,
      archiveProject,
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await updateProject('project-1', { trashed: true });

    expect(archiveProject).toHaveBeenCalledWith('project-1', { trash: true });
    expect(sdkUpdate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'project-1', name: 'Lifecycle project' });
  });

  it('[LPL-API-PROJ-UNTRASH] uses unarchiveProject instead of projectUpdate.trashed', async () => {
    const sdkUpdate = vi.fn();
    const unarchiveProject = vi.fn().mockResolvedValue({
      success: true,
      entity: project,
    });
    vi.mocked(getLinearClient).mockReturnValue({
      updateProject: sdkUpdate,
      unarchiveProject,
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await updateProject('project-1', { trashed: false });

    expect(unarchiveProject).toHaveBeenCalledWith('project-1');
    expect(sdkUpdate).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'project-1', name: 'Lifecycle project' });
  });
});
