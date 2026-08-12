import './lib/suppress-warnings.js'; // must precede deps that pull in `punycode`

import type { Command } from 'commander';

import { cli } from './cli.js';
import { rejectLegacyIssueCommentArgv } from './commands/comment/register.js';
import { rejectUnsafeCredentialArgv } from './lib/api-key-input.js';
import { inferErrorOutputMode, renderCliError, UsageError } from './lib/cli-error.js';
import { configureDiagnosticsFromArgv, flushDiagnosticBuffer } from './lib/logger.js';
import { installProcessSignalHandlers } from './lib/signal-handling.js';

installProcessSignalHandlers();

type GeneratedHelpNormalization =
  | { kind: 'parse'; argv: string[] }
  | { kind: 'invalid'; command: Command; message: string };

function normalizeGeneratedHelpArgv(argv: readonly string[]): GeneratedHelpNormalization {
  const valueOptions = new Set(['--workspace', '--api-key-file', '--config', '--cwd', '-C']);
  const booleanOptions = new Set([
    '--quiet',
    '--verbose',
    '--debug',
    '--no-input',
    '--no-color',
    '--help',
    '--version',
    '-q',
    '-v',
    '-h',
    '-V',
  ]);
  const operandIndexes: number[] = [];
  let commandOption: string | null = null;
  let terminatorIndex = -1;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      terminatorIndex = index;
      for (let rest = index + 1; rest < argv.length; rest += 1) operandIndexes.push(rest);
      break;
    }
    if (valueOptions.has(token)) {
      index += 1;
      continue;
    }
    if (/^-[qv]*C$/.test(token)) {
      index += 1;
      continue;
    }
    if (
      token.startsWith('--workspace=') ||
      token.startsWith('--api-key-file=') ||
      token.startsWith('--config=') ||
      token.startsWith('--cwd=') ||
      (token.startsWith('-C') && token.length > 2) ||
      /^-[qv]*C.+/.test(token)
    ) {
      continue;
    }
    if (token.startsWith('-') && !booleanOptions.has(token) && !/^-[qv]+$/.test(token)) {
      commandOption ??= token;
    }
    if (!token.startsWith('-')) operandIndexes.push(index);
  }

  const helpOperandIndex = operandIndexes.findIndex(index => argv[index] === 'help');
  if (helpOperandIndex < 0) return { kind: 'parse', argv: [...argv] };

  let parent = cli;
  const resolvedPath: string[] = [];
  for (const operandIndex of operandIndexes.slice(0, helpOperandIndex)) {
    const nameOrAlias = argv[operandIndex];
    const child = parent.commands.find(
      command => command.name() === nameOrAlias || command.aliases().includes(nameOrAlias)
    );
    if (!child) return { kind: 'parse', argv: [...argv] };
    parent = child;
    resolvedPath.push(nameOrAlias);
  }
  if (parent.commands.length === 0) return { kind: 'parse', argv: [...argv] };

  const helpArgvIndex = operandIndexes[helpOperandIndex];
  const normalized = argv.filter(
    (_token, index) =>
      index !== helpArgvIndex && !(terminatorIndex >= 0 && index === terminatorIndex)
  );
  for (const operandIndex of operandIndexes.slice(helpOperandIndex + 1)) {
    const nameOrAlias = argv[operandIndex];
    if (parent.commands.length === 0) {
      return {
        kind: 'invalid',
        command: parent,
        message:
          commandOption === null
            ? `Invalid generated help: unexpected argument '${nameOrAlias}' after '${resolvedPath.join(' ')}'`
            : `Invalid generated help: option '${commandOption}' is not part of a command path; use '${resolvedPath.join(' ')} --help'`,
      };
    }
    const child = parent.commands.find(
      command => command.name() === nameOrAlias || command.aliases().includes(nameOrAlias)
    );
    if (!child) {
      if (nameOrAlias === 'help') {
        return {
          kind: 'invalid',
          command: parent,
          message: "Invalid generated help: repeated 'help' is not a command target",
        };
      }
      return { kind: 'parse', argv: [...resolvedPath, nameOrAlias] };
    }
    parent = child;
    resolvedPath.push(nameOrAlias);
  }
  if (commandOption !== null) {
    return {
      kind: 'invalid',
      command: parent,
      message: `Invalid generated help: option '${commandOption}' is not part of a command path; use '${resolvedPath.join(' ') || 'agent2linear'} --help'`,
    };
  }
  return { kind: 'parse', argv: [...normalized, '--help'] };
}

async function run(): Promise<void> {
  const originalArgv = process.argv.slice(2);
  try {
    if (originalArgv.length === 0) {
      process.stdout.write(cli.helpInformation());
      return;
    }
    configureDiagnosticsFromArgv(originalArgv);
    rejectUnsafeCredentialArgv(originalArgv);
    rejectLegacyIssueCommentArgv(originalArgv);
    const normalization = normalizeGeneratedHelpArgv(originalArgv);
    if (normalization.kind === 'invalid') {
      if (inferErrorOutputMode(originalArgv) !== 'json') {
        process.stderr.write(normalization.command.helpInformation());
      }
      throw new UsageError(normalization.message);
    }
    await cli.parseAsync([process.argv[0], process.argv[1], ...normalization.argv]);
    flushDiagnosticBuffer();
  } catch (error) {
    const errorMode = inferErrorOutputMode(originalArgv);
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'commander.helpDisplayed' || error.code === 'commander.version')
    ) {
      process.exitCode = 0;
      return;
    }

    if (error instanceof Error && 'code' in error && error.code === 'commander.help') {
      if (errorMode === 'json') {
        const normalized = renderCliError(error, errorMode);
        process.exitCode = normalized.exitCode;
      } else {
        process.exitCode = 2;
      }
      return;
    }

    const normalized = renderCliError(error, errorMode);
    process.exitCode = normalized.exitCode;
  }
}

void run();
