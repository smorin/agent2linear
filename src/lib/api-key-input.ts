import { closeSync, constants, fstatSync, openSync, readFileSync } from 'fs';

import { RuntimeError, UsageError } from './cli-error.js';
import { registerSecret } from './redaction.js';

export const API_KEY_MIGRATION_GUIDANCE =
  'use --api-key-file <path|->, LINEAR_API_KEY, a2l setup, or a2l workspace add <name> --api-key-file <path|->.';

function optionValue(
  args: readonly string[],
  flag: string
): { present: boolean; value?: string } {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === flag) {
      const value = args[index + 1];
      return value === undefined || value === '--help' || value === '-h'
        ? { present: false }
        : { present: true, value };
    }
    if (arg.startsWith(`${flag}=`)) {
      return { present: true, value: arg.slice(flag.length + 1) };
    }
  }
  return { present: false };
}

const ROOT_OPTIONS_WITH_VALUES = new Set([
  '--workspace',
  '--api-key-file',
  '--config',
  '-C',
  '--cwd',
]);
const ROOT_OPTIONS_WITHOUT_VALUES = new Set([
  '-q',
  '--quiet',
  '-v',
  '--verbose',
  '--debug',
  '--no-color',
]);
const CONFIG_SET_SCOPE_OPTIONS = new Set(['-g', '--global', '-p', '--project']);

/** Extract config-set's two positionals while honoring its accepted option grammar. */
function configSetOperands(args: readonly string[]): string[] {
  const operands: string[] = [];
  for (let index = 0; index < args.length && operands.length < 2; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h' || arg === '--version' || arg === '-V') break;
    if (
      ROOT_OPTIONS_WITHOUT_VALUES.has(arg) ||
      CONFIG_SET_SCOPE_OPTIONS.has(arg) ||
      /^-v+$/.test(arg)
    ) {
      continue;
    }
    if (ROOT_OPTIONS_WITH_VALUES.has(arg)) {
      index += 1;
      continue;
    }
    if (
      [...ROOT_OPTIONS_WITH_VALUES].some(flag => arg.startsWith(`${flag}=`)) ||
      (arg.startsWith('-C') && arg.length > 2)
    ) {
      continue;
    }
    if (arg.startsWith('-')) continue;
    operands.push(arg);
  }
  return operands;
}

/**
 * Reject credential values in argv before Commander can short-circuit on help,
 * version, or another parser error. Messages intentionally never include values.
 */
export function rejectUnsafeCredentialArgv(argv: readonly string[]): void {
  const terminator = argv.indexOf('--');
  const args = terminator === -1 ? argv : argv.slice(0, terminator);

  if (args.some(arg => arg === '--api-key' || arg.startsWith('--api-key='))) {
    throw new UsageError(`Legacy --api-key <key> has been removed; ${API_KEY_MIGRATION_GUIDANCE}`);
  }

  let configIndex = -1;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (ROOT_OPTIONS_WITH_VALUES.has(arg)) {
      index += 1;
      continue;
    }
    if (
      ROOT_OPTIONS_WITHOUT_VALUES.has(arg) ||
      /^-[qv]+$/.test(arg) ||
      [...ROOT_OPTIONS_WITH_VALUES].some(flag => arg.startsWith(`${flag}=`)) ||
      (arg.startsWith('-C') && arg.length > 2)
    ) {
      continue;
    }
    if (arg.startsWith('-')) continue;
    if (arg === 'config' || arg === 'cfg') configIndex = index;
    break;
  }
  if (configIndex === -1) return;
  const configArgs = args.slice(configIndex + 1);

  let subcommandIndex = -1;
  for (let index = 0; index < configArgs.length; index += 1) {
    const arg = configArgs[index];
    if (ROOT_OPTIONS_WITH_VALUES.has(arg)) {
      index += 1;
      continue;
    }
    if (
      ROOT_OPTIONS_WITHOUT_VALUES.has(arg) ||
      /^-[qv]+$/.test(arg) ||
      [...ROOT_OPTIONS_WITH_VALUES].some(flag => arg.startsWith(`${flag}=`)) ||
      (arg.startsWith('-C') && arg.length > 2) ||
      arg.startsWith('-')
    ) {
      continue;
    }
    subcommandIndex = index;
    break;
  }

  const subcommand = configArgs[subcommandIndex];
  const setOperands =
    subcommand !== 'set' ? [] : configSetOperands(configArgs.slice(subcommandIndex + 1));
  const [setKey, setValue] = setOperands;
  if (
    subcommand === 'set' &&
    setKey === 'apiKey' &&
    setValue !== undefined &&
    setValue !== '--help' &&
    setValue !== '-h'
  ) {
    throw new UsageError(
      `config set apiKey <value> is not supported because it exposes an API key in argv; ${API_KEY_MIGRATION_GUIDANCE}`
    );
  }

  if (subcommand === 'edit') {
    const editArgs = configArgs.slice(subcommandIndex + 1);
    const key = optionValue(editArgs, '--key');
    const value = optionValue(editArgs, '--value');
    if (key.value === 'apiKey' && value.present) {
      throw new UsageError(
        `config edit --key apiKey --value <value> is not supported because it exposes an API key in argv; ${API_KEY_MIGRATION_GUIDANCE}`
      );
    }
  }
}

/** Parse exactly one nonempty logical line without accepting concatenated payloads. */
export function parseApiKeyInput(source: string): string {
  const lines = source.split(/\r?\n/);
  const key = lines[0]?.trim() ?? '';
  if (key.length === 0 || lines.slice(1).some(line => line.trim().length > 0)) {
    throw new UsageError('API key input must contain exactly one nonempty logical line.');
  }
  return key;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Read a key from a regular file or stdin (`-`) and apply the one-line grammar. */
export async function readApiKeyFile(
  path: string,
  stdinReader: () => Promise<string> = readStdin
): Promise<string> {
  if (path === '-') {
    const key = parseApiKeyInput(await stdinReader());
    registerSecret(key);
    return key;
  }

  let descriptor: number;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch (error) {
    throw new RuntimeError(`API key file is missing or unreadable: ${path}`, { cause: error });
  }

  let source: string;
  try {
    if (!fstatSync(descriptor).isFile()) {
      throw new RuntimeError(`API key path is not a regular file: ${path}`);
    }
    source = readFileSync(descriptor, 'utf8');
  } catch (error) {
    if (error instanceof RuntimeError) throw error;
    throw new RuntimeError(`API key file is unreadable: ${path}`, { cause: error });
  } finally {
    closeSync(descriptor);
  }

  const key = parseApiKeyInput(source);
  registerSecret(key);
  return key;
}
