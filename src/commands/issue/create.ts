import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';
import { withCacheWritesSuppressed } from '../../lib/cache-write-policy.js';
import {
  CliError,
  isAuthenticationError,
  NotFoundError,
  RuntimeError,
  UsageError,
} from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import { readContentFile } from '../../lib/file-utils.js';
import { resolveIssueId } from '../../lib/issue-resolver.js';
import {
  createIssue,
  getCurrentUser,
  getTemplateById,
  resolveMemberIdentifier,
  validateTeamExists,
} from '../../lib/linear-client.js';
import { getLogLevel } from '../../lib/logger.js';
import { silenceStdoutWhile } from '../../lib/output.js';
import type { IssueCreateInput, WorkspaceResolution } from '../../lib/types.js';
import { workspaceForJson } from '../../lib/workspace-banner.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';

interface CreateOptions {
  // Required
  title?: string;
  team?: string;

  // Content (mutual exclusivity)
  description?: string;
  descriptionFile?: string;

  // Priority & Estimation
  priority?: number; // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  estimate?: number;

  // Workflow
  state?: string; // Workflow state ID or alias

  // Dates
  dueDate?: string; // YYYY-MM-DD

  // Assignment
  assignee?: string; // ID, alias, email, or display name
  noAssignee?: boolean; // Override auto-assignment
  subscribers?: string; // Comma-separated

  // Organization
  project?: string; // ID, alias, or name
  cycle?: string; // UUID or alias
  parent?: string; // Issue identifier (ENG-123) or UUID
  labels?: string; // Comma-separated IDs or aliases

  // Template
  template?: string; // ID or alias

  // Mode
  web?: boolean; // Open in browser after creation
  dryRun?: boolean; // Print payload without creating
  json?: boolean; // Machine-readable output (incl. workspace.source)
  yes?: boolean; // Skip the auto-detected-workspace confirmation
}

function requireWorkspace(resolution: WorkspaceResolution): WorkspaceResolution {
  if (resolution.denied) {
    throw new RuntimeError(resolution.denied.reason + ' — ' + resolution.denied.hint);
  }
  return resolution;
}

/**
 * Create an issue non-interactively
 */
async function createIssueNonInteractive(options: CreateOptions) {
  // Under --json, silence stdout progress so only the final JSON object lands on
  // stdout (errors still go to stderr), including dry-run payload construction.
  const restoreLog = silenceStdoutWhile(!!options.json);
  try {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: VALIDATION - Mutual Exclusivity & Required Fields
    // ═══════════════════════════════════════════════════════════════════

    // Validate mutual exclusivity of --description and --description-file
    if (options.description && options.descriptionFile) {
      throw new UsageError('Cannot use both --description and --description-file');
    }

    if (options.json && options.web) {
      throw new UsageError('Cannot use --json and --web together');
    }

    // Read description from file if --description-file is provided
    let description = options.description;
    if (options.descriptionFile) {
      const result = await readContentFile(options.descriptionFile);
      if (!result.success) {
        if (options.json) {
          throw new RuntimeError(`Error reading file: ${options.descriptionFile}: ${result.error}`);
        }
        console.error(`❌ Error reading file: ${options.descriptionFile}\n`);
        console.error(`   ${result.error}\n`);
        process.exit(1);
      }
      description = result.content;
      console.log(`📄 Read description from: ${options.descriptionFile}`);
    }

    // Read title from stdin if piped and --title not provided
    if (!options.title && !process.stdin.isTTY) {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      const stdinContent = Buffer.concat(chunks).toString('utf-8').trim();
      if (stdinContent) {
        // First line is the title, rest is description
        const lines = stdinContent.split('\n');
        options.title = lines[0].trim();
        if (lines.length > 1 && !description) {
          description = lines.slice(1).join('\n').trim() || undefined;
        }
        console.log(`📥 Read title from stdin: "${options.title}"`);
      }
    }

    // Validate required field: title
    if (!options.title) {
      throw new UsageError(
        '--title is required; pass --title <text> or pipe a title on standard input'
      );
    }

    const title = options.title.trim();

    // Validate title length
    if (title.length < 1) {
      throw new UsageError('Title cannot be empty');
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: CONFIG & DEFAULTS
    // ═══════════════════════════════════════════════════════════════════

    // Get config for defaults
    const config = getConfig();

    // Prewarm cache with all entities needed for validation (reduces API calls)
    // Only if enabled in config (default: true)
    // Note: prewarmIssueCreation is not yet implemented, this is a placeholder for future optimization
    if (config.prewarmCacheOnCreate !== false) {
      // console.log('🔄 Loading workspace data...');
      // Will be implemented in future optimization milestone
    }

    let teamId = options.team || config.defaultTeam;
    let projectId = options.project || config.defaultProject;
    let templateId = options.template;

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: ALIAS RESOLUTION
    // ═══════════════════════════════════════════════════════════════════

    // Resolve team alias if provided
    if (teamId) {
      const resolvedTeam = resolveAlias('team', teamId);
      if (resolvedTeam !== teamId) {
        console.log(`📎 Resolved team alias "${teamId}" to ${resolvedTeam}`);
        teamId = resolvedTeam;
      }
    }

    // Resolve template alias if provided
    if (templateId) {
      const resolvedTemplate = resolveAlias('issue-template', templateId);
      if (resolvedTemplate !== templateId) {
        console.log(`📎 Resolved template alias "${templateId}" to ${resolvedTemplate}`);
        templateId = resolvedTemplate;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: REQUIRED FIELD VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    // Validate team is provided (REQUIRED)
    if (!teamId) {
      throw new UsageError(
        'Team is required for issue creation; pass --team <id|alias> or configure defaultTeam'
      );
    }

    // Validate team exists
    console.log(`🔍 Validating team: ${teamId}...`);
    const teamCheck = await validateTeamExists(teamId);
    if (!teamCheck.valid) {
      if (options.json) throw new NotFoundError(teamCheck.error ?? `Team not found: ${teamId}`);
      console.error(`❌ ${teamCheck.error}`);
      process.exit(1);
    }
    console.log(`   ✓ Team found: ${teamCheck.name}`);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: TEMPLATE VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    // Validate template if provided
    if (templateId) {
      console.log(`🔍 Validating template: ${templateId}...`);
      const template = await getTemplateById(templateId);
      if (!template) {
        if (options.json) throw new NotFoundError(`Template not found: ${templateId}`);
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        console.error(formatEntityNotFoundError('template', templateId, 'templates list issues'));
        process.exit(1);
      }
      // Note: Template type validation (issue vs project) happens in Linear API
      console.log(`   ✓ Template found: ${template.name}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 6: WORKFLOW STATE (with team validation)
    // ═══════════════════════════════════════════════════════════════════

    let stateId: string | undefined;
    if (options.state) {
      const { resolveStatusOrThrow } = await import('../../lib/resolution.js');
      try {
        stateId = await resolveStatusOrThrow(options.state, 'workflow-state');

        // Validate state belongs to the specified team
        const { getLinearClient } = await import('../../lib/linear-client.js');
        const client = getLinearClient();
        const state = await client.workflowState(stateId);

        if (state) {
          const stateTeam = await state.team;
          if (stateTeam && stateTeam.id !== teamId) {
            if (options.json) {
              throw new UsageError(
                `Workflow state ${state.name} does not belong to team ${teamCheck.name}`
              );
            }
            console.error(`❌ Error: State validation failed\n`);
            console.error(`   State "${state.name}" belongs to team "${stateTeam.name}"`);
            console.error(`   but issue team is "${teamCheck.name}"`);
            console.error(`\n   Please choose a state from the "${teamCheck.name}" team\n`);
            process.exit(1);
          }
        }
      } catch (error) {
        if (options.json) throw error;
        console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 7: PRIORITY & ESTIMATE VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    // Validate and convert priority to number (0-4)
    let priority: number | undefined;
    if (options.priority !== undefined) {
      const { validatePriority } = await import('../../lib/validators.js');
      const priorityResult = validatePriority(options.priority);
      if (!priorityResult.valid) {
        if (options.json) throw new UsageError(priorityResult.error ?? 'Invalid priority');
        console.error(`❌ ${priorityResult.error}`);
        process.exit(1);
      }
      priority = priorityResult.value; // Use converted numeric value
    }

    // Validate and convert estimate to number
    let estimate: number | undefined;
    if (options.estimate !== undefined) {
      const estimateValue =
        typeof options.estimate === 'string' ? parseInt(options.estimate, 10) : options.estimate;

      if (isNaN(estimateValue) || estimateValue < 0) {
        if (options.json) throw new UsageError('Estimate must be a non-negative number');
        console.error('❌ Error: Estimate must be a non-negative number');
        process.exit(1);
      }
      estimate = estimateValue; // Use converted numeric value
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 8: DATE VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    let dueDate: string | undefined;
    if (options.dueDate) {
      const { validateISODate } = await import('../../lib/validators.js');
      const dateResult = validateISODate(options.dueDate);
      if (!dateResult.valid) {
        if (options.json) throw new UsageError(dateResult.error ?? 'Invalid due date');
        console.error(`❌ ${dateResult.error}`);
        process.exit(1);
      }
      dueDate = options.dueDate;
      console.log(`📅 Due date: ${dueDate}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 9: ASSIGNMENT (Auto-assign by default)
    // ═══════════════════════════════════════════════════════════════════

    let assigneeId: string | undefined;

    if (options.assignee) {
      // Explicit assignee specified - resolve using smart resolution
      console.log(`🔍 Validating assignee...`);
      const member = await resolveMemberIdentifier(options.assignee, resolveAlias);

      if (!member) {
        if (options.json) throw new NotFoundError(`Member not found: ${options.assignee}`);
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        console.error(formatEntityNotFoundError('member', options.assignee, 'members list'));
        console.error(`   Note: Tried alias lookup, ID lookup, email lookup, and name lookup`);
        process.exit(1);
      }

      // Show what was resolved
      if (options.assignee !== member.id) {
        if (options.assignee.includes('@')) {
          console.log(`📎 Resolved email "${options.assignee}" to ${member.name}`);
        } else {
          console.log(`📎 Resolved "${options.assignee}" to ${member.name}`);
        }
      }

      console.log(`   ✓ Assignee: ${member.name} (${member.email})`);
      assigneeId = member.id;
    } else if (options.noAssignee === true) {
      // Explicit no-assignee specified - don't assign
      console.log(`📋 Creating unassigned issue`);
      assigneeId = undefined;
    } else {
      // Default behavior: Auto-assign to current user
      try {
        const currentUser = await getCurrentUser();
        assigneeId = currentUser.id;
        console.log(`👤 Auto-assigning to: ${currentUser.name}`);
      } catch (error) {
        const message = `Could not auto-assign: ${error instanceof Error ? error.message : 'Unknown error'}`;
        if (!options.json) {
          console.warn(`⚠️  Warning: ${message}`);
          console.warn('   Continuing without assignee assignment.');
        }
        assigneeId = undefined;
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 10: SUBSCRIBERS (comma-separated list)
    // ═══════════════════════════════════════════════════════════════════

    let subscriberIds: string[] | undefined;
    if (options.subscribers) {
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const rawSubscribers = parseCommaSeparated(options.subscribers);

      console.log(`🔍 Validating ${rawSubscribers.length} subscriber(s)...`);
      const resolvedSubscribers: string[] = [];

      for (const identifier of rawSubscribers) {
        const member = await resolveMemberIdentifier(identifier, resolveAlias);

        if (!member) {
          if (options.json) throw new NotFoundError(`Subscriber not found: ${identifier}`);
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('subscriber', identifier, 'members list'));
          console.error(`   Note: Tried alias lookup, ID lookup, email lookup, and name lookup`);
          process.exit(1);
        }

        // Show what was resolved
        if (identifier !== member.id) {
          if (identifier.includes('@')) {
            console.log(`📎 Resolved email "${identifier}" to ${member.name}`);
          } else {
            console.log(`📎 Resolved "${identifier}" to ${member.name}`);
          }
        }

        console.log(`   ✓ Subscriber: ${member.name} (${member.email})`);
        resolvedSubscribers.push(member.id);
      }

      subscriberIds = resolvedSubscribers;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 11: PROJECT (with defaultProject and team compatibility)
    // ═══════════════════════════════════════════════════════════════════

    if (projectId) {
      // Resolve project by ID, alias, or name
      const { getLinearClient, findProjectByName } = await import('../../lib/linear-client.js');
      const client = getLinearClient();

      // Try alias resolution first
      const resolvedProjectId = resolveAlias('project', projectId);
      if (resolvedProjectId !== projectId) {
        console.log(`📎 Resolved project alias "${projectId}" to ${resolvedProjectId}`);
        projectId = resolvedProjectId;
      }

      // Validate project exists and check team compatibility
      try {
        let project = await client.project(projectId);

        // If project not found by ID, try name-based lookup
        if (!project) {
          const projectByName = await findProjectByName(projectId);
          if (projectByName) {
            projectId = projectByName.id;
            project = await client.project(projectId);
            if (options.project) {
              console.log(`📎 Resolved project name "${options.project}" to ${projectByName.name}`);
            }
          }
        }

        // If still not found, error
        if (!project) {
          if (options.json)
            throw new NotFoundError(`Project not found: ${options.project || projectId}`);
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          const searchTerm = options.project || projectId || '';
          console.error(formatEntityNotFoundError('project', searchTerm, 'project list'));
          process.exit(1);
        }

        // Validate team compatibility
        const teams = await project.teams();
        const teamsList = await teams.nodes;
        const teamBelongsToProject =
          teamsList && teamsList.some((t: { id: string }) => t.id === teamId);

        if (teamsList && teamsList.length > 0 && !teamBelongsToProject) {
          if (options.json) {
            throw new UsageError(`Project is not compatible with team ${teamCheck.name}`);
          }
          const teamNames = teamsList.map((t: { name: string }) => `"${t.name}"`).join(', ');
          console.error(`❌ Error: Project-team compatibility validation failed\n`);
          console.error(`   Project "${project.name}" belongs to team(s): ${teamNames}`);
          console.error(`   but issue team is "${teamCheck.name}"`);

          // Check if this came from defaultProject config
          if (options.project === undefined && config.defaultProject) {
            console.error(`\n   This project came from your defaultProject config setting.`);
            console.error(`   To fix this, either:`);
            console.error(`     1. Use --project to specify a compatible project`);
            console.error(
              `     2. Update config: agent2linear config set defaultProject <project-id>\n`
            );
          } else {
            console.error(`\n   Please choose a project from the "${teamCheck.name}" team\n`);
          }
          process.exit(1);
        }

        console.log(`   ✓ Project: ${project.name}`);
      } catch (error) {
        if (options.json) throw error;
        if (error instanceof Error && error.message.includes('compatibility')) {
          throw error; // Re-throw our validation errors
        }
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        const searchTerm = options.project || projectId || '';
        console.error(formatEntityNotFoundError('project', searchTerm, 'project list'));
        process.exit(1);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 12: CYCLE (UUID or alias)
    // ═══════════════════════════════════════════════════════════════════

    let cycleId: string | undefined;
    if (options.cycle) {
      // Resolve cycle by alias first, then validate as UUID
      const resolvedCycle = resolveAlias('cycle', options.cycle);
      if (resolvedCycle !== options.cycle) {
        console.log(`📎 Resolved cycle alias "${options.cycle}" to ${resolvedCycle}`);
      }

      // Validate format: must be UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(resolvedCycle)) {
        if (options.json) throw new UsageError(`Invalid cycle format: ${options.cycle}`);
        console.error(`❌ Error: Invalid cycle format: "${options.cycle}"`);
        console.error(`   Cycle must be a valid UUID or alias that resolves to a UUID`);
        console.error(`   Example: --cycle 550e8400-e29b-41d4-a716-446655440000\n`);
        process.exit(1);
      }

      cycleId = resolvedCycle;
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 13: PARENT ISSUE (for sub-issues)
    // ═══════════════════════════════════════════════════════════════════

    let parentId: string | undefined;
    if (options.parent) {
      try {
        console.log(`🔍 Validating parent issue: ${options.parent}...`);
        const resolved = await resolveIssueId(options.parent);
        if (resolved) {
          parentId = resolved;
          console.log(`   ✓ Parent issue found`);
        } else {
          if (options.json) throw new NotFoundError(`Parent issue not found: ${options.parent}`);
          console.error(`❌ Error: Parent issue not found: "${options.parent}"`);
          console.error(`   Expected format: ENG-123 or UUID\n`);
          process.exit(1);
        }
      } catch (error) {
        if (options.json) {
          if (isAuthenticationError(error)) throw error;
          throw error instanceof CliError
            ? error
            : new UsageError(`Invalid parent issue identifier: ${options.parent}`, {
                cause: error,
              });
        }
        console.error(`❌ Error: Invalid parent issue identifier: "${options.parent}"`);
        console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`   Expected format: ENG-123 or UUID\n`);
        process.exit(1);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 14: LABELS (comma-separated with alias resolution)
    // ═══════════════════════════════════════════════════════════════════

    let labelIds: string[] | undefined;
    if (options.labels) {
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const rawLabels = parseCommaSeparated(options.labels);

      // Resolve all aliases
      labelIds = rawLabels.map(id => {
        const resolved = resolveAlias('issue-label', id);
        if (resolved !== id) {
          console.log(`📎 Resolved label alias "${id}" to ${resolved}`);
        }
        return resolved;
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 15: CREATE THE ISSUE
    // ═══════════════════════════════════════════════════════════════════

    const issueData: IssueCreateInput = {
      title,
      teamId,
      description,
      priority, // Use converted numeric value, not options.priority
      estimate, // Use converted numeric value, not options.estimate
      stateId,
      assigneeId,
      subscriberIds,
      projectId,
      cycleId,
      parentId,
      labelIds,
      dueDate,
      templateId,
    };

    // Dry-run mode: print payload and exit without creating
    if (options.dryRun) {
      const workspace = requireWorkspace(resolveActiveWorkspace());
      const plan = {
        dryRun: true,
        operation: 'issue.create',
        workspace: workspaceForJson(workspace),
        issue: issueData,
        ancillary: { openInBrowser: options.web === true },
        validation: { localWrites: false, serverMutation: false },
      };
      console.error('\n[dry-run] Would create issue with:');
      restoreLog();
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    // Workspace safety (R11): banner + auto-detected-write confirmation. Runs
    // after dry-run (which never writes) and before the create.
    const ws = await guardWorkspaceForMutation(options);
    const silent = options.json || getLogLevel() === 'quiet';

    if (!silent) console.log('\n🚀 Creating issue...');

    const result = await createIssue(issueData);

    if (options.json) {
      restoreLog();
      const urlKey = result.url.split('linear.app/')[1]?.split('/')[0];
      console.log(
        JSON.stringify(
          { ok: true, workspace: workspaceForJson(ws, urlKey), issue: result },
          null,
          2
        )
      );
      process.exit(0);
    }

    // Display success message
    displaySuccess(result, options.noAssignee, assigneeId !== undefined, ws);

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 16: WEB MODE (open in browser)
    // ═══════════════════════════════════════════════════════════════════

    if (options.web) {
      console.log(`🌐 Opening in browser: ${result.identifier} - ${result.title}`);
      await openInBrowser(result.url);
      console.log(`✓ Browser opened to ${result.url}\n`);
      process.exit(0);
    }
  } catch (error) {
    if (options.json) throw error;
    if (error instanceof CliError) throw error;
    if (isAuthenticationError(error)) throw error;
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  } finally {
    restoreLog();
  }
}

/**
 * Display success message after issue creation
 */
function displaySuccess(
  result: { id: string; identifier: string; title: string; url: string },
  noAssignee?: boolean,
  hasAssignee?: boolean,
  ws?: WorkspaceResolution
) {
  console.log('\n✅ Issue created successfully!');
  if (ws) {
    console.log(`   Workspace:  ${ws.name ?? (ws.source === 'flag' ? '(ad-hoc)' : '(default)')}`);
  }
  console.log(`   Identifier: ${result.identifier}`);
  console.log(`   Title: ${result.title}`);
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: ${result.url}`);

  if (noAssignee) {
    console.log(`   Assignee: (none)`);
  } else if (hasAssignee) {
    console.log(`   (assigned)`);
  }

  console.log('');
}

/**
 * Main entry point for issue create command
 */
export async function createIssueCommand(options: CreateOptions = {}) {
  // Non-interactive mode (interactive mode comes in M15.6)
  await withCacheWritesSuppressed(options.dryRun === true, () =>
    createIssueNonInteractive(options)
  );
}
