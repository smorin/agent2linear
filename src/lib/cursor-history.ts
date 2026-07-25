import { randomUUID as nodeRandomUUID } from 'crypto';
import {
  chmodSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { basename, dirname, join } from 'path';

import { userStateDir } from './xdg-paths.js';

export const CURSOR_HISTORY_MAX_ENTRIES = 1000;
export const CURSOR_HISTORY_LOCK_RETRY_MS = 25;
export const CURSOR_HISTORY_LOCK_TIMEOUT_MS = 2000;
export const CURSOR_HISTORY_LOCK_STALE_MS = 30_000;

const HISTORY_FILENAME = 'cursor-history.json';
const HISTORY_VERSION = 1 as const;
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CursorHistoryResource =
  | 'issue'
  | 'project'
  | 'issue-label'
  | 'project-label'
  | 'issue-comment'
  | 'project-comment';

export interface CursorHistoryWorkspace {
  key: string | null;
  id: string | null;
  name: string | null;
}

export interface CursorHistoryTarget {
  id: string;
  label: string;
}

export type CursorHistoryJsonValue =
  | string
  | number
  | boolean
  | null
  | CursorHistoryJsonValue[]
  | { [key: string]: CursorHistoryJsonValue };

export interface CursorHistoryEntry {
  id: string;
  cursor: string;
  createdAt: string;
  workspace: CursorHistoryWorkspace;
  commandPath: string;
  resource: CursorHistoryResource;
  target: CursorHistoryTarget | null;
  filters: Record<string, CursorHistoryJsonValue>;
  orderBy: string;
  limit: number;
  sourceCommand: string;
  nextCommand: string;
  allRemainingCommand: string;
}

export type CursorHistoryEntryInput = Omit<CursorHistoryEntry, 'id' | 'createdAt'>;

export interface CursorHistoryFile {
  version: typeof HISTORY_VERSION;
  entries: CursorHistoryEntry[];
}

export interface CursorHistoryListOptions {
  limit?: number;
  cursor?: string;
}

export interface CursorHistoryStoreOptions {
  filePath?: string;
  now?: () => Date;
  nowMs?: () => number;
  randomUUID?: () => string;
  sleep?: (milliseconds: number) => Promise<void>;
  retryMs?: number;
  timeoutMs?: number;
  staleMs?: number;
}

interface HistoryLock {
  path: string;
  token: string;
}

export class CursorHistoryCorruptError extends Error {
  readonly path: string;

  constructor(path: string, detail: string) {
    super(`Invalid cursor history at ${path}: ${detail}`);
    this.name = 'CursorHistoryCorruptError';
    this.path = path;
  }
}

export class CursorHistoryLockTimeoutError extends Error {
  readonly path: string;

  constructor(path: string, timeoutMs: number) {
    super(`Timed out after ${timeoutMs}ms waiting for cursor history lock ${path}`);
    this.name = 'CursorHistoryLockTimeoutError';
    this.path = path;
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function fail(path: string, detail: string): never {
  throw new CursorHistoryCorruptError(path, detail);
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  path: string,
  location: string
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(path, `${location} must contain exactly: ${keys.join(', ')}`);
  }
}

function assertNonemptyString(
  value: unknown,
  path: string,
  location: string
): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(path, `${location} must be a nonempty string`);
  }
}

function assertNullableString(
  value: unknown,
  path: string,
  location: string
): asserts value is string | null {
  if (value !== null && (typeof value !== 'string' || value.length === 0)) {
    fail(path, `${location} must be null or a nonempty string`);
  }
}

function assertJsonValue(
  value: unknown,
  path: string,
  location: string
): asserts value is CursorHistoryJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, path, `${location}[${index}]`));
    return;
  }
  if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      assertJsonValue(item, path, `${location}.${key}`);
    }
    return;
  }
  fail(path, `${location} must contain only JSON values`);
}

function validateWorkspace(value: unknown, path: string, location: string): CursorHistoryWorkspace {
  if (!isRecord(value)) {
    fail(path, `${location} must be an object`);
  }
  assertExactKeys(value, ['key', 'id', 'name'], path, location);
  assertNullableString(value.key, path, `${location}.key`);
  assertNullableString(value.id, path, `${location}.id`);
  assertNullableString(value.name, path, `${location}.name`);
  return value as unknown as CursorHistoryWorkspace;
}

function validateTarget(
  value: unknown,
  path: string,
  location: string
): CursorHistoryTarget | null {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    fail(path, `${location} must be null or an object`);
  }
  assertExactKeys(value, ['id', 'label'], path, location);
  assertNonemptyString(value.id, path, `${location}.id`);
  assertNonemptyString(value.label, path, `${location}.label`);
  return value as unknown as CursorHistoryTarget;
}

function validateEntry(value: unknown, path: string, index: number): CursorHistoryEntry {
  const location = `entries[${index}]`;
  if (!isRecord(value)) {
    fail(path, `${location} must be an object`);
  }
  assertExactKeys(
    value,
    [
      'id',
      'cursor',
      'createdAt',
      'workspace',
      'commandPath',
      'resource',
      'target',
      'filters',
      'orderBy',
      'limit',
      'sourceCommand',
      'nextCommand',
      'allRemainingCommand',
    ],
    path,
    location
  );
  assertNonemptyString(value.id, path, `${location}.id`);
  if (!UUID_RE.test(value.id)) {
    fail(path, `${location}.id must be a UUID`);
  }
  assertNonemptyString(value.cursor, path, `${location}.cursor`);
  assertNonemptyString(value.createdAt, path, `${location}.createdAt`);
  try {
    if (new Date(value.createdAt).toISOString() !== value.createdAt) {
      fail(path, `${location}.createdAt must be a UTC ISO 8601 timestamp`);
    }
  } catch {
    fail(path, `${location}.createdAt must be a UTC ISO 8601 timestamp`);
  }
  const workspace = validateWorkspace(value.workspace, path, `${location}.workspace`);
  assertNonemptyString(value.commandPath, path, `${location}.commandPath`);
  const resources: readonly CursorHistoryResource[] = [
    'issue',
    'project',
    'issue-label',
    'project-label',
    'issue-comment',
    'project-comment',
  ];
  if (!resources.includes(value.resource as CursorHistoryResource)) {
    fail(path, `${location}.resource is not supported`);
  }
  const target = validateTarget(value.target, path, `${location}.target`);
  if (!isRecord(value.filters)) {
    fail(path, `${location}.filters must be an object`);
  }
  assertJsonValue(value.filters, path, `${location}.filters`);
  assertNonemptyString(value.orderBy, path, `${location}.orderBy`);
  if (
    !Number.isInteger(value.limit) ||
    (value.limit as number) < 1 ||
    (value.limit as number) > 250
  ) {
    fail(path, `${location}.limit must be an integer from 1 through 250`);
  }
  assertNonemptyString(value.sourceCommand, path, `${location}.sourceCommand`);
  assertNonemptyString(value.nextCommand, path, `${location}.nextCommand`);
  assertNonemptyString(value.allRemainingCommand, path, `${location}.allRemainingCommand`);

  return {
    id: value.id,
    cursor: value.cursor,
    createdAt: value.createdAt,
    workspace,
    commandPath: value.commandPath,
    resource: value.resource as CursorHistoryResource,
    target,
    filters: value.filters as Record<string, CursorHistoryJsonValue>,
    orderBy: value.orderBy,
    limit: value.limit as number,
    sourceCommand: value.sourceCommand,
    nextCommand: value.nextCommand,
    allRemainingCommand: value.allRemainingCommand,
  };
}

function validateHistoryFile(value: unknown, path: string): CursorHistoryFile {
  if (!isRecord(value)) {
    fail(path, 'top level must be an object');
  }
  assertExactKeys(value, ['version', 'entries'], path, 'top level');
  if (value.version !== HISTORY_VERSION) {
    fail(path, `version must be ${HISTORY_VERSION}`);
  }
  if (!Array.isArray(value.entries)) {
    fail(path, 'entries must be an array');
  }
  if (value.entries.length > CURSOR_HISTORY_MAX_ENTRIES) {
    fail(path, `entries must contain at most ${CURSOR_HISTORY_MAX_ENTRIES} records`);
  }
  const entries = value.entries.map((entry, index) => validateEntry(entry, path, index));
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) {
      fail(path, `duplicate entry id ${entry.id}`);
    }
    ids.add(entry.id);
  }
  return { version: HISTORY_VERSION, entries };
}

function compareEntries(left: CursorHistoryEntry, right: CursorHistoryEntry): number {
  const byTime = right.createdAt.localeCompare(left.createdAt);
  return byTime !== 0 ? byTime : left.id.localeCompare(right.id);
}

function emptyHistory(): CursorHistoryFile {
  return { version: HISTORY_VERSION, entries: [] };
}

function readOwnerToken(lockPath: string): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'));
    return isRecord(parsed) && typeof parsed.token === 'string' ? parsed.token : null;
  } catch {
    return null;
  }
}

export function cursorHistoryPath(): string {
  return join(userStateDir(), HISTORY_FILENAME);
}

export class CursorHistoryStore {
  readonly filePath: string;
  private readonly now: () => Date;
  private readonly nowMs: () => number;
  private readonly randomUUID: () => string;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly retryMs: number;
  private readonly timeoutMs: number;
  private readonly staleMs: number;

  constructor(options: CursorHistoryStoreOptions = {}) {
    this.filePath = options.filePath ?? cursorHistoryPath();
    this.now = options.now ?? (() => new Date());
    this.nowMs = options.nowMs ?? Date.now;
    this.randomUUID = options.randomUUID ?? nodeRandomUUID;
    this.sleep =
      options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    this.retryMs = options.retryMs ?? CURSOR_HISTORY_LOCK_RETRY_MS;
    this.timeoutMs = options.timeoutMs ?? CURSOR_HISTORY_LOCK_TIMEOUT_MS;
    this.staleMs = options.staleMs ?? CURSOR_HISTORY_LOCK_STALE_MS;
    if (
      !Number.isFinite(this.retryMs) ||
      this.retryMs <= 0 ||
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs < 0 ||
      !Number.isFinite(this.staleMs) ||
      this.staleMs <= 0
    ) {
      throw new RangeError('cursor history lock timings must be finite positive values');
    }
  }

  read(): CursorHistoryFile {
    try {
      const content = readFileSync(this.filePath, 'utf8');
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'invalid JSON';
        throw new CursorHistoryCorruptError(this.filePath, message);
      }
      const history = validateHistoryFile(parsed, this.filePath);
      return { version: HISTORY_VERSION, entries: [...history.entries].sort(compareEntries) };
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        return emptyHistory();
      }
      throw error;
    }
  }

  list(options: CursorHistoryListOptions = {}): CursorHistoryEntry[] {
    const limit = options.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > CURSOR_HISTORY_MAX_ENTRIES) {
      throw new RangeError(
        `cursor history list limit must be an integer from 1 through ${CURSOR_HISTORY_MAX_ENTRIES}`
      );
    }
    const entries = this.read().entries;
    return entries
      .filter(entry => options.cursor === undefined || entry.cursor === options.cursor)
      .slice(0, limit);
  }

  view(id: string): CursorHistoryEntry | null {
    return this.read().entries.find(entry => entry.id === id) ?? null;
  }

  async append(input: CursorHistoryEntryInput): Promise<CursorHistoryEntry> {
    const candidate: CursorHistoryEntry = {
      ...input,
      id: this.randomUUID(),
      createdAt: this.now().toISOString(),
    };
    const entry = validateEntry(candidate, this.filePath, 0);
    return this.withLock(lock => {
      const history = this.read();
      const entries = [...history.entries, entry]
        .sort(compareEntries)
        .slice(0, CURSOR_HISTORY_MAX_ENTRIES);
      this.writeAtomically({ version: HISTORY_VERSION, entries }, lock);
      return entry;
    });
  }

  async clear(): Promise<number> {
    return this.withLock(lock => {
      const history = this.read();
      this.assertLockOwned(lock);
      try {
        unlinkSync(this.filePath);
        this.fsyncDirectory();
      } catch (error) {
        if (!isNodeError(error, 'ENOENT')) {
          throw error;
        }
      }
      return history.entries.length;
    });
  }

  private ensureStateDirectory(): void {
    const directory = dirname(this.filePath);
    mkdirSync(directory, { recursive: true, mode: DIRECTORY_MODE });
    if (process.platform !== 'win32') {
      chmodSync(directory, DIRECTORY_MODE);
    }
  }

  private async acquireLock(): Promise<HistoryLock> {
    this.ensureStateDirectory();
    const lockPath = `${this.filePath}.lock`;
    const token = this.randomUUID();
    const startedAt = this.nowMs();

    for (;;) {
      try {
        mkdirSync(lockPath, { mode: DIRECTORY_MODE });
        try {
          const ownerPath = join(lockPath, 'owner.json');
          writeFileSync(ownerPath, JSON.stringify({ token }), {
            encoding: 'utf8',
            flag: 'wx',
            mode: FILE_MODE,
          });
          if (process.platform !== 'win32') {
            chmodSync(ownerPath, FILE_MODE);
          }
        } catch (error) {
          rmSync(lockPath, { recursive: true, force: true });
          throw error;
        }
        return { path: lockPath, token };
      } catch (error) {
        if (!isNodeError(error, 'EEXIST')) {
          throw error;
        }
      }

      if (this.lockIsStale(lockPath)) {
        this.recoverStaleLock(lockPath);
        continue;
      }

      const elapsed = this.nowMs() - startedAt;
      if (elapsed >= this.timeoutMs) {
        throw new CursorHistoryLockTimeoutError(lockPath, this.timeoutMs);
      }
      await this.sleep(Math.min(this.retryMs, this.timeoutMs - elapsed));
    }
  }

  private lockIsStale(lockPath: string): boolean {
    try {
      return this.nowMs() - statSync(lockPath).mtimeMs >= this.staleMs;
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        return false;
      }
      throw error;
    }
  }

  private recoverStaleLock(lockPath: string): void {
    const stalePath = `${lockPath}.stale-${this.randomUUID()}`;
    try {
      renameSync(lockPath, stalePath);
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) {
        return;
      }
      throw error;
    }
    rmSync(stalePath, { recursive: true, force: true });
  }

  private assertLockOwned(lock: HistoryLock): void {
    if (readOwnerToken(lock.path) !== lock.token) {
      throw new Error(`Cursor history lock ownership was lost: ${lock.path}`);
    }
  }

  private releaseLock(lock: HistoryLock): void {
    if (readOwnerToken(lock.path) !== lock.token) {
      return;
    }
    const releasePath = `${lock.path}.release-${this.randomUUID()}`;
    try {
      renameSync(lock.path, releasePath);
      rmSync(releasePath, { recursive: true, force: true });
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) {
        throw error;
      }
    }
  }

  private async withLock<T>(operation: (lock: HistoryLock) => T): Promise<T> {
    const lock = await this.acquireLock();
    try {
      this.assertLockOwned(lock);
      return operation(lock);
    } finally {
      this.releaseLock(lock);
    }
  }

  private writeAtomically(history: CursorHistoryFile, lock: HistoryLock): void {
    const directory = dirname(this.filePath);
    const temporaryPath = join(
      directory,
      `.${basename(this.filePath)}.${process.pid}.${this.randomUUID()}.tmp`
    );
    let descriptor: number | null = null;
    try {
      descriptor = openSync(temporaryPath, 'wx', FILE_MODE);
      writeFileSync(descriptor, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      if (process.platform !== 'win32') {
        chmodSync(temporaryPath, FILE_MODE);
      }
      this.assertLockOwned(lock);
      renameSync(temporaryPath, this.filePath);
      if (process.platform !== 'win32') {
        chmodSync(this.filePath, FILE_MODE);
      }
      this.fsyncDirectory();
    } catch (error) {
      if (descriptor !== null) {
        closeSync(descriptor);
      }
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  private fsyncDirectory(): void {
    let descriptor: number | null = null;
    try {
      descriptor = openSync(dirname(this.filePath), 'r');
      fsyncSync(descriptor);
    } catch {
      // Directory fsync is unavailable on some supported filesystems/platforms.
    } finally {
      if (descriptor !== null) {
        closeSync(descriptor);
      }
    }
  }
}
