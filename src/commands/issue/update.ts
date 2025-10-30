import {
  updateIssue,
  getFullIssueById,
  resolveMemberIdentifier,
  validateTeamExists,
  getLinearClient,
  findProjectByName,
} from '../../lib/linear-client.js';
import type { IssueUpdateInput } from '../../lib/types.js';
import { openInBrowser } from '../../lib/browser.js';
import { resolveAlias } from '../../lib/aliases.js';
import { readContentFile } from '../../lib/file-utils.js';

interface UpdateOptions {
  // Basic Fields
  title?: string;
  description?: string;
  descriptionFile?: string;

  // Priority & Estimation
  priority?: number; // 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
  estimate?: number;
  noEstimate?: boolean; // Clear estimate

  // Workflow
  state?: string; // Workflow state ID or alias

  // Dates
  dueDate?: string; // YYYY-MM-DD
  noDueDate?: boolean; // Clear due date

  // Assignment
  assignee?: string; // ID, alias, email, or display name
  noAssignee?: boolean; // Remove assignee

  // Team & Organization
  team?: string; // Move to different team
  project?: string; // ID, alias, or name
  noProject?: boolean; // Remove from project
  cycle?: string; // UUID or alias
  noCycle?: boolean; // Remove from cycle

  // Parent Relationship
  parent?: string; // Issue identifier (ENG-123) or UUID
  noParent?: boolean; // Remove parent (make root issue)

  // Labels (3 modes: replace, add, remove)
  labels?: string; // Comma-separated - REPLACE all labels
  addLabels?: string; // Comma-separated - ADD labels
  removeLabels?: string; // Comma-separated - REMOVE labels

  // Subscribers (3 modes: replace, add, remove)
  subscribers?: string; // Comma-separated - REPLACE all subscribers
  addSubscribers?: string; // Comma-separated - ADD subscribers
  removeSubscribers?: string; // Comma-separated - REMOVE subscribers

  // Lifecycle
  trash?: boolean; // Move to trash
  untrash?: boolean; // Restore from trash

  // Mode
  web?: boolean; // Open in browser after update
}

/**
 * Update an issue non-interactively
 */
async function updateIssueNonInteractive(identifier: string, options: UpdateOptions) {
  try {
    // ═══════════════════════════════════════════════════════════════════
    // PHASE 1: VALIDATION - Mutual Exclusivity Checks
    // ═══════════════════════════════════════════════════════════════════

    // 1. Description mutual exclusivity
    if (options.description && options.descriptionFile) {
      console.error('❌ Error: Cannot use both --description and --description-file\n');
      console.error('Choose one:');
      console.error('  --description "markdown text"  (inline description)');
      console.error('  --description-file path/to/file.md  (file description)\n');
      process.exit(1);
    }

    // 2. Labels mutual exclusivity: --labels vs --add-labels/--remove-labels
    if (options.labels && options.addLabels) {
      console.error('❌ Error: Cannot use both --labels and --add-labels\n');
      console.error('--labels replaces ALL labels (replace mode)');
      console.error('--add-labels adds to existing labels (add mode)');
      console.error('\nChoose one:');
      console.error('  --labels "label1,label2"           (replace all)');
      console.error('  --add-labels "label3,label4"       (add to existing)\n');
      process.exit(1);
    }

    if (options.labels && options.removeLabels) {
      console.error('❌ Error: Cannot use both --labels and --remove-labels\n');
      console.error('--labels replaces ALL labels (replace mode)');
      console.error('--remove-labels removes specific labels (remove mode)');
      console.error('\nChoose one:');
      console.error('  --labels "label1,label2"           (replace all)');
      console.error('  --remove-labels "label3,label4"    (remove specific)\n');
      process.exit(1);
    }

    // Note: --add-labels and --remove-labels CAN be used together (add first, then remove)

    // 3. Subscribers mutual exclusivity: --subscribers vs --add-subscribers/--remove-subscribers
    if (options.subscribers && options.addSubscribers) {
      console.error('❌ Error: Cannot use both --subscribers and --add-subscribers\n');
      console.error('--subscribers replaces ALL subscribers (replace mode)');
      console.error('--add-subscribers adds to existing subscribers (add mode)');
      console.error('\nChoose one:');
      console.error('  --subscribers "user1,user2"          (replace all)');
      console.error('  --add-subscribers "user3,user4"      (add to existing)\n');
      process.exit(1);
    }

    if (options.subscribers && options.removeSubscribers) {
      console.error('❌ Error: Cannot use both --subscribers and --remove-subscribers\n');
      console.error('--subscribers replaces ALL subscribers (replace mode)');
      console.error('--remove-subscribers removes specific subscribers (remove mode)');
      console.error('\nChoose one:');
      console.error('  --subscribers "user1,user2"          (replace all)');
      console.error('  --remove-subscribers "user3,user4"   (remove specific)\n');
      process.exit(1);
    }

    // 4. Assignee mutual exclusivity
    if (options.assignee && options.noAssignee) {
      console.error('❌ Error: Cannot use both --assignee and --no-assignee\n');
      console.error('Choose one:');
      console.error('  --assignee user@email.com   (assign to user)');
      console.error('  --no-assignee               (remove assignee)\n');
      process.exit(1);
    }

    // 5. Due date mutual exclusivity
    if (options.dueDate && options.noDueDate) {
      console.error('❌ Error: Cannot use both --due-date and --no-due-date\n');
      console.error('Choose one:');
      console.error('  --due-date 2025-12-31   (set due date)');
      console.error('  --no-due-date           (clear due date)\n');
      process.exit(1);
    }

    // 6. Estimate mutual exclusivity
    if (options.estimate !== undefined && options.noEstimate) {
      console.error('❌ Error: Cannot use both --estimate and --no-estimate\n');
      console.error('Choose one:');
      console.error('  --estimate 8      (set estimate)');
      console.error('  --no-estimate     (clear estimate)\n');
      process.exit(1);
    }

    // 7. Project mutual exclusivity
    if (options.project && options.noProject) {
      console.error('❌ Error: Cannot use both --project and --no-project\n');
      console.error('Choose one:');
      console.error('  --project proj_xxx   (assign to project)');
      console.error('  --no-project         (remove from project)\n');
      process.exit(1);
    }

    // 8. Cycle mutual exclusivity
    if (options.cycle && options.noCycle) {
      console.error('❌ Error: Cannot use both --cycle and --no-cycle\n');
      console.error('Choose one:');
      console.error('  --cycle cycle_xxx   (assign to cycle)');
      console.error('  --no-cycle          (remove from cycle)\n');
      process.exit(1);
    }

    // 9. Parent mutual exclusivity
    if (options.parent && options.noParent) {
      console.error('❌ Error: Cannot use both --parent and --no-parent\n');
      console.error('Choose one:');
      console.error('  --parent ENG-123   (set/change parent)');
      console.error('  --no-parent        (remove parent, make root issue)\n');
      process.exit(1);
    }

    // 10. Trash mutual exclusivity
    if (options.trash && options.untrash) {
      console.error('❌ Error: Cannot use both --trash and --untrash\n');
      console.error('Choose one:');
      console.error('  --trash     (move to trash)');
      console.error('  --untrash   (restore from trash)\n');
      process.exit(1);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 2: "AT LEAST ONE OPTION" VALIDATION
    // ═══════════════════════════════════════════════════════════════════

    // Check that at least one data-modifying flag is provided
    // Exclude: --web (mode flag)
    const hasUpdateField =
      options.title ||
      options.description ||
      options.descriptionFile ||
      options.priority !== undefined ||
      options.estimate !== undefined ||
      options.noEstimate ||
      options.state ||
      options.dueDate ||
      options.noDueDate ||
      options.assignee ||
      options.noAssignee ||
      options.team ||
      options.project ||
      options.noProject ||
      options.cycle ||
      options.noCycle ||
      options.parent ||
      options.noParent ||
      options.labels ||
      options.addLabels ||
      options.removeLabels ||
      options.subscribers ||
      options.addSubscribers ||
      options.removeSubscribers ||
      options.trash ||
      options.untrash;

    if (!hasUpdateField) {
      console.error('❌ Error: No update options specified\n');
      console.error('You must provide at least one field to update.');
      console.error('\nExamples:');
      console.error('  linear-create issue update ENG-123 --title "New title"');
      console.error('  linear-create issue update ENG-123 --priority 1');
      console.error('  linear-create issue update ENG-123 --state done\n');
      console.error('For all options, see:');
      console.error('  linear-create issue update --help\n');
      process.exit(1);
    }

    // Read description from file if --description-file is provided
    let description = options.description;
    if (options.descriptionFile) {
      const result = await readContentFile(options.descriptionFile);
      if (!result.success) {
        console.error(`❌ Error reading file: ${options.descriptionFile}\n`);
        console.error(`   ${result.error}\n`);
        process.exit(1);
      }
      description = result.content;
      console.log(`📄 Read description from: ${options.descriptionFile}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 3: ISSUE RESOLUTION
    // ═══════════════════════════════════════════════════════════════════

    console.log(`🔍 Resolving issue: ${identifier}...`);

    // Try to resolve the identifier - supports both UUID and ENG-123 formats
    let issueId: string;

    // Check if it's a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(identifier)) {
      // It's a UUID - use it directly
      issueId = identifier;

      // Verify issue exists
      const issue = await getFullIssueById(issueId);
      if (!issue) {
        console.error(`❌ Error: Issue not found: "${identifier}"`);
        console.error(`   Issue UUID not found in Linear\n`);
        process.exit(1);
      }
      console.log(`   ✓ Issue found: ${issue.identifier}`);
    } else {
      // Not a UUID - try identifier format (ENG-123)
      const { resolveIssueId } = await import('../../lib/issue-resolver.js');
      const resolved = await resolveIssueId(identifier);

      if (!resolved) {
        console.error(`❌ Error: Issue not found: "${identifier}"`);
        console.error(`   Expected format: ENG-123 or UUID\n`);
        console.error('To list issues:');
        console.error('  linear-create issue list\n');
        process.exit(1);
      }

      issueId = resolved;
      console.log(`   ✓ Issue found: ${identifier}`);
    }

    // Build update data object
    const updates: IssueUpdateInput = {};

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4: BASIC FIELDS (title, description)
    // ═══════════════════════════════════════════════════════════════════

    if (options.title) {
      const title = options.title.trim();
      if (title.length < 1) {
        console.error('❌ Error: Title cannot be empty');
        process.exit(1);
      }
      updates.title = title;
      console.log(`📝 Updating title: "${title}"`);
    }

    if (description !== undefined) {
      updates.description = description;
      console.log(`📝 Updating description`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 5: PRIORITY & ESTIMATE
    // ═══════════════════════════════════════════════════════════════════

    if (options.priority !== undefined) {
      const { validatePriority } = await import('../../lib/validators.js');
      const priorityResult = validatePriority(options.priority);
      if (!priorityResult.valid) {
        console.error(`❌ ${priorityResult.error}`);
        process.exit(1);
      }
      updates.priority = options.priority;
      const priorityNames = ['None', 'Urgent', 'High', 'Normal', 'Low'];
      console.log(`🎯 Updating priority: ${priorityNames[options.priority]} (${options.priority})`);
    }

    if (options.estimate !== undefined) {
      if (options.estimate < 0) {
        console.error('❌ Error: Estimate must be a non-negative number');
        process.exit(1);
      }
      updates.estimate = options.estimate;
      console.log(`📊 Updating estimate: ${options.estimate}`);
    }

    if (options.noEstimate) {
      updates.estimate = null as any; // Linear SDK accepts null to clear field
      console.log(`📊 Clearing estimate`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 6: WORKFLOW STATE (with team validation)
    // ═══════════════════════════════════════════════════════════════════

    if (options.state) {
      const { resolveStatusOrThrow } = await import('../../lib/resolution.js');
      try {
        const stateId = await resolveStatusOrThrow(options.state, 'workflow-state');

        // If also changing team, validate state belongs to NEW team
        // Otherwise, validate state belongs to CURRENT team
        if (options.team) {
          // Will validate in team change section (phase 9)
          updates.stateId = stateId;
        } else {
          // Validate state belongs to current issue's team
          const currentIssue = await getFullIssueById(issueId);
          if (!currentIssue) {
            console.error(`❌ Error: Could not fetch current issue state`);
            process.exit(1);
          }

          const client = getLinearClient();
          const state = await client.workflowState(stateId);

          if (state) {
            const stateTeam = await state.team;
            if (stateTeam && stateTeam.id !== currentIssue.team.id) {
              console.error(`❌ Error: State validation failed\n`);
              console.error(`   State "${state.name}" belongs to team "${stateTeam.name}"`);
              console.error(`   but issue team is "${currentIssue.team.name}"`);
              console.error(`\n   Please choose a state from the "${currentIssue.team.name}" team\n`);
              process.exit(1);
            }
            console.log(`🔄 Updating state: ${state.name}`);
          }
          updates.stateId = stateId;
        }
      } catch (error) {
        console.error(`❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 7: DATES
    // ═══════════════════════════════════════════════════════════════════

    if (options.dueDate) {
      const { validateISODate } = await import('../../lib/validators.js');
      const dateResult = validateISODate(options.dueDate);
      if (!dateResult.valid) {
        console.error(`❌ ${dateResult.error}`);
        process.exit(1);
      }
      updates.dueDate = options.dueDate;
      console.log(`📅 Updating due date: ${options.dueDate}`);
    }

    if (options.noDueDate) {
      updates.dueDate = null as any; // Linear SDK accepts null to clear field
      console.log(`📅 Clearing due date`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 8: ASSIGNMENT
    // ═══════════════════════════════════════════════════════════════════

    if (options.assignee) {
      console.log(`🔍 Validating assignee...`);
      const member = await resolveMemberIdentifier(options.assignee, resolveAlias);

      if (!member) {
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
      updates.assigneeId = member.id;
    }

    if (options.noAssignee) {
      updates.assigneeId = null as any; // Linear SDK accepts null to clear field
      console.log(`👤 Removing assignee`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 9: TEAM CHANGES (with state compatibility validation)
    // ═══════════════════════════════════════════════════════════════════

    if (options.team) {
      // Resolve team alias
      let teamId = options.team;
      const resolvedTeam = resolveAlias('team', teamId);
      if (resolvedTeam !== teamId) {
        console.log(`📎 Resolved team alias "${teamId}" to ${resolvedTeam}`);
        teamId = resolvedTeam;
      }

      // Validate team exists
      console.log(`🔍 Validating team: ${teamId}...`);
      const teamCheck = await validateTeamExists(teamId);
      if (!teamCheck.valid) {
        console.error(`❌ ${teamCheck.error}`);
        process.exit(1);
      }
      console.log(`   ✓ Team found: ${teamCheck.name}`);

      // Validate workflow state compatibility
      if (options.state) {
        // If changing state too, validate against NEW team
        const { resolveStatusOrThrow } = await import('../../lib/resolution.js');
        const stateId = await resolveStatusOrThrow(options.state, 'workflow-state');
        const client = getLinearClient();
        const state = await client.workflowState(stateId);

        if (state) {
          const stateTeam = await state.team;
          if (stateTeam && stateTeam.id !== teamId) {
            console.error(`❌ Error: Team-state compatibility validation failed\n`);
            console.error(`   State "${state.name}" belongs to team "${stateTeam.name}"`);
            console.error(`   but you're moving issue to team "${teamCheck.name}"`);
            console.error(`\n   Please choose a state from the "${teamCheck.name}" team`);
            console.error(`   or remove --state to keep current state\n`);
            process.exit(1);
          }
        }
      } else {
        // If NOT changing state, check current state compatibility
        const currentIssue = await getFullIssueById(issueId);
        if (!currentIssue) {
          console.error(`❌ Error: Could not fetch current issue`);
          process.exit(1);
        }

        const currentState = currentIssue.state;
        const currentStateTeamId = currentIssue.team.id; // State's team is the issue's team

        if (currentStateTeamId !== teamId) {
          console.error(`❌ Error: Cannot move to team "${teamCheck.name}"\n`);
          console.error(`   Current state "${currentState.name}" belongs to team "${currentIssue.team.name}"`);
          console.error(`\n   To move teams, you must also change the workflow state:`);
          console.error(`     linear-create issue update ${identifier} --team ${teamCheck.name} --state <state-id>\n`);
          process.exit(1);
        }
      }

      updates.teamId = teamId;
      console.log(`🔀 Moving to team: ${teamCheck.name}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 10: PROJECT
    // ═══════════════════════════════════════════════════════════════════

    if (options.project) {
      let projectId = options.project;
      const client = getLinearClient();

      // Try alias resolution first
      const resolvedProjectId = resolveAlias('project', projectId);
      if (resolvedProjectId !== projectId) {
        console.log(`📎 Resolved project alias "${projectId}" to ${resolvedProjectId}`);
        projectId = resolvedProjectId;
      }

      // Validate project exists
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
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('project', options.project, 'project list'));
          process.exit(1);
        }

        console.log(`   ✓ Project: ${project.name}`);
        updates.projectId = projectId;
      } catch (error) {
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        console.error(formatEntityNotFoundError('project', options.project, 'project list'));
        process.exit(1);
      }
    }

    if (options.noProject) {
      updates.projectId = null as any; // Linear SDK accepts null to clear field
      console.log(`📋 Removing from project`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 11: CYCLE
    // ═══════════════════════════════════════════════════════════════════

    if (options.cycle) {
      // Resolve cycle by alias first, then validate as UUID
      const resolvedCycle = resolveAlias('cycle', options.cycle);
      if (resolvedCycle !== options.cycle) {
        console.log(`📎 Resolved cycle alias "${options.cycle}" to ${resolvedCycle}`);
      }

      // Validate format: must be UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(resolvedCycle)) {
        console.error(`❌ Error: Invalid cycle format: "${options.cycle}"`);
        console.error(`   Cycle must be a valid UUID or alias that resolves to a UUID`);
        console.error(`   Example: --cycle 550e8400-e29b-41d4-a716-446655440000\n`);
        process.exit(1);
      }

      updates.cycleId = resolvedCycle;
      console.log(`🔁 Updating cycle`);
    }

    if (options.noCycle) {
      updates.cycleId = null as any; // Linear SDK accepts null to clear field
      console.log(`🔁 Removing from cycle`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 12: PARENT RELATIONSHIP
    // ═══════════════════════════════════════════════════════════════════

    if (options.parent) {
      try {
        console.log(`🔍 Validating parent issue: ${options.parent}...`);
        const { resolveIssueId } = await import('../../lib/issue-resolver.js');
        const resolved = await resolveIssueId(options.parent);
        if (resolved) {
          updates.parentId = resolved;
          console.log(`   ✓ Parent issue found`);
        } else {
          console.error(`❌ Error: Parent issue not found: "${options.parent}"`);
          console.error(`   Expected format: ENG-123 or UUID\n`);
          process.exit(1);
        }
      } catch (error) {
        console.error(`❌ Error: Invalid parent issue identifier: "${options.parent}"`);
        console.error(`   ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.error(`   Expected format: ENG-123 or UUID\n`);
        process.exit(1);
      }
    }

    if (options.noParent) {
      updates.parentId = null as any; // Linear SDK accepts null to clear field
      console.log(`🔗 Removing parent (making root issue)`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 13: LABELS (3-MODE LOGIC: replace, add, remove)
    // ═══════════════════════════════════════════════════════════════════

    if (options.labels) {
      // Replace mode: Replace ALL labels
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const rawLabels = parseCommaSeparated(options.labels);

      if (rawLabels.length === 0) {
        // Empty string means clear all labels
        updates.labelIds = [];
        console.log(`🏷️  Clearing all labels`);
      } else {
        // Resolve all aliases
        const labelIds = rawLabels.map(id => {
          const resolved = resolveAlias('issue-label', id);
          if (resolved !== id) {
            console.log(`📎 Resolved label alias "${id}" to ${resolved}`);
          }
          return resolved;
        });
        updates.labelIds = labelIds;
        console.log(`🏷️  Replacing labels (${labelIds.length} labels)`);
      }
    } else if (options.addLabels || options.removeLabels) {
      // Add/Remove mode: Fetch current labels and merge
      console.log(`🔍 Fetching current labels...`);
      const currentIssue = await getFullIssueById(issueId);
      if (!currentIssue) {
        console.error(`❌ Error: Could not fetch current issue`);
        process.exit(1);
      }
      let currentLabelIds = currentIssue.labels.map(l => l.id);
      console.log(`   Current labels: ${currentLabelIds.length}`);

      const { parseCommaSeparated } = await import('../../lib/parsers.js');

      // Add labels
      if (options.addLabels) {
        const rawLabels = parseCommaSeparated(options.addLabels);
        const labelsToAdd = rawLabels.map(id => {
          const resolved = resolveAlias('issue-label', id);
          if (resolved !== id) {
            console.log(`📎 Resolved label alias "${id}" to ${resolved}`);
          }
          return resolved;
        });

        // Merge with current labels (deduplicate)
        currentLabelIds = [...new Set([...currentLabelIds, ...labelsToAdd])];
        console.log(`🏷️  Adding ${labelsToAdd.length} label(s)`);
      }

      // Remove labels
      if (options.removeLabels) {
        const rawLabels = parseCommaSeparated(options.removeLabels);
        const labelsToRemove = rawLabels.map(id => {
          const resolved = resolveAlias('issue-label', id);
          if (resolved !== id) {
            console.log(`📎 Resolved label alias "${id}" to ${resolved}`);
          }
          return resolved;
        });

        // Filter out labels to remove
        const beforeCount = currentLabelIds.length;
        currentLabelIds = currentLabelIds.filter(id => !labelsToRemove.includes(id));
        const removedCount = beforeCount - currentLabelIds.length;
        console.log(`🏷️  Removing ${removedCount} label(s) (${labelsToRemove.length - removedCount} not found)`);
      }

      updates.labelIds = currentLabelIds;
      console.log(`   Final label count: ${currentLabelIds.length}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 14: SUBSCRIBERS (3-MODE LOGIC: replace, add, remove)
    // ═══════════════════════════════════════════════════════════════════

    if (options.subscribers) {
      // Replace mode: Replace ALL subscribers
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const rawSubscribers = parseCommaSeparated(options.subscribers);

      if (rawSubscribers.length === 0) {
        // Empty string means clear all subscribers
        updates.subscriberIds = [];
        console.log(`👥 Clearing all subscribers`);
      } else {
        console.log(`🔍 Validating ${rawSubscribers.length} subscriber(s)...`);
        const subscriberIds: string[] = [];

        for (const identifier of rawSubscribers) {
          const member = await resolveMemberIdentifier(identifier, resolveAlias);

          if (!member) {
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
          subscriberIds.push(member.id);
        }

        updates.subscriberIds = subscriberIds;
        console.log(`👥 Replacing subscribers (${subscriberIds.length} subscribers)`);
      }
    } else if (options.addSubscribers || options.removeSubscribers) {
      // Add/Remove mode: Fetch current subscribers and merge
      console.log(`🔍 Fetching current subscribers...`);
      const currentIssue = await getFullIssueById(issueId);
      if (!currentIssue) {
        console.error(`❌ Error: Could not fetch current issue`);
        process.exit(1);
      }
      let currentSubscriberIds = currentIssue.subscribers.map(s => s.id);
      console.log(`   Current subscribers: ${currentSubscriberIds.length}`);

      const { parseCommaSeparated } = await import('../../lib/parsers.js');

      // Add subscribers
      if (options.addSubscribers) {
        const rawSubscribers = parseCommaSeparated(options.addSubscribers);
        console.log(`🔍 Validating ${rawSubscribers.length} subscriber(s) to add...`);
        const subscribersToAdd: string[] = [];

        for (const identifier of rawSubscribers) {
          const member = await resolveMemberIdentifier(identifier, resolveAlias);

          if (!member) {
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

          console.log(`   ✓ Adding: ${member.name} (${member.email})`);
          subscribersToAdd.push(member.id);
        }

        // Merge with current subscribers (deduplicate)
        currentSubscriberIds = [...new Set([...currentSubscriberIds, ...subscribersToAdd])];
        console.log(`👥 Adding ${subscribersToAdd.length} subscriber(s)`);
      }

      // Remove subscribers
      if (options.removeSubscribers) {
        const rawSubscribers = parseCommaSeparated(options.removeSubscribers);
        const subscribersToRemove: string[] = [];

        for (const identifier of rawSubscribers) {
          const member = await resolveMemberIdentifier(identifier, resolveAlias);

          if (!member) {
            const { formatEntityNotFoundError } = await import('../../lib/validators.js');
            console.error(formatEntityNotFoundError('subscriber', identifier, 'members list'));
            console.error(`   Note: Tried alias lookup, ID lookup, email lookup, and name lookup`);
            process.exit(1);
          }

          subscribersToRemove.push(member.id);
        }

        // Filter out subscribers to remove
        const beforeCount = currentSubscriberIds.length;
        currentSubscriberIds = currentSubscriberIds.filter(id => !subscribersToRemove.includes(id));
        const removedCount = beforeCount - currentSubscriberIds.length;
        console.log(
          `👥 Removing ${removedCount} subscriber(s) (${subscribersToRemove.length - removedCount} not found)`
        );
      }

      updates.subscriberIds = currentSubscriberIds;
      console.log(`   Final subscriber count: ${currentSubscriberIds.length}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 15: LIFECYCLE OPERATIONS
    // ═══════════════════════════════════════════════════════════════════

    if (options.trash) {
      updates.trashed = true;
      console.log(`🗑️  Moving to trash`);
    }

    if (options.untrash) {
      updates.trashed = false;
      console.log(`♻️  Restoring from trash`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 16: UPDATE THE ISSUE
    // ═══════════════════════════════════════════════════════════════════

    console.log('\n🚀 Updating issue...');

    const result = await updateIssue(issueId, updates);

    // Display success message
    console.log('\n✅ Issue updated successfully!');
    console.log(`   Identifier: ${result.identifier}`);
    console.log(`   Title: ${result.title}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   URL: ${result.url}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 17: WEB MODE (open in browser)
    // ═══════════════════════════════════════════════════════════════════

    if (options.web) {
      console.log(`🌐 Opening in browser: ${result.identifier} - ${result.title}`);
      await openInBrowser(result.url);
      console.log(`✓ Browser opened to ${result.url}\n`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Main entry point for issue update command
 */
export async function updateIssueCommand(identifier: string, options: UpdateOptions) {
  await updateIssueNonInteractive(identifier, options);
}
