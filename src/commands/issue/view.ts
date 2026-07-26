import { openInBrowser } from '../../lib/browser.js';
import { handleLinearError, isLinearError } from '../../lib/error-handler.js';
import { resolveIssueIdentifier } from '../../lib/issue-resolver.js';
import {
  getFullIssueById,
  getIssueCommentSummary,
  getIssueHistory,
} from '../../lib/linear-client.js';
import { formatContentPreview } from '../../lib/output.js';

interface ViewOptions {
  json?: boolean;
  web?: boolean;
  showComments?: boolean;
  showHistory?: boolean;
  quiet?: boolean;
  desc?: boolean;
  descLength?: string;
  descFull?: boolean;
  noDesc?: boolean;
}

export function buildIssueViewJson(
  issue: object,
  comments: unknown[] | undefined,
  commentsTruncated: boolean | undefined,
  history: unknown[] | undefined
): Record<string, unknown> {
  return {
    ...issue,
    ...(comments === undefined ? {} : { comments, commentsTruncated: commentsTruncated === true }),
    ...(history === undefined ? {} : { history }),
  };
}

/**
 * Format date in human-readable format
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format priority as human-readable string
 */
function formatPriority(priority?: number): string {
  switch (priority) {
    case 0:
      return 'None';
    case 1:
      return 'Urgent';
    case 2:
      return 'High';
    case 3:
      return 'Normal';
    case 4:
      return 'Low';
    default:
      return 'None';
  }
}

/**
 * View an issue by identifier (ENG-123 or UUID)
 */
export async function viewIssue(identifier: string, options: ViewOptions = {}) {
  try {
    // Validate conflicting output modes
    if (options.json && options.web) {
      console.error('❌ Error: Cannot use --json and --web together');
      console.error('   Use either --json (for JSON output) or --web (open in browser)');
      process.exit(1);
    }

    // Resolve identifier to UUID (handles both ENG-123 and UUID formats)
    const resolveResult = await resolveIssueIdentifier(identifier);

    if (!resolveResult) {
      console.error(`\n❌ Issue not found: ${identifier}`);
      console.error('\nPlease check:');
      console.error('  - The identifier is correct (e.g., ENG-123 or UUID)');
      console.error('  - You have access to the issue');
      console.error('  - The issue hasn\'t been deleted\n');
      process.exit(1);
    }

    const { issueId, resolvedBy, originalInput } = resolveResult;

    // Suppress status messages when in JSON mode or quiet mode
    const silent = options.json || options.quiet;

    // Show resolution message if identifier was used
    if (!silent && resolvedBy === 'identifier' && originalInput !== issueId) {
      console.log(`\n📎 Resolved identifier "${originalInput}" to issue ${issueId.substring(0, 8)}...`);
    }

    // Fetch full issue data
    if (!silent) {
      console.log(`🔍 Fetching issue details...\n`);
    }
    const issue = await getFullIssueById(issueId);

    if (!issue) {
      console.error(`\n❌ Could not retrieve issue details for ${identifier}\n`);
      process.exit(1);
    }

    // Handle --json flag
    if (options.json) {
      // Fetch comments and history if requested
      let comments;
      let commentsTruncated;
      let history;

      if (options.showComments) {
        const commentSummary = await getIssueCommentSummary(issueId);
        comments = commentSummary.comments;
        commentsTruncated = commentSummary.pageInfo.hasNextPage;
      }

      if (options.showHistory) {
        history = await getIssueHistory(issueId);
      }

      console.log(
        JSON.stringify(
          buildIssueViewJson(issue, comments, commentsTruncated, history),
          null,
          2
        )
      );
      process.exit(0);
    }

    // Handle --web flag
    if (options.web) {
      console.log(`🌐 Opening in browser: ${issue.identifier} - ${issue.title}`);
      await openInBrowser(issue.url);
      console.log(`✓ Browser opened to ${issue.url}\n`);
      process.exit(0);
    }

    // Terminal display
    console.log(`\n${issue.identifier}: ${issue.title}`);
    console.log('='.repeat(Math.min(issue.identifier.length + issue.title.length + 2, 80)));
    console.log('');

    // Status line
    const statusParts = [
      `Status: ${issue.state.name}`,
      `Priority: ${formatPriority(issue.priority)}`,
      `Team: ${issue.team.name}`,
    ];
    console.log(statusParts.join(' | '));
    console.log('');

    // Assignment
    if (issue.assignee) {
      console.log(`👤 Assignee: ${issue.assignee.name} (${issue.assignee.email})`);
    } else {
      console.log(`👤 Assignee: Unassigned`);
    }

    if (issue.subscribers.length > 0) {
      const subscriberNames = issue.subscribers.map(s => s.name).join(', ');
      console.log(`👥 Subscribers: ${subscriberNames}`);
    }

    console.log('');

    // Dates
    console.log(`📅 Created: ${formatDate(issue.createdAt)}`);
    console.log(`📅 Updated: ${formatDate(issue.updatedAt)}`);

    if (issue.dueDate) {
      console.log(`📅 Due: ${formatDate(issue.dueDate)}`);
    }

    if (issue.completedAt) {
      console.log(`✅ Completed: ${formatDate(issue.completedAt)}`);
    }

    if (issue.canceledAt) {
      console.log(`❌ Canceled: ${formatDate(issue.canceledAt)}`);
    }

    console.log('');

    // Organization
    if (issue.project) {
      console.log(`📁 Project: ${issue.project.name}`);
    }

    if (issue.cycle) {
      console.log(`🔄 Cycle: ${issue.cycle.name}`);
    }

    if (issue.estimate) {
      console.log(`⏱️  Estimate: ${issue.estimate} points`);
    }

    if (issue.labels.length > 0) {
      const labelNames = issue.labels.map(l => l.name).join(', ');
      console.log(`🏷️  Labels: ${labelNames}`);
    }

    console.log('');

    // Relationships
    if (issue.parent) {
      console.log(`⬆️  Parent: ${issue.parent.identifier} - ${issue.parent.title}`);
      console.log('');
    }

    if (issue.children.length > 0) {
      console.log(`⬇️  Sub-issues (${issue.children.length}):`);
      for (const child of issue.children) {
        const stateName = child.state;
        console.log(`   • ${child.identifier}: ${child.title} [${stateName}]`);
      }
      console.log('');
    }

    // Description
    if (issue.description && !options.noDesc) {
      console.log('📝 Description:');
      console.log('─'.repeat(80));
      if (options.desc || options.descLength) {
        const length = options.descLength ? parseInt(options.descLength, 10) : undefined;
        console.log(formatContentPreview(issue.description, length));
      } else {
        // Default: show full description (--desc-full is also explicit full)
        console.log(issue.description);
      }
      console.log('─'.repeat(80));
      console.log('');
    }

    // Creator
    console.log(`👨‍💻 Created by: ${issue.creator.name} (${issue.creator.email})`);
    console.log('');

    // URL
    console.log(`🔗 URL: ${issue.url}`);
    console.log('');

    // Comments
    if (options.showComments) {
      console.log('💬 Comments:');
      console.log('─'.repeat(80));

      const commentSummary = await getIssueCommentSummary(issueId);
      const comments = commentSummary.comments;

      if (comments.length === 0) {
        console.log('No comments yet.');
      } else {
        for (const comment of comments) {
          console.log(`\n[${formatDate(comment.createdAt)}] ${comment.user.name}:`);
          console.log(comment.body);
        }
      }

      console.log('─'.repeat(80));
      if (commentSummary.pageInfo.hasNextPage) {
        console.log(
          'More comments are available. Run: a2l issue comment list ' + identifier + ' --all'
        );
      }
      console.log('');
    }

    // History
    if (options.showHistory) {
      console.log('📜 History:');
      console.log('─'.repeat(80));

      const history = await getIssueHistory(issueId);

      if (history.length === 0) {
        console.log('No history entries.');
      } else {
        for (const entry of history) {
          const actorName = entry.actor ? entry.actor.name : 'System';
          const changes: string[] = [];

          if (entry.fromState && entry.toState) {
            changes.push(`Status: ${entry.fromState} → ${entry.toState}`);
          }

          if (entry.fromAssignee && entry.toAssignee) {
            changes.push(`Assignee: ${entry.fromAssignee} → ${entry.toAssignee}`);
          } else if (entry.toAssignee) {
            changes.push(`Assigned to: ${entry.toAssignee}`);
          } else if (entry.fromAssignee) {
            changes.push(`Unassigned from: ${entry.fromAssignee}`);
          }

          if (entry.addedLabels && entry.addedLabels.length > 0) {
            changes.push(`Added labels: ${entry.addedLabels.join(', ')}`);
          }

          if (entry.removedLabels && entry.removedLabels.length > 0) {
            changes.push(`Removed labels: ${entry.removedLabels.join(', ')}`);
          }

          if (changes.length > 0) {
            console.log(`\n[${formatDate(entry.createdAt)}] ${actorName}:`);
            for (const change of changes) {
              console.log(`  • ${change}`);
            }
          }
        }
      }

      console.log('─'.repeat(80));
      console.log('');
    }

    // Usage tips
    if (!options.showComments && !options.showHistory) {
      console.log('💡 Tip: Use --show-comments or --show-history to see more details');
      console.log('   Use --web to open in browser, or --json for machine-readable output');
      console.log('');
    }
  } catch (error) {
    if (isLinearError(error)) {
      console.error(`\n${handleLinearError(error, 'issue')}\n`);
    } else {
      console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
    }
    process.exit(1);
  }
}
