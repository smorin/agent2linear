import { existsSync, writeFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

import { type CursorHistoryEntryInput, CursorHistoryStore } from './cursor-history.js';

const enabled = process.env.A2L_CURSOR_HISTORY_CONCURRENCY_WORKER === '1';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required worker environment variable ${name}`);
  }
  return value;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForStart(path: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!existsSync(path)) {
    if (Date.now() >= deadline) {
      throw new Error(`timed out waiting for concurrency start barrier ${path}`);
    }
    await delay(20);
  }
}

describe.skipIf(!enabled)('CursorHistoryStore multiprocess worker', () => {
  it('signals readiness and appends one unique entry after the shared start barrier', async () => {
    const historyPath = requiredEnv('A2L_CURSOR_HISTORY_PATH');
    const barrierPrefix = requiredEnv('A2L_CURSOR_HISTORY_BARRIER');
    const workerId = requiredEnv('A2L_CURSOR_HISTORY_WORKER_ID');
    const readyPath = `${barrierPrefix}.${workerId}.ready`;
    const startPath = `${barrierPrefix}.start`;

    writeFileSync(readyPath, workerId, { flag: 'wx' });
    await waitForStart(startPath, 20_000);

    const cursor = `cursor-${workerId}`;
    const input: CursorHistoryEntryInput = {
      cursor,
      workspace: { key: null, id: null, name: null },
      commandPath: 'issue list',
      resource: 'issue',
      target: null,
      filters: { worker: workerId },
      orderBy: 'createdAt',
      limit: 50,
      sourceCommand: `a2l issue list --worker '${workerId}'`,
      nextCommand: `a2l issue list --worker '${workerId}' --after '${cursor}'`,
      allRemainingCommand: `a2l issue list --worker '${workerId}' --after '${cursor}' --all`,
    };

    const appended = await new CursorHistoryStore({ filePath: historyPath }).append(input);
    expect(appended.cursor).toBe(cursor);
  }, 30_000);
});
