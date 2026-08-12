import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CursorHistoryStore } from './cursor-history.js';
import { buildCursorCommands, recordCursorContinuation } from './cursor-history-adapter.js';

let root: string;
let store: CursorHistoryStore;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'a2l-history-adapter-'));
  store = new CursorHistoryStore({
    filePath: join(root, 'state', 'agent2linear', 'cursor-history.json'),
  });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('cursor history adopter', () => {
  it('CPH-HIS-SAFE-COMMAND reconstructs shell-safe source, next, and all commands', () => {
    const commands = buildCursorCommands({
      commandPath: ['issue', 'list'],
      options: [{ flag: '--team', value: "core team's" }, { flag: '--all-assignees' }],
      limit: 25,
      startingAfter: 'old cursor',
      emittedCursor: "next'cursor",
    });
    expect(commands).toEqual({
      sourceCommand:
        "a2l issue list --team 'core team'\"'\"'s' --all-assignees --limit '25' --after 'old cursor'",
      nextCommand:
        "a2l issue list --team 'core team'\"'\"'s' --all-assignees --limit '25' --after 'next'\"'\"'cursor'",
      allRemainingCommand:
        "a2l issue list --team 'core team'\"'\"'s' --all-assignees --after 'next'\"'\"'cursor' --all",
    });
  });

  it('[CPH-HIS-SECRET-BAN] rejects secret-bearing command flags before rendering', () => {
    expect(() =>
      buildCursorCommands({
        commandPath: ['issue', 'list'],
        options: [{ flag: '--api-key', value: 'lin_api_do-not-store' }],
        limit: 50,
        emittedCursor: 'cursor',
      })
    ).toThrow(/sensitive/i);

    expect(() =>
      buildCursorCommands({
        commandPath: ['issue', 'list'],
        options: [{ flag: '--api-key-file', value: '/private/keys/linear' }],
        limit: 50,
        emittedCursor: 'cursor',
      })
    ).toThrow(/sensitive/i);
  });

  it('[CPH-HIS-SECRET-BAN] refuses unsafe structured context without writing history', async () => {
    const append = vi.fn();
    const unsafe = {
      ...baseEntry(),
      filters: { apiKey: 'lin_api_do-not-store' },
    };

    const result = await recordCursorContinuation({
      disabled: false,
      pageInfo: { returnedCount: 1, hasNextPage: true, endCursor: 'cursor', fetchedAll: false },
      storeFactory: () => ({ append }) as never,
      entry: unsafe,
    });

    expect(result).toMatchObject({ status: 'failed', entryId: null });
    expect(append).not.toHaveBeenCalled();
  });

  it('[CPH-HIS-RAW-ARGV-BAN] never reads or persists raw process argv', async () => {
    const original = process.argv;
    process.argv = ['node', 'a2l', '--api-key', 'lin_api_raw_argv_secret'];
    try {
      const result = await recordCursorContinuation({
        disabled: false,
        pageInfo: { returnedCount: 1, hasNextPage: true, endCursor: 'cursor', fetchedAll: false },
        storeFactory: () => store,
        entry: baseEntry(),
      });
      expect(result.status).toBe('recorded');
      expect(JSON.stringify(store.read())).not.toContain('lin_api_raw_argv_secret');
    } finally {
      process.argv = original;
    }
  });

  it('[CPH-HIS-RAW-ARGV-BAN] rejects a key-file path embedded in reconstructed commands', async () => {
    const append = vi.fn();
    const unsafe = baseEntry();
    unsafe.commands.sourceCommand = 'a2l issue list --api-key-file /private/keys/linear';

    const result = await recordCursorContinuation({
      disabled: false,
      pageInfo: { returnedCount: 1, hasNextPage: true, endCursor: 'cursor', fetchedAll: false },
      storeFactory: () => ({ append }) as never,
      entry: unsafe,
    });

    expect(result).toMatchObject({ status: 'failed', entryId: null });
    expect(append).not.toHaveBeenCalled();
  });

  it('CPH-HIS-NO-RECORD-COMPLETE does not construct or write a store', async () => {
    const storeFactory = vi.fn(() => store);
    await expect(
      recordCursorContinuation({
        disabled: false,
        pageInfo: { returnedCount: 1, hasNextPage: false, endCursor: null, fetchedAll: true },
        storeFactory,
        entry: baseEntry(),
      })
    ).resolves.toEqual({ status: 'not_applicable', entryId: null });
    expect(storeFactory).not.toHaveBeenCalled();
  });

  it('CPH-HIS-NO-RECORD-DISABLED performs no history access', async () => {
    const storeFactory = vi.fn(() => store);
    await expect(
      recordCursorContinuation({
        disabled: true,
        pageInfo: { returnedCount: 1, hasNextPage: true, endCursor: 'cursor', fetchedAll: false },
        storeFactory,
        entry: baseEntry(),
      })
    ).resolves.toEqual({ status: 'disabled', entryId: null });
    expect(storeFactory).not.toHaveBeenCalled();
  });

  it('CPH-HIS-RECORD-CONDITION records a nonempty continuation and returns its ID', async () => {
    const result = await recordCursorContinuation({
      disabled: false,
      pageInfo: { returnedCount: 1, hasNextPage: true, endCursor: 'cursor', fetchedAll: false },
      storeFactory: () => store,
      entry: baseEntry(),
    });
    expect(result.status).toBe('recorded');
    expect(result.entryId).toMatch(/^[0-9a-f-]{36}$/);
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0].cursor).toBe('cursor');
  });

  it('CPH-HIS-WRITE-FAILURE returns failed without hiding the remote result', async () => {
    const error = new Error('disk full');
    await expect(
      recordCursorContinuation({
        disabled: false,
        pageInfo: { returnedCount: 1, hasNextPage: true, endCursor: 'cursor', fetchedAll: false },
        storeFactory: () =>
          ({
            append: async () => {
              throw error;
            },
          }) as never,
        entry: baseEntry(),
      })
    ).resolves.toEqual({ status: 'failed', entryId: null, error });
  });
});

function baseEntry() {
  return {
    workspace: { key: 'safe-hash', id: null, name: 'ConceptM' },
    commandPath: 'issue list',
    resource: 'issue' as const,
    target: null,
    filters: { team: 'ENG' },
    orderBy: 'priority desc',
    limit: 50,
    commands: buildCursorCommands({
      commandPath: ['issue', 'list'],
      options: [{ flag: '--team', value: 'ENG' }],
      limit: 50,
      emittedCursor: 'cursor',
    }),
  };
}
