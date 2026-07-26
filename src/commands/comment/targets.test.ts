import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, UsageError } from '../../lib/cli-error.js';
import { resolveCommentTarget } from './targets.js';

const issue = {
  id: 'issue-1',
  identifier: 'ENG-123',
  title: 'Reconnect safely',
};

const project = {
  id: 'project-1',
  name: 'Backend migration',
  url: 'https://linear.app/project/project-1',
  state: 'planned',
};

describe('resolveCommentTarget', () => {
  it('CMT-ARG-ISSUE-INVALID rejects malformed syntax before resolution IO', async () => {
    const resolveIssue = vi.fn();
    await expect(
      resolveCommentTarget('issue', 'not-an-issue', { resolveIssue, resolveProject: vi.fn() })
    ).rejects.toBeInstanceOf(UsageError);
    expect(resolveIssue).not.toHaveBeenCalled();
  });

  it.each([
    ['ENG-123', 'identifier'],
    ['11111111-1111-4111-8111-111111111111', 'uuid'],
  ] as const)('CMT-ARG-ISSUE-IDENTIFIER/UUID resolves %s with canonical metadata', async (input, resolvedBy) => {
    const resolveIssue = vi.fn(async () => ({
      issueId: issue.id,
      issue,
      resolvedBy,
      originalInput: input,
    }));
    await expect(
      resolveCommentTarget('issue', input, { resolveIssue, resolveProject: vi.fn() })
    ).resolves.toEqual({
      type: 'issue',
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      resolvedBy,
      originalInput: input,
    });
  });

  it('CMT-ARG-ISSUE-NOTFOUND maps a valid missing issue to exit 3', async () => {
    await expect(
      resolveCommentTarget('issue', 'ENG-404', {
        resolveIssue: vi.fn(async () => null),
        resolveProject: vi.fn(),
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it.each(['id', 'alias', 'cache', 'name'] as const)(
    'CMT-ARG-PROJECT-ID/ALIAS/NAME preserves %s resolution provenance',
    async resolvedBy => {
      const resolveProject = vi.fn(async () => ({
        projectId: project.id,
        project,
        resolvedBy,
        originalInput: 'backend',
        ...(resolvedBy === 'alias' ? { usedAlias: 'backend' } : {}),
      }));
      await expect(
        resolveCommentTarget('project', 'backend', { resolveIssue: vi.fn(), resolveProject })
      ).resolves.toEqual({
        type: 'project',
        id: project.id,
        name: project.name,
        resolvedBy,
        originalInput: 'backend',
        ...(resolvedBy === 'alias' ? { usedAlias: 'backend' } : {}),
      });
    }
  );

  it('CMT-ARG-PROJECT-NOTFOUND maps a missing project to exit 3', async () => {
    await expect(
      resolveCommentTarget('project', 'missing', {
        resolveIssue: vi.fn(),
        resolveProject: vi.fn(async () => null),
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('CMT-ARG-PROJECT-AMBIGUOUS detects duplicate exact names after normal resolution', async () => {
    await expect(
      resolveCommentTarget('project', 'Backend migration', {
        resolveIssue: vi.fn(),
        resolveProject: vi.fn(async () => ({
          projectId: project.id,
          project,
          resolvedBy: 'name' as const,
          originalInput: 'Backend migration',
        })),
        findProjectMatches: vi.fn(async () => [
          { id: 'project-1', name: 'Backend migration' },
          { id: 'project-2', name: 'Backend migration' },
        ]),
      })
    ).rejects.toMatchObject({
      exitCode: 5,
      message: expect.stringContaining('project-2'),
    });
  });

  it('CMT-OUT-EXIT-4/1 probes auth/network before classifying swallowed resolver null as not-found', async () => {
    const failure = new Error('authentication failed');
    await expect(
      resolveCommentTarget('project', 'missing', {
        resolveIssue: vi.fn(),
        resolveProject: vi.fn(async () => null),
        assertAuthenticated: vi.fn(async () => { throw failure; }),
      })
    ).rejects.toBe(failure);
  });

  it('CMT-ARG-PROJECT-AMBIGUOUS propagates resolver conflicts without choosing', async () => {
    const conflict = new ConflictError('project name is ambiguous');
    await expect(
      resolveCommentTarget('project', 'backend', {
        resolveIssue: vi.fn(),
        resolveProject: vi.fn(async () => { throw conflict; }),
      })
    ).rejects.toBe(conflict);
  });
});
