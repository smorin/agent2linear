export interface StdinAllocationInput {
  apiKeyFile?: string;
  commandPath: readonly string[];
  body?: string;
  bodyFile?: string;
  description?: string;
  destructiveConfirmation?: boolean;
  dryRun?: boolean;
  interactiveInput?: boolean;
  noInput?: boolean;
  stdinIsTTY: boolean;
  title?: string;
  yes?: boolean;
}

function isCommentAdd(path: readonly string[]): boolean {
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

  if (input.interactiveInput) {
    return 'stdin cannot supply both --api-key-file - and interactive input — use a key file path or another credential source';
  }

  if (input.destructiveConfirmation && !input.dryRun && !input.yes && !input.noInput) {
    return 'stdin cannot supply both --api-key-file - and confirmation input — pass -y/--yes or --no-input, or use a key file path';
  }

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
