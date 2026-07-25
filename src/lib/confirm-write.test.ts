import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsageError } from './cli-error.js';
import { confirmWorkspaceWrite, needsWorkspaceConfirm } from './confirm-write.js';
import type { WorkspaceResolution } from './types.js';

const autoDetected: WorkspaceResolution = { key: 'k', name: 'acme', source: 'auto-detect' };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('needsWorkspaceConfirm', () => {
  it('is TRUE only for an auto-detected mutation in a multi-workspace setup', () => {
    expect(needsWorkspaceConfirm(autoDetected, {}, {}, true)).toBe(true);
  });

  it('is FALSE when -y/--yes is passed', () => {
    expect(needsWorkspaceConfirm(autoDetected, { yes: true }, {}, true)).toBe(false);
  });

  it('is FALSE when confirmAutoDetectedWrites is disabled', () => {
    expect(
      needsWorkspaceConfirm(autoDetected, {}, { confirmAutoDetectedWrites: false }, true)
    ).toBe(false);
  });

  it('is FALSE for a single-workspace setup', () => {
    expect(needsWorkspaceConfirm(autoDetected, {}, {}, false)).toBe(false);
  });

  it('is FALSE for non-auto-detected sources (explicit / legacy / default)', () => {
    for (const source of ['flag', 'legacy', 'default', 'project', 'env'] as const) {
      expect(needsWorkspaceConfirm({ key: 'k', name: 'x', source }, {}, {}, true)).toBe(false);
    }
  });
});

describe('confirmWorkspaceWrite', () => {
  it('is a no-op when confirmation is not needed (single-workspace)', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('should not exit');
    }) as never);
    await expect(confirmWorkspaceWrite(autoDetected, {}, {}, false)).resolves.toBeUndefined();
    expect(exit).not.toHaveBeenCalled();
  });

  it('CMT-SAF-NONTYY fails with usage 2 on non-TTY confirmation instead of exiting internally', async () => {
    const exit = vi.spyOn(process, 'exit');
    await expect(confirmWorkspaceWrite(autoDetected, {}, {}, true)).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('-y/--yes'),
    });
    expect(exit).not.toHaveBeenCalled();
  });

  it('CMT-SAF-IA-NOINPUT/PA-NOINPUT rejects required prompting explicitly', async () => {
    await expect(
      confirmWorkspaceWrite(autoDetected, { noInput: true }, {}, true)
    ).rejects.toBeInstanceOf(UsageError);
    await expect(
      confirmWorkspaceWrite(autoDetected, { noInput: true }, {}, true)
    ).rejects.toMatchObject({
      exitCode: 2,
      message: expect.stringContaining('--no-input'),
    });
  });
});
