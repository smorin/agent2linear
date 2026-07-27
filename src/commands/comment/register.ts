import { Command } from 'commander';

import { UsageError } from '../../lib/cli-error.js';
import { quotePosixShellArg } from '../../lib/shell-quote.js';

export interface CommentCommandHandlers {
  add(target: string, options: Record<string, unknown>, command: Command): Promise<void>;
  list(target: string, options: Record<string, unknown>, command: Command): Promise<void>;
}

function registerLeaves(
  group: Command,
  targetSyntax: '<identifier>' | '<name-or-id>',
  targetDescription: string,
  handlers: CommentCommandHandlers
): void {
  group
    .command(`add ${targetSyntax}`)
    .description('Add a direct Markdown comment or reply')
    .option('--body <markdown>', 'Inline Markdown comment body')
    .option('--body-file <path|->', 'Read UTF-8 body from a path, or stdin with -')
    .option('--reply-to <comment-id>', 'Reply to a comment on the same target')
    .option('--dry-run', 'Resolve and validate without prompting or creating a comment')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .option('-y, --yes', 'Skip the auto-detected-workspace confirmation')
    .option('--no-input', 'Never prompt; fail if explicit consent is required')
    .addHelpText(
      'after',
      `
Arguments:
  ${targetDescription}

Body input:
  Pass exactly one of --body or --body-file. --body-file - reads stdin.
  With neither option, piped stdin is read automatically.

Examples:
  $ a2l ${group.parent?.name()} comment add example --body "Investigating"
  $ printf '%s\\n' "Investigating" | a2l ${group.parent?.name()} comment add example
  $ a2l ${group.parent?.name()} comment add example --body-file - --dry-run --json
`
    )
    .action(async (target: string, options: Record<string, unknown>, command: Command) => {
      await handlers.add(target, options, command);
    });

  group
    .command(`list ${targetSyntax}`)
    .description('List direct comments with raw-cursor pagination')
    .option('--limit <number>', 'Maximum comments to return (default: 50, max: 250)', '50')
    .option('--after <cursor>', 'Resume after the exact raw Linear cursor')
    .option('-a, --all', 'Fetch every remaining comment')
    .option('--no-cursor-history', 'Do not persist an emitted continuation cursor')
    .option('-o, --output <table|json>', 'Output format: table or json', 'table')
    .option('--json', 'Equivalent to --output json')
    .addHelpText(
      'after',
      `
Arguments:
  ${targetDescription}

Pagination:
  The default returns at most 50 comments. Copy --after from the result for page two.
  --after C --all fetches every remaining comment after C. There is no numeric page option.

Examples:
  $ a2l ${group.parent?.name()} comment list example
  $ a2l ${group.parent?.name()} comment list example --limit 50 --after '<raw-linear-cursor>'
  $ a2l ${group.parent?.name()} comment list example --all --json
`
    )
    .action(async (target: string, options: Record<string, unknown>, command: Command) => {
      await handlers.list(target, options, command);
    });
}

function legacyOptions(args: string[]): { body?: string; bodyFile?: string } {
  const result: { body?: string; bodyFile?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '--body' && args[index + 1] !== undefined) {
      result.body = args[index + 1];
      index += 1;
    } else if (token.startsWith('--body=')) {
      result.body = token.slice('--body='.length);
    } else if (token === '--body-file' && args[index + 1] !== undefined) {
      result.bodyFile = args[index + 1];
      index += 1;
    } else if (token.startsWith('--body-file=')) {
      result.bodyFile = token.slice('--body-file='.length);
    }
  }
  return result;
}

function legacySuggestion(
  target: string,
  options: { body?: string; bodyFile?: string }
): string {
  const parts = ['a2l', 'issue', 'comment', 'add', quotePosixShellArg(target)];
  if (options.body !== undefined) {
    parts.push('--body', quotePosixShellArg(options.body));
  }
  if (options.bodyFile !== undefined) {
    parts.push('--body-file', quotePosixShellArg(options.bodyFile));
  }
  return parts.join(' ');
}

const GLOBAL_OPTIONS_WITH_VALUES = new Set([
  '--workspace',
  '--api-key-file',
  '--config',
  '--cwd',
  '-C',
]);

function commandOperands(argv: readonly string[]): string[] {
  const operands: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--') {
      operands.push(...argv.slice(index + 1));
      break;
    }
    if (GLOBAL_OPTIONS_WITH_VALUES.has(token)) {
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
      /^-[qv]*C.+/.test(token) ||
      token === '--quiet' ||
      token === '--verbose' ||
      /^-[qv]+$/.test(token) ||
      token === '--debug' ||
      token === '--no-input' ||
      token === '--no-color'
    ) {
      continue;
    }
    operands.push(token);
  }
  return operands;
}

const ISSUE_IDENTIFIER_RE = /^[A-Za-z][A-Za-z0-9_]*-\d+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function rejectLegacyIssueCommentArgv(argv: readonly string[]): void {
  const operands = commandOperands(argv);
  if (operands[0] !== 'issue' || operands[1] !== 'comment') return;
  const target = operands[2];
  if (target === undefined || (!ISSUE_IDENTIFIER_RE.test(target) && !UUID_RE.test(target))) return;
  throw new UsageError(
    `legacy comment syntax has been removed\ntry: ${legacySuggestion(target, legacyOptions([...argv]))}`
  );
}

export function registerCommentGroup(
  parent: Command,
  targetSyntax: '<identifier>' | '<name-or-id>',
  targetDescription: string,
  handlers: CommentCommandHandlers,
  _options: { rejectLegacyIssueSyntax?: boolean } = {}
): Command {
  const group = parent
    .command('comment')
    .enablePositionalOptions()
    .description('Manage direct comments')
    .addHelpText(
      'after',
      `
Examples:
  $ a2l ${parent.name()} comment add example --body "Investigating"
  $ a2l ${parent.name()} comment list example
`
    );

  registerLeaves(group, targetSyntax, targetDescription, handlers);
  return group;
}
