import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLinearClient } from './client.js';
import { updateIssue } from './issues.js';

vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, getLinearClient: vi.fn() };
});

afterEach(() => vi.clearAllMocks());

const issue = {
  id: 'issue-1',
  identifier: 'ENG-1',
  title: 'Lifecycle issue',
  url: 'https://linear.app/issue/ENG-1',
};

describe('M36 issue trash API', () => {
  it('[RLS-FIX-ISSUE-TRASH] uses deleteIssue instead of updateIssue.trashed', async () => {
    const sdkUpdate = vi.fn();
    const deleteIssue = vi.fn().mockResolvedValue({ success: true, entity: undefined });
    const getIssue = vi.fn().mockResolvedValue(issue);
    vi.mocked(getLinearClient).mockReturnValue({
      updateIssue: sdkUpdate,
      deleteIssue,
      issue: getIssue,
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await updateIssue('issue-1', { trashed: true });

    expect(deleteIssue).toHaveBeenCalledWith('issue-1');
    expect(sdkUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(issue);
  });

  it('[RLS-FIX-ISSUE-TRASH] uses unarchiveIssue instead of updateIssue.trashed', async () => {
    const sdkUpdate = vi.fn();
    const unarchiveIssue = vi.fn().mockResolvedValue({ success: true, entity: issue });
    vi.mocked(getLinearClient).mockReturnValue({
      updateIssue: sdkUpdate,
      unarchiveIssue,
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await updateIssue('issue-1', { trashed: false });

    expect(unarchiveIssue).toHaveBeenCalledWith('issue-1');
    expect(sdkUpdate).not.toHaveBeenCalled();
    expect(result).toEqual(issue);
  });

  it('[RLS-FIX-ISSUE-TRASH] updates fields before trashing without sending trashed', async () => {
    const updated = { ...issue, title: 'Updated before trash' };
    const sdkUpdate = vi.fn().mockResolvedValue({ issue: updated });
    const deleteIssue = vi.fn().mockResolvedValue({ success: true, entity: undefined });
    vi.mocked(getLinearClient).mockReturnValue({
      updateIssue: sdkUpdate,
      deleteIssue,
      issue: vi.fn(),
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await updateIssue('issue-1', {
      title: 'Updated before trash',
      trashed: true,
    });

    expect(sdkUpdate).toHaveBeenCalledWith('issue-1', expect.any(Object));
    expect(sdkUpdate.mock.calls[0][1]).not.toHaveProperty('trashed');
    expect(sdkUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      deleteIssue.mock.invocationCallOrder[0]
    );
    expect(result).toEqual(updated);
  });

  it('[RLS-FIX-ISSUE-TRASH] untrashes before updating fields without sending trashed', async () => {
    const updated = { ...issue, title: 'Updated after restore' };
    const unarchiveIssue = vi.fn().mockResolvedValue({ success: true, entity: issue });
    const sdkUpdate = vi.fn().mockResolvedValue({ issue: updated });
    vi.mocked(getLinearClient).mockReturnValue({
      updateIssue: sdkUpdate,
      unarchiveIssue,
    } as unknown as ReturnType<typeof getLinearClient>);

    const result = await updateIssue('issue-1', {
      title: 'Updated after restore',
      trashed: false,
    });

    expect(unarchiveIssue.mock.invocationCallOrder[0]).toBeLessThan(
      sdkUpdate.mock.invocationCallOrder[0]
    );
    expect(sdkUpdate).toHaveBeenCalledWith('issue-1', expect.any(Object));
    expect(sdkUpdate.mock.calls[0][1]).not.toHaveProperty('trashed');
    expect(result).toEqual(updated);
  });
});
