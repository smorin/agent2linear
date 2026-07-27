import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFullProjectDetails, getProjectRelations } from '../../lib/linear-client.js';
import { resolveProject } from '../../lib/project-resolver.js';
import { listProjectDependencies } from './dependencies/list.js';
import { viewProject } from './view.js';

vi.mock('../../lib/browser.js', () => ({ openInBrowser: vi.fn() }));
vi.mock('../../lib/linear-client.js', () => ({
  getFullProjectDetails: vi.fn(),
  getLinearClient: vi.fn(() => ({})),
  getProjectRelations: vi.fn(),
}));
vi.mock('../../lib/project-resolver.js', () => ({ resolveProject: vi.fn() }));

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

beforeEach(() => {
  vi.clearAllMocks();
  stdout = [];
  vi.mocked(resolveProject).mockResolvedValue(resolved);
  vi.spyOn(process.stdout, 'write').mockImplementation(value => {
    stdout.push(String(value));
    return true;
  });
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(process, 'exit').mockImplementation(code => {
    throw new Error(`unexpected process.exit(${String(code)})`);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('M36 project read JSON output', () => {
  it('[RLS-OUT-PROJECT-VIEW] emits one JSON result without human progress', async () => {
    const details = {
      project: resolved.project,
      lastAppliedTemplate: null,
      milestones: [{ id: 'milestone-1', name: 'First' }],
      issues: [{ id: 'issue-1', identifier: 'ENG-1', title: 'First issue' }],
    };
    vi.mocked(getFullProjectDetails).mockResolvedValue(details as never);

    await viewProject('project-1', { json: true });

    expect(JSON.parse(stdout.join(''))).toEqual(details);
    expect(console.log).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-PROJECT-DEPENDENCIES-LIST] emits one filtered JSON result without human progress', async () => {
    vi.mocked(getProjectRelations).mockResolvedValue([
      {
        id: 'relation-depends',
        project: resolved.project,
        relatedProject: { id: 'project-2', name: 'Dependency' },
        anchorType: 'end',
        relatedAnchorType: 'start',
      },
      {
        id: 'relation-blocks',
        project: resolved.project,
        relatedProject: { id: 'project-3', name: 'Blocked' },
        anchorType: 'start',
        relatedAnchorType: 'end',
      },
    ] as never);

    await listProjectDependencies('project-1', { json: true, direction: 'depends-on' });

    expect(JSON.parse(stdout.join(''))).toEqual({
      project: { id: 'project-1', name: 'Project one' },
      dependsOn: [
        {
          id: 'relation-depends',
          direction: 'depends-on',
          project: { id: 'project-2', name: 'Dependency' },
          anchorType: 'end',
          relatedAnchorType: 'start',
        },
      ],
      blocks: [],
    });
    expect(console.log).not.toHaveBeenCalled();
  });
});
