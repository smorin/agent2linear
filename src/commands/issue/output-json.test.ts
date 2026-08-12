import { afterEach, describe, expect, it, vi } from 'vitest';

import { areCacheWritesSuppressed } from '../../lib/cache-write-policy.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import { resolveIssueIdentifier } from '../../lib/issue-resolver.js';
import {
  createIssue,
  getFullIssueById,
  updateIssue,
  validateTeamExists,
} from '../../lib/linear-client.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { createIssueCommand } from './create.js';
import { updateIssueCommand } from './update.js';
import { viewIssue } from './view.js';

vi.mock('../../lib/aliases.js', () => ({ resolveAlias: vi.fn((_type, value) => value) }));
vi.mock('../../lib/config.js', () => ({
  getConfig: vi.fn(() => ({ prewarmCacheOnCreate: false })),
}));
vi.mock('../../lib/confirm-write.js', () => ({ guardWorkspaceForMutation: vi.fn() }));
vi.mock('../../lib/linear-client.js', () => ({
  createIssue: vi.fn(),
  getFullIssueById: vi.fn(),
  updateIssue: vi.fn(),
  validateTeamExists: vi.fn(),
}));
vi.mock('../../lib/issue-resolver.js', () => ({
  resolveIssueIdentifier: vi.fn(),
}));
vi.mock('../../lib/workspace-resolver.js', () => ({
  resolveActiveWorkspace: vi.fn(() => ({ key: 'conceptm', name: 'ConceptM', source: 'flag' })),
}));

const ISSUE_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('M36 issue JSON output contracts', () => {
  it('[RLS-DIAG-LEVELS] returns successful JSON actions to the diagnostic process boundary', async () => {
    vi.mocked(guardWorkspaceForMutation).mockResolvedValue({
      key: 'conceptm',
      name: 'ConceptM',
      source: 'flag',
    });
    vi.mocked(validateTeamExists).mockResolvedValue({ valid: true, name: 'Engineering' });
    vi.mocked(createIssue).mockResolvedValue({
      id: ISSUE_ID,
      identifier: 'ENG-1',
      title: 'Created',
      url: 'https://linear.app/conceptm/issue/ENG-1',
    });
    vi.mocked(getFullIssueById).mockResolvedValue({
      id: ISSUE_ID,
      identifier: 'ENG-1',
      title: 'Existing',
    } as Awaited<ReturnType<typeof getFullIssueById>>);
    vi.mocked(updateIssue).mockResolvedValue({
      id: ISSUE_ID,
      identifier: 'ENG-1',
      title: 'Updated',
      url: 'https://linear.app/conceptm/issue/ENG-1',
    });
    vi.mocked(resolveIssueIdentifier).mockResolvedValue({
      issueId: ISSUE_ID,
      resolvedBy: 'identifier',
      originalInput: 'ENG-1',
    });
    const exit = vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`unexpected process.exit(${String(code)})`);
    });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await createIssueCommand({
      title: 'Created',
      team: 'team-1',
      noAssignee: true,
      json: true,
    });
    await updateIssueCommand(ISSUE_ID, { title: 'Updated', json: true });
    await viewIssue('ENG-1', { json: true });

    expect(exit).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-CLEAN] emits only the dry-run JSON payload for issue create', async () => {
    vi.mocked(validateTeamExists).mockImplementation(async () => {
      expect(areCacheWritesSuppressed()).toBe(true);
      return { valid: true, name: 'Engineering' };
    });
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await createIssueCommand({
      title: 'Dry run issue',
      team: 'team-1',
      noAssignee: true,
      dryRun: true,
      json: true,
    });

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(stdout.mock.calls[0][0]))).toMatchObject({
      dryRun: true,
      operation: 'issue.create',
      workspace: { name: 'ConceptM', source: 'flag' },
      issue: { title: 'Dry run issue', teamId: 'team-1' },
      ancillary: { openInBrowser: false },
      validation: { localWrites: false, serverMutation: false },
    });
    expect(resolveActiveWorkspace).toHaveBeenCalledOnce();
    expect(createIssue).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-CLEAN] emits only the dry-run JSON payload for issue update', async () => {
    vi.mocked(getFullIssueById).mockImplementation(async () => {
      expect(areCacheWritesSuppressed()).toBe(true);
      return {
        id: ISSUE_ID,
        identifier: 'ENG-1',
      } as Awaited<ReturnType<typeof getFullIssueById>>;
    });
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await updateIssueCommand(ISSUE_ID, { title: 'New title', dryRun: true, json: true });

    expect(stdout).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(stdout.mock.calls[0][0]))).toEqual({
      dryRun: true,
      operation: 'issue.update',
      workspace: { name: 'ConceptM', source: 'flag' },
      issue: { id: ISSUE_ID, identifier: 'ENG-1' },
      updates: { title: 'New title' },
      ancillary: { openInBrowser: false },
      validation: { localWrites: false, serverMutation: false },
    });
    expect(updateIssue).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] rejects create --web with JSON before validation I/O', async () => {
    await expect(
      createIssueCommand({ title: 'Invalid output mode', team: 'team-1', web: true, json: true })
    ).rejects.toMatchObject({ code: 'usage' });

    expect(validateTeamExists).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] rejects view --web with JSON before resolution I/O', async () => {
    await expect(viewIssue('ENG-1', { web: true, json: true })).rejects.toMatchObject({
      code: 'usage',
    });

    expect(resolveIssueIdentifier).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] rejects bulk JSON dry-runs before issue I/O', async () => {
    await expect(
      updateIssueCommand(ISSUE_ID, {
        title: 'New title',
        bulk: 'ENG-2',
        dryRun: true,
        json: true,
      })
    ).rejects.toMatchObject({ code: 'usage' });

    expect(getFullIssueById).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] turns local update validation into a silent usage error', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      updateIssueCommand(ISSUE_ID, {
        description: 'inline',
        descriptionFile: 'description.md',
        json: true,
      })
    ).rejects.toMatchObject({ code: 'usage' });

    expect(stderr).not.toHaveBeenCalled();
  });

  it('[RLS-OUT-JSON-ERROR] turns a deep issue-resolution miss into a not-found error', async () => {
    vi.mocked(getFullIssueById).mockResolvedValue(null);

    await expect(
      updateIssueCommand(ISSUE_ID, { title: 'New title', json: true })
    ).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('[RLS-OUT-JSON-ERROR] turns an absent JSON view into a not-found error', async () => {
    vi.mocked(resolveIssueIdentifier).mockResolvedValue(null);

    await expect(viewIssue('ENG-404', { json: true })).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('[RLS-EXIT-HUMAN-NOT-FOUND] gives human issue views the same typed exit as JSON', async () => {
    vi.mocked(resolveIssueIdentifier).mockResolvedValue(null);
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation(code => {
      throw new Error(`unexpected process.exit(${String(code)})`);
    });

    await expect(viewIssue('ENG-404')).rejects.toMatchObject({
      code: 'not_found',
      exitCode: 3,
    });

    expect(exit).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });
});
