import { readContentFile } from '../../lib/file-utils.js';
import { resolveIssueIdentifier } from '../../lib/issue-resolver.js';
import { createIssueComment } from '../../lib/linear-client.js';
import { showError, showSuccess } from '../../lib/output.js';

interface CommentOptions {
  body?: string;
  bodyFile?: string;
}

/**
 * Add a comment to an issue
 */
export async function commentIssueCommand(identifier: string, options: CommentOptions) {
  try {
    // Validate mutual exclusivity
    if (options.body && options.bodyFile) {
      showError('Cannot use both --body and --body-file');
      process.exit(1);
    }

    if (!options.body && !options.bodyFile) {
      showError('Either --body or --body-file is required');
      process.exit(1);
    }

    // Get comment body
    let body = options.body;
    if (options.bodyFile) {
      const result = await readContentFile(options.bodyFile);
      if (!result.success) {
        showError(`Error reading file: ${options.bodyFile}`, result.error);
        process.exit(1);
      }
      body = result.content;
    }

    if (!body || body.trim().length === 0) {
      showError('Comment body cannot be empty');
      process.exit(1);
    }

    // Resolve issue identifier
    const resolved = await resolveIssueIdentifier(identifier);
    if (!resolved) {
      showError(`Issue not found: "${identifier}"`, 'Use issue identifier (ENG-123) or UUID');
      process.exit(1);
    }

    // Create comment
    const comment = await createIssueComment(resolved.issueId, body);

    showSuccess('Comment added', {
      'Issue': identifier,
      'Comment ID': comment.id,
    });
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
