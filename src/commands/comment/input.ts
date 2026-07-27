import { promises as fs } from 'fs';

import { RuntimeError, UsageError } from '../../lib/cli-error.js';

export interface CommentBodyOptions {
  body?: string;
  bodyFile?: string;
  stdinReservedForApiKey?: boolean;
}

export interface CommentBodyDependencies {
  stdinIsTTY: boolean;
  readFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
}

async function readProcessStdin(): Promise<string> {
  process.stdin.setEncoding('utf8');
  let content = '';
  for await (const chunk of process.stdin) {
    content += String(chunk);
  }
  return content;
}

function defaultDependencies(): CommentBodyDependencies {
  return {
    stdinIsTTY: process.stdin.isTTY === true,
    readFile: async path => fs.readFile(path, 'utf8'),
    readStdin: readProcessStdin,
  };
}

function fileReadError(path: string, error: unknown): RuntimeError {
  const code =
    error instanceof Error && 'code' in error && typeof error.code === 'string'
      ? error.code
      : undefined;
  if (code === 'ENOENT') {
    return new RuntimeError(`body file '${path}' was not found — check the path and try again`, {
      cause: error,
    });
  }
  if (code === 'EACCES') {
    return new RuntimeError(
      `body file '${path}' is not readable — check its permissions and try again`,
      { cause: error }
    );
  }
  if (code === 'EISDIR') {
    return new RuntimeError(`body file '${path}' is a directory — provide a file path`, {
      cause: error,
    });
  }
  return new RuntimeError(`could not read body file '${path}'`, { cause: error });
}

function requireNonemptyBody(content: string): string {
  if (content.trim().length === 0) {
    throw new UsageError('comment body must not be empty');
  }
  return content;
}

export async function readCommentBody(
  options: CommentBodyOptions,
  dependencies: CommentBodyDependencies = defaultDependencies()
): Promise<string> {
  const hasInline = options.body !== undefined;
  const hasFile = options.bodyFile !== undefined;

  if (hasInline && hasFile) {
    throw new UsageError('pass either --body or --body-file, not both');
  }

  const usesStdin = options.bodyFile === '-' || (!hasInline && !hasFile && !dependencies.stdinIsTTY);
  if (usesStdin && options.stdinReservedForApiKey) {
    throw new UsageError(
      'stdin cannot supply both --api-key-file - and a comment body — use --body or a body file path'
    );
  }

  if (hasInline) {
    return requireNonemptyBody(options.body as string);
  }

  if (hasFile) {
    if (options.bodyFile === '-') {
      return requireNonemptyBody(await dependencies.readStdin());
    }
    try {
      return requireNonemptyBody(await dependencies.readFile(options.bodyFile as string));
    } catch (error) {
      if (error instanceof UsageError) throw error;
      throw fileReadError(options.bodyFile as string, error);
    }
  }

  if (!dependencies.stdinIsTTY) {
    return requireNonemptyBody(await dependencies.readStdin());
  }

  throw new UsageError(
    'comment body is required — pass --body <markdown>, --body-file <path|->, or pipe stdin'
  );
}
