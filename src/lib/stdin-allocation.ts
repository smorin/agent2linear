export interface StdinAllocationInput {
  apiKey?: string;
  commandPath: string[];
  body?: string;
  bodyFile?: string;
  stdinIsTTY: boolean;
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
 * Detect the one-stream/two-values collision before --api-key - consumes stdin.
 */
export function stdinAllocationConflict(input: StdinAllocationInput): string | null {
  if (input.apiKey !== '-' || !isCommentAdd(input.commandPath)) return null;

  const explicitBody = input.body !== undefined;
  const explicitFile = input.bodyFile !== undefined;
  const bodyUsesStdin =
    input.bodyFile === '-' || (!explicitBody && !explicitFile && !input.stdinIsTTY);

  return bodyUsesStdin
    ? 'stdin cannot supply both --api-key - and a comment body — use --body or a body file path'
    : null;
}
