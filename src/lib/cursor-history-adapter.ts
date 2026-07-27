import {
  type CursorHistoryEntryInput,
  type CursorHistoryJsonValue,
  type CursorHistoryResource,
  CursorHistoryStore,
  type CursorHistoryTarget,
  type CursorHistoryWorkspace,
} from './cursor-history.js';
import type { PageInfo } from './pagination.js';
import { quotePosixShellArg } from './shell-quote.js';

const COMMAND_TOKEN_RE = /^[a-z][a-z0-9-]*$/;
const OPTION_FLAG_RE = /^--[a-z][a-z0-9-]*$/;
const SENSITIVE_OPTION_FLAGS = new Set([
  '--api-key',
  '--api-key-file',
  '--authorization',
  '--credential',
  '--credentials',
  '--env',
  '--env-file',
  '--header',
  '--headers',
  '--key-file',
  '--password',
  '--secret',
  '--token',
]);
const SENSITIVE_FIELD_RE =
  /(?:apiKey|accessToken|authToken|token|secret|password|authorization|credentials?|headers?|envFile|keyFile)/i;
const LINEAR_API_KEY_RE = /lin_api_[A-Za-z0-9_-]{6,}/i;

export interface CanonicalCommandOption {
  flag: string;
  value?: string | number;
}

export interface CursorCommandInput {
  commandPath: string[];
  options?: CanonicalCommandOption[];
  limit: number;
  startingAfter?: string;
  emittedCursor: string;
}

export interface CursorCommands {
  sourceCommand: string;
  nextCommand: string;
  allRemainingCommand: string;
}

export type CursorHistoryStatus = 'recorded' | 'disabled' | 'not_applicable' | 'failed';

export interface CursorHistoryResult {
  status: CursorHistoryStatus;
  entryId: string | null;
  error?: unknown;
}

export interface CursorHistoryRecordEntry {
  workspace: CursorHistoryWorkspace;
  commandPath: string;
  resource: CursorHistoryResource;
  target: CursorHistoryTarget | null;
  filters: Record<string, CursorHistoryJsonValue>;
  orderBy: string;
  limit: number;
  commands: CursorCommands;
}

export interface RecordCursorContinuationInput {
  disabled: boolean;
  pageInfo: PageInfo;
  entry: CursorHistoryRecordEntry;
  storeFactory?: () => Pick<CursorHistoryStore, 'append'>;
}

function renderBase(input: CursorCommandInput): string[] {
  if (input.commandPath.length === 0) {
    throw new TypeError('command path must not be empty');
  }
  for (const token of input.commandPath) {
    if (!COMMAND_TOKEN_RE.test(token)) {
      throw new TypeError(`unsafe command path token: ${token}`);
    }
  }

  const rendered = ['a2l', ...input.commandPath];
  for (const option of input.options ?? []) {
    if (!OPTION_FLAG_RE.test(option.flag)) {
      throw new TypeError(`unsafe command option flag: ${option.flag}`);
    }
    if (SENSITIVE_OPTION_FLAGS.has(option.flag)) {
      throw new TypeError(
        `sensitive command option is not allowed in cursor history: ${option.flag}`
      );
    }
    rendered.push(option.flag);
    if (option.value !== undefined) {
      rendered.push(quotePosixShellArg(String(option.value)));
    }
  }
  return rendered;
}

export function buildCursorCommands(input: CursorCommandInput): CursorCommands {
  if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 250) {
    throw new RangeError('cursor command limit must be an integer from 1 through 250');
  }
  if (input.emittedCursor.length === 0) {
    throw new TypeError('emitted cursor must not be empty');
  }
  if (input.startingAfter !== undefined && input.startingAfter.length === 0) {
    throw new TypeError('starting cursor must not be empty');
  }

  const base = renderBase(input);
  const withLimit = [...base, '--limit', quotePosixShellArg(String(input.limit))];
  const source = [...withLimit];
  if (input.startingAfter !== undefined) {
    source.push('--after', quotePosixShellArg(input.startingAfter));
  }

  return {
    sourceCommand: source.join(' '),
    nextCommand: [...withLimit, '--after', quotePosixShellArg(input.emittedCursor)].join(' '),
    allRemainingCommand: [
      ...base,
      '--after',
      quotePosixShellArg(input.emittedCursor),
      '--all',
    ].join(' '),
  };
}

function assertNoSensitiveJson(value: CursorHistoryJsonValue, path: string): void {
  if (typeof value === 'string') {
    if (LINEAR_API_KEY_RE.test(value) || /^Bearer\s+/i.test(value)) {
      throw new TypeError(`sensitive value is not allowed in cursor history at ${path}`);
    }
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveJson(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_FIELD_RE.test(key)) {
      throw new TypeError(`sensitive field is not allowed in cursor history: ${path}.${key}`);
    }
    assertNoSensitiveJson(item, `${path}.${key}`);
  }
}

function assertSafeHistoryEntry(entry: CursorHistoryRecordEntry): void {
  if (entry.workspace.key && LINEAR_API_KEY_RE.test(entry.workspace.key)) {
    throw new TypeError('raw API key is not allowed as cursor-history workspace context');
  }
  assertNoSensitiveJson(entry.filters, 'filters');
  for (const command of [
    entry.commands.sourceCommand,
    entry.commands.nextCommand,
    entry.commands.allRemainingCommand,
  ]) {
    if (LINEAR_API_KEY_RE.test(command) || /--api-key(?:-file)?(?:=|\s)/i.test(command)) {
      throw new TypeError('sensitive command material is not allowed in cursor history');
    }
  }
}

export async function recordCursorContinuation(
  input: RecordCursorContinuationInput
): Promise<CursorHistoryResult> {
  if (input.disabled) {
    return { status: 'disabled', entryId: null };
  }

  const cursor = input.pageInfo.endCursor;
  if (!input.pageInfo.hasNextPage || cursor === null) {
    return { status: 'not_applicable', entryId: null };
  }

  try {
    assertSafeHistoryEntry(input.entry);
    const store = (input.storeFactory ?? (() => new CursorHistoryStore()))();
    const historyInput: CursorHistoryEntryInput = {
      cursor,
      workspace: input.entry.workspace,
      commandPath: input.entry.commandPath,
      resource: input.entry.resource,
      target: input.entry.target,
      filters: input.entry.filters,
      orderBy: input.entry.orderBy,
      limit: input.entry.limit,
      sourceCommand: input.entry.commands.sourceCommand,
      nextCommand: input.entry.commands.nextCommand,
      allRemainingCommand: input.entry.commands.allRemainingCommand,
    };
    const entry = await store.append(historyInput);
    return { status: 'recorded', entryId: entry.id };
  } catch (error) {
    return { status: 'failed', entryId: null, error };
  }
}
