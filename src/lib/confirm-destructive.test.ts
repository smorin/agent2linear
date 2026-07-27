import { afterEach, describe, expect, it, vi } from 'vitest';

import { UsageError } from './cli-error.js';
import { confirmDestructiveAction } from './confirm-destructive.js';
import { resetInvocationContext, setInvocationContext } from './invocation-context.js';

const originalIsTTY = process.stdin.isTTY;

afterEach(() => {
  resetInvocationContext();
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

  it('[RLS-SAFE-PROMPTS] keeps --yes consent distinct from --no-input policy', async () => {
    const prompt = vi.fn();
    setInvocationContext({ noInput: true });

    await expect(
      confirmDestructiveAction('delete label', { yes: true, noInput: true }, { prompt })
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

  it('honors global --no-input before invoking the prompt dependency', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    setInvocationContext({ noInput: true });
    const prompt = vi.fn();
    await expect(confirmDestructiveAction('delete label', {}, { prompt })).rejects.toMatchObject({
      exitCode: 2,
    });
    expect(prompt).not.toHaveBeenCalled();
  });

  it('[LPL-SAF-CONFIRM-DECLINE] reports a typed cancellation without mutating', async () => {
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    await expect(
      confirmDestructiveAction('delete label', {}, { prompt: vi.fn().mockResolvedValue(false) })
    ).resolves.toMatchObject({ confirmed: false });
  });
});
