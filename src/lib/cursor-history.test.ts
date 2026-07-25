import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CursorHistoryCorruptError,
  type CursorHistoryEntryInput,
  CursorHistoryLockTimeoutError,
  CursorHistoryStore,
} from './cursor-history.js';

const UUIDS = [
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
];

let root: string;
let historyPath: string;

function entry(
  cursor: string,
  overrides: Partial<CursorHistoryEntryInput> = {}
): CursorHistoryEntryInput {
  return {
    cursor,
    workspace: { key: 'abc123', id: null, name: 'ConceptM' },
    commandPath: 'issue list',
    resource: 'issue',
    target: null,
    filters: { team: 'ENG' },
    orderBy: 'createdAt',
    limit: 50,
    sourceCommand: "a2l issue list --team 'ENG'",
    nextCommand: `a2l issue list --after '${cursor}'`,
    allRemainingCommand: `a2l issue list --after '${cursor}' --all`,
    ...overrides,
  };
}

function sequence(values: string[]): () => string {
  let index = 0;
  return () => values[index++] ?? `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'a2l-history-'));
  historyPath = join(root, 'state', 'agent2linear', 'cursor-history.json');
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

describe('CursorHistoryStore schema and primitives', () => {
  it('treats a missing file as empty without creating state', () => {
    const store = new CursorHistoryStore({ filePath: historyPath });
    expect(store.read()).toEqual({ version: 1, entries: [] });
    expect(store.list()).toEqual([]);
    expect(store.view(UUIDS[0])).toBeNull();
    expect(existsSync(dirname(historyPath))).toBe(false);
  });

  it('appends, lists, views, filters, and clears strict version-1 entries', async () => {
    const uuid = sequence(UUIDS);
    let now = new Date('2026-07-24T12:00:00.000Z');
    const store = new CursorHistoryStore({
      filePath: historyPath,
      randomUUID: uuid,
      now: () => now,
    });

    const first = await store.append(entry('cursor-one'));
    now = new Date('2026-07-24T12:01:00.000Z');
    const second = await store.append(entry('cursor-two', { resource: 'project' }));

    expect(store.list()).toEqual([second, first]);
    expect(store.list({ limit: 1 })).toEqual([second]);
    expect(store.list({ cursor: 'cursor-one' })).toEqual([first]);
    expect(store.view(first.id)).toEqual(first);

    const persisted = JSON.parse(readFileSync(historyPath, 'utf8'));
    expect(persisted).toEqual({ version: 1, entries: [second, first] });
    expect(await store.clear()).toBe(2);
    expect(existsSync(historyPath)).toBe(false);
    expect(await store.clear()).toBe(0);
  });

  it('uses timestamp descending and UUID ascending as the deterministic order', async () => {
    const store = new CursorHistoryStore({
      filePath: historyPath,
      randomUUID: sequence([UUIDS[1], UUIDS[3], UUIDS[0], UUIDS[2]]),
      now: () => new Date('2026-07-24T12:00:00.000Z'),
    });
    const secondId = await store.append(entry('cursor-b'));
    const firstId = await store.append(entry('cursor-a'));
    expect(store.list().map(item => item.id)).toEqual([firstId.id, secondId.id].sort());
  });

  it('retains only the newest 1000 entries', async () => {
    const seed = Array.from({ length: 1000 }, (_, index) => ({
      ...entry(`cursor-${index}`),
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      createdAt: new Date(1_700_000_000_000 + index).toISOString(),
    }));
    mkdirSync(dirname(historyPath), { recursive: true });
    writeFileSync(historyPath, JSON.stringify({ version: 1, entries: seed }));
    const store = new CursorHistoryStore({
      filePath: historyPath,
      randomUUID: sequence(['ffffffff-ffff-4fff-8fff-ffffffffffff', ...UUIDS]),
      now: () => new Date('2026-07-24T12:00:00.000Z'),
    });
    const newest = await store.append(entry('newest'));
    const entries = store.list({ limit: 1000 });
    expect(entries).toHaveLength(1000);
    expect(entries[0]).toEqual(newest);
    expect(entries.some(item => item.cursor === 'cursor-0')).toBe(false);
  });

  it('rejects invalid versions, shapes, unknown fields, and malformed entries without rewriting', () => {
    mkdirSync(dirname(historyPath), { recursive: true });
    const invalidFiles = [
      '{',
      JSON.stringify({ version: 2, entries: [] }),
      JSON.stringify({ version: 1, entries: [], extra: true }),
      JSON.stringify({ version: 1, entries: [{ nope: true }] }),
    ];
    const store = new CursorHistoryStore({ filePath: historyPath });
    for (const content of invalidFiles) {
      writeFileSync(historyPath, content);
      expect(() => store.read()).toThrow(CursorHistoryCorruptError);
      expect(readFileSync(historyPath, 'utf8')).toBe(content);
    }
  });

  it('creates owner-only state and file modes where POSIX modes are supported', async () => {
    const store = new CursorHistoryStore({
      filePath: historyPath,
      randomUUID: sequence(UUIDS),
      now: () => new Date('2026-07-24T12:00:00.000Z'),
    });
    await store.append(entry('secure'));
    if (process.platform !== 'win32') {
      expect(statSync(dirname(historyPath)).mode & 0o777).toBe(0o700);
      expect(statSync(historyPath).mode & 0o777).toBe(0o600);
    }
    expect(existsSync(`${historyPath}.lock`)).toBe(false);
    expect(readFileSync(historyPath, 'utf8').includes('lin_api_')).toBe(false);
  });
});

describe('CursorHistoryStore locking', () => {
  it('times out after bounded retries without deleting a live lock', async () => {
    const lockPath = `${historyPath}.lock`;
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ token: UUIDS[3] }));
    let elapsed = 0;
    const store = new CursorHistoryStore({
      filePath: historyPath,
      randomUUID: sequence(UUIDS),
      nowMs: () => elapsed,
      sleep: async milliseconds => {
        elapsed += milliseconds;
      },
      retryMs: 25,
      timeoutMs: 2000,
      staleMs: 30_000,
    });
    await expect(store.append(entry('blocked'))).rejects.toBeInstanceOf(
      CursorHistoryLockTimeoutError
    );
    expect(elapsed).toBe(2000);
    expect(existsSync(lockPath)).toBe(true);
    expect(existsSync(historyPath)).toBe(false);
  });

  it('atomically recovers a stale lock and records successfully', async () => {
    const lockPath = `${historyPath}.lock`;
    mkdirSync(lockPath, { recursive: true });
    writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ token: UUIDS[3] }));
    utimesSync(lockPath, new Date(0), new Date(0));
    const store = new CursorHistoryStore({
      filePath: historyPath,
      randomUUID: sequence(UUIDS),
      now: () => new Date('2026-07-24T12:00:00.000Z'),
      nowMs: () => 100_000,
      staleMs: 30_000,
    });
    await expect(store.append(entry('recovered'))).resolves.toMatchObject({ cursor: 'recovered' });
    expect(existsSync(lockPath)).toBe(false);
    expect(store.list()).toHaveLength(1);
  });
});
