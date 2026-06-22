import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('fail-safe ERRORS (exit 1) on a non-TTY stdin when confirmation is required', async () => {
    // vitest stdin is not a TTY, so this exercises the non-interactive branch.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const exit = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('exit:1');
    }) as never);
    await expect(confirmWorkspaceWrite(autoDetected, {}, {}, true)).rejects.toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
  });
});
