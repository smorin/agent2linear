import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsageError } from './cli-error.js';
import { confirmDestructiveAction } from './confirm-destructive.js';

const originalIsTTY = process.stdin.isTTY;

afterEach(() => {
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: originalIsTTY });
  vi.restoreAllMocks();
});

describe('confirmDestructiveAction', () => {
  it('[LPL-SAF-CONFIRM-YES] bypasses prompting only with explicit consent', async () => {
    const prompt = vi.fn();
    await expect(
      confirmDestructiveAction('delete label', { yes: true }, { prompt })
    ).resolves.toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
  });

  it('[LPL-SAF-CONFIRM-NONTYY][LPL-SAF-NOHANG] rejects non-TTY input instead of opening a prompt', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false });
    const prompt = vi.fn();
    await expect(confirmDestructiveAction('delete label', {}, { prompt })).rejects.toBeInstanceOf(
      UsageError
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('[LPL-SAF-CONFIRM-NOINPUT] rejects required consent under --no-input', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    await expect(
      confirmDestructiveAction('retire label', { noInput: true })
    ).rejects.toBeInstanceOf(UsageError);
  });

  it('[LPL-SAF-CONFIRM-DECLINE] reports a typed cancellation without mutating', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    await expect(
      confirmDestructiveAction('delete label', {}, { prompt: vi.fn().mockResolvedValue(false) })
    ).resolves.toMatchObject({ confirmed: false });
  });
});
