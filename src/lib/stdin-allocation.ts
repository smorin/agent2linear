export interface StdinAllocationInput {
  apiKeyFile?: string;
  commandPath: string[];
  body?: string;
  bodyFile?: string;
  description?: string;
  stdinIsTTY: boolean;
  title?: string;
}

function isCommentAdd(path: string[]): boolean {
  return (
    path.length === 3 &&
    (path[0] === 'issue' || path[0] === 'project') &&
    path[1] === 'comment' &&
    path[2] === 'add'
  );
}

/**
 * Detect one-stream/two-values collisions before --api-key-file - consumes stdin.
 */
export function stdinAllocationConflict(input: StdinAllocationInput): string | null {
  if (input.apiKeyFile !== '-') return null;

  if (isCommentAdd(input.commandPath)) {
    const explicitBody = input.body !== undefined;
    const explicitFile = input.bodyFile !== undefined;
    const bodyUsesStdin =
      input.bodyFile === '-' || (!explicitBody && !explicitFile && !input.stdinIsTTY);
    if (bodyUsesStdin) {
      return 'stdin cannot supply both --api-key-file - and a comment body — use --body or a body file path';
    }
  }

  if (
    input.commandPath.length === 2 &&
    input.commandPath[0] === 'issue' &&
    input.commandPath[1] === 'create' &&
    !input.title &&
    !input.stdinIsTTY
  ) {
    return 'stdin cannot supply both --api-key-file - and issue create input — pass --title explicitly';
  }

  if (
    input.commandPath.length === 2 &&
    input.commandPath[0] === 'issue' &&
    input.commandPath[1] === 'update' &&
    input.description === '-'
  ) {
    return 'stdin cannot supply both --api-key-file - and an issue description — use --description-file or inline text';
  }

  return null;
}
