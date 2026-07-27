import { Box, render, Text } from 'ink';
import React, { useEffect, useState } from 'react';

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
import { parseDateForCommand, validateResolutionOverride } from '../../lib/date-parser.js';
import { readContentFile } from '../../lib/file-utils.js';
import { requireInteractiveInput } from '../../lib/interaction-policy.js';
import {
  createExternalLink,
  createProject,
  getCurrentUser,
  getProjectByName,
  getTemplateById,
  type ProjectCreateInput,
  type ProjectResult,
  resolveMemberIdentifier,
  validateInitiativeExists,
  validateTeamExists,
} from '../../lib/linear-client.js';
import { silenceStdoutWhile } from '../../lib/output.js';
import type { WorkspaceResolution } from '../../lib/types.js';
import { workspaceForJson } from '../../lib/workspace-banner.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';
import { ProjectForm } from '../../ui/components/ProjectForm.js';

interface CreateOptions {
  title?: string;
  description?: string;
  initiative?: string;
  team?: string;
  template?: string;
  interactive?: boolean;
  web?: boolean;
  // Additional fields
  status?: string;
  content?: string;
  contentFile?: string;
  icon?: string;
  color?: string;
  lead?: string;
  noLead?: boolean;
  labels?: string;
  convertedFrom?: string;
  startDate?: string;
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDate?: string;
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  priority?: number;
  members?: string;
  link?: string | string[];
  // M23: Dependency flags
  dependsOn?: string;
  blocks?: string;
  dependency?: string[];
  // Dry-run mode
  dryRun?: boolean;
  json?: boolean; // Machine-readable output (incl. workspace.source)
  yes?: boolean; // Skip the auto-detected-workspace confirmation
}

function requireWorkspace(resolution: WorkspaceResolution): WorkspaceResolution {
  if (resolution.denied) {
    throw new RuntimeError(resolution.denied.reason + ' — ' + resolution.denied.hint);
  }
  return resolution;
}

// Non-interactive mode
async function createProjectNonInteractive(options: CreateOptions) {
  // Under --json, silence stdout progress so only the final JSON object lands on
  // stdout. Restore immediately before either final JSON result.
  const restoreLog = silenceStdoutWhile(!!options.json);
  let stdoutRestored = false;
  const restoreStdout = () => {
    if (!stdoutRestored) {
      restoreLog();
      stdoutRestored = true;
    }
  };
  try {
    // Validate mutual exclusivity of --content and --content-file
    if (options.content && options.contentFile) {
      throw new UsageError('Cannot use both --content and --content-file');
    }

    // Read content from file if --content-file is provided
    let content = options.content;
    if (options.contentFile) {
      const fileResult = await readContentFile(options.contentFile);
      if (!fileResult.success) {
        if (options.json)
          throw new RuntimeError(fileResult.error ?? 'Could not read project content file');
        console.error(`❌ ${fileResult.error}`);
        process.exit(1);
      }
      content = fileResult.content;
      console.log(`📄 Read content from: ${options.contentFile}`);
    }

    // Validate required fields
    if (!options.title) {
      throw new UsageError('--title is required; provide a title or use --interactive');
    }

    const title = options.title.trim();

    // Validate title length
    if (title.length < 3) {
      throw new UsageError('Title must be at least 3 characters');
    }

    // Get config for defaults
    const config = getConfig();

    let initiativeId = options.initiative || config.defaultInitiative;
    let teamId = options.team || config.defaultTeam;
    let templateId = options.template || config.defaultProjectTemplate;

    if (!teamId) {
      throw new UsageError(
        'Team is required for project creation; pass --team <id|alias> or configure defaultTeam'
      );
    }

    // Prewarm only after all required local input is present.
    if (config.prewarmCacheOnCreate !== false) {
      console.log('🔄 Loading workspace data...');
      const { prewarmProjectCreation } = await import('../../lib/batch-fetcher.js');
      await prewarmProjectCreation();
    }

    // Resolve aliases if provided
    if (initiativeId) {
      const resolvedInitiative = resolveAlias('initiative', initiativeId);
      if (resolvedInitiative !== initiativeId) {
        console.log(`📎 Resolved initiative alias "${initiativeId}" to ${resolvedInitiative}`);
        initiativeId = resolvedInitiative;
      }
    }

    if (teamId) {
      const resolvedTeam = resolveAlias('team', teamId);
      if (resolvedTeam !== teamId) {
        console.log(`📎 Resolved team alias "${teamId}" to ${resolvedTeam}`);
        teamId = resolvedTeam;
      }
    }

    // Resolve template alias if provided
    if (templateId) {
      const resolvedTemplate = resolveAlias('project-template', templateId);
      if (resolvedTemplate !== templateId) {
        console.log(`📎 Resolved project template alias "${templateId}" to ${resolvedTemplate}`);
        templateId = resolvedTemplate;
      }
    }

    // Validate template if provided
    if (templateId) {
      console.log(`🔍 Validating template: ${templateId}...`);
      const template = await getTemplateById(templateId);
      if (!template) {
        if (options.json) throw new NotFoundError(`project template not found: ${templateId}`);
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        console.error(formatEntityNotFoundError('template', templateId, 'templates list projects'));
        process.exit(1);
      }
      if (template.type !== 'project') {
        if (options.json) {
          throw new UsageError(
            `Template type mismatch: "${template.name}" is a ${template.type} template, not a project template`
          );
        }
        console.error(
          `❌ Template type mismatch: "${template.name}" is a ${template.type} template, not a project template`
        );
        process.exit(1);
      }
      console.log(`   ✓ Template found: ${template.name}`);
    }

    // Resolve status if provided
    let statusId = options.status;
    if (statusId) {
      const { resolveStatusOrThrow } = await import('../../lib/resolution.js');
      statusId = await resolveStatusOrThrow(statusId, 'project-status');
    }

    // Validate initiative if provided
    if (initiativeId) {
      console.log(`🔍 Validating initiative: ${initiativeId}...`);
      const initiativeCheck = await validateInitiativeExists(initiativeId);
      if (!initiativeCheck.valid) {
        if (options.json)
          throw new RuntimeError(initiativeCheck.error ?? 'Initiative validation failed');
        console.error(`❌ ${initiativeCheck.error}`);
        process.exit(1);
      }
      console.log(`   ✓ Initiative found: ${initiativeCheck.name}`);
    }

    // Validate team
    console.log(`🔍 Validating team: ${teamId}...`);
    const teamCheck = await validateTeamExists(teamId);
    if (!teamCheck.valid) {
      if (options.json) throw new RuntimeError(teamCheck.error ?? 'Team validation failed');
      console.error(`❌ ${teamCheck.error}`);
      process.exit(1);
    }
    console.log(`   ✓ Team found: ${teamCheck.name}`);

    console.log('🔍 Checking for duplicate project name...');

    // Check for duplicates
    const exists = await getProjectByName(title);
    if (exists) {
      if (options.json) throw new RuntimeError(`A project named "${title}" already exists`);
      console.error(`❌ Error: A project named "${title}" already exists`);
      console.error('   Please choose a different name');
      process.exit(1);
    }

    // ════════════════════════════════════════════════════════════════
    // ICON VALIDATION: DELIBERATELY REMOVED
    // ════════════════════════════════════════════════════════════════
    // Icons are passed directly to Linear API without CLI validation.
    //
    // Investigation revealed:
    // 1. Linear's GraphQL API has no endpoint to fetch the standard icon catalog
    // 2. The `emojis` query only returns custom organization emojis (user-uploaded)
    // 3. Our curated CURATED_ICONS list (67 icons) was missing most valid Linear icons
    // 4. Valid icons like "Checklist", "Skull", "Tree", "Joystick" were failing validation
    //
    // Decision: Remove client-side validation, rely on Linear's server-side validation.
    // This eliminates maintenance burden and ensures all valid Linear icons work.
    //
    // The curated icon list in src/lib/icons.ts remains available for discovery
    // via the `icons list` command, but is not used for validation.
    //
    // See: README.md "Icon Usage" section, MILESTONES.md M14.6
    // ════════════════════════════════════════════════════════════════

    // Validate color if provided
    if (options.color) {
      const { validateAndNormalizeColor } = await import('../../lib/validators.js');
      const colorResult = validateAndNormalizeColor(options.color);
      if (!colorResult.valid) {
        if (options.json) throw new UsageError(colorResult.error ?? 'Invalid project color');
        console.error(colorResult.error);
        process.exit(1);
      }
      // Use the normalized color value (with # prefix)
      options.color = colorResult.value;
    }

    console.log('\n🚀 Creating project...');

    // Parse and resolve label aliases
    let labelIds: string[] | undefined;
    if (options.labels) {
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const rawLabels = parseCommaSeparated(options.labels);

      // Resolve all aliases
      labelIds = rawLabels.map(id => {
        const resolved = resolveAlias('project-label', id);
        if (resolved !== id) {
          console.log(`📎 Resolved project label alias "${id}" to ${resolved}`);
        }
        return resolved;
      });
    }

    // Resolve and validate member aliases
    let memberIds: string[] | undefined;
    if (options.members) {
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const rawMembers = parseCommaSeparated(options.members);

      // Validate all members exist using smart resolution
      console.log(`🔍 Validating ${rawMembers.length} project member(s)...`);
      const resolvedMembers: string[] = [];

      for (const identifier of rawMembers) {
        const member = await resolveMemberIdentifier(identifier, resolveAlias);

        if (!member) {
          if (options.json) throw new NotFoundError(`project member not found: ${identifier}`);
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('member', identifier, 'members list'));
          console.error(`   Note: Tried alias lookup, ID lookup, and email lookup`);
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

        console.log(`   ✓ Member found: ${member.name} (${member.email})`);
        resolvedMembers.push(member.id);
      }

      memberIds = resolvedMembers;
    }

    // Determine project lead
    let leadId: string | undefined;

    if (options.lead) {
      // Explicit lead specified - resolve using smart resolution
      console.log(`🔍 Validating lead member...`);
      const member = await resolveMemberIdentifier(options.lead, resolveAlias);

      if (!member) {
        if (options.json) throw new NotFoundError(`lead member not found: ${options.lead}`);
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        console.error(formatEntityNotFoundError('lead member', options.lead, 'members list'));
        console.error(`   Note: Tried alias lookup, ID lookup, and email lookup`);
        process.exit(1);
      }

      // Show what was resolved
      if (options.lead !== member.id) {
        if (options.lead.includes('@')) {
          console.log(`📎 Resolved email "${options.lead}" to ${member.name}`);
        } else {
          console.log(`📎 Resolved "${options.lead}" to ${member.name}`);
        }
      }

      console.log(`   ✓ Lead found: ${member.name} (${member.email})`);
      leadId = member.id;
    } else if (options.noLead === true) {
      // Explicit no-lead specified - don't assign a lead
      leadId = undefined;
    } else {
      // Check config setting for auto-assign
      if (config.defaultAutoAssignLead !== false) {
        // Default is true
        try {
          const currentUser = await getCurrentUser();
          leadId = currentUser.id;
          console.log(`👤 Auto-assigning lead to: ${currentUser.name}`);
        } catch (error) {
          const message = `Could not auto-assign lead: ${error instanceof Error ? error.message : 'Unknown error'}`;
          if (!options.json) {
            console.warn(`⚠️  Warning: ${message}`);
            console.warn('   Continuing without lead assignment.');
          }
          leadId = undefined;
        }
      }
    }

    // Parse dates with flexible format support (M22 Phase 5)
    let startDateParsed = null;
    let targetDateParsed = null;

    if (options.startDate) {
      startDateParsed = parseDateForCommand(options.startDate, 'start date');
      console.log(
        `📅 Start date: ${startDateParsed.displayText} (${startDateParsed.date}${startDateParsed.resolution ? `, resolution: ${startDateParsed.resolution}` : ''})`
      );

      // Validate resolution override (M22.1)
      const startValidation = validateResolutionOverride(
        options.startDate,
        startDateParsed.resolution,
        options.startDateResolution
      );
      if (startValidation.warning) {
        console.log(`⚠️  ${startValidation.warning}`);
      } else if (startValidation.info) {
        console.log(`ℹ️  ${startValidation.info}`);
      }
    }

    if (options.targetDate) {
      targetDateParsed = parseDateForCommand(options.targetDate, 'target date');
      console.log(
        `📅 Target date: ${targetDateParsed.displayText} (${targetDateParsed.date}${targetDateParsed.resolution ? `, resolution: ${targetDateParsed.resolution}` : ''})`
      );

      // Validate resolution override (M22.1)
      const targetValidation = validateResolutionOverride(
        options.targetDate,
        targetDateParsed.resolution,
        options.targetDateResolution
      );
      if (targetValidation.warning) {
        console.log(`⚠️  ${targetValidation.warning}`);
      } else if (targetValidation.info) {
        console.log(`ℹ️  ${targetValidation.info}`);
      }
    }

    // Create the project
    const projectData: ProjectCreateInput = {
      name: title,
      description: options.description,
      initiativeId,
      teamId,
      templateId,
      // Additional fields
      statusId,
      content,
      icon: options.icon,
      color: options.color,
      leadId,
      labelIds,
      convertedFromIssueId: options.convertedFrom,
      startDate: startDateParsed?.date || options.startDate,
      startDateResolution: options.startDateResolution || startDateParsed?.resolution,
      targetDate: targetDateParsed?.date || options.targetDate,
      targetDateResolution: options.targetDateResolution || targetDateParsed?.resolution,
      priority: options.priority,
      memberIds,
    };

    // Dry-run mode: print payload and exit without creating
    if (options.dryRun) {
      const workspace = requireWorkspace(resolveActiveWorkspace());
      const plan = {
        dryRun: true,
        operation: 'project.create',
        workspace: workspaceForJson(workspace),
        project: projectData,
        ancillary: {
          links:
            options.link === undefined
              ? []
              : Array.isArray(options.link)
                ? options.link
                : [options.link],
          dependsOn: options.dependsOn ?? null,
          blocks: options.blocks ?? null,
          dependencies: options.dependency ?? [],
        },
        validation: { localWrites: false, serverMutation: false },
      };
      console.error('\n[dry-run] Would create project with:');
      restoreStdout();
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    // Workspace safety (R11): banner + auto-detected-write confirmation, before
    // the create (and after dry-run, which never writes).
    const ws = await guardWorkspaceForMutation(options);

    const result = await createProject(projectData);

    // Create external links if provided
    if (options.link) {
      const { parsePipeDelimitedArray } = await import('../../lib/parsers.js');
      const linkArgs = Array.isArray(options.link) ? options.link : [options.link];

      if (linkArgs.length > 0) {
        // Parse link arguments: format is "URL" or "URL|Label"
        const parsedLinks = parsePipeDelimitedArray(linkArgs);
        const linksToCreate = parsedLinks.map(({ key, value }) => ({
          url: key,
          label: value || '',
        }));

        console.log(`\n🔗 Creating ${linksToCreate.length} external link(s)...`);

        for (const { url, label } of linksToCreate) {
          try {
            await createExternalLink({
              url,
              label,
              projectId: result.id,
            });
            console.log(`   ✓ Link created: ${label || url}`);
          } catch (error) {
            console.error(
              `   ✗ Failed to create link "${url}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }
    }

    // M23: Create project dependencies if provided
    if (
      options.dependsOn ||
      options.blocks ||
      (options.dependency && options.dependency.length > 0)
    ) {
      const { getLinearClient, createProjectRelation } = await import('../../lib/linear-client.js');
      const { resolveDependencyProjects, parseAdvancedDependency } = await import(
        '../../lib/parsers.js'
      );
      const client = getLinearClient();

      const dependenciesToCreate: Array<{
        relatedProjectId: string;
        relatedProjectName?: string;
        anchorType: 'start' | 'end';
        relatedAnchorType: 'start' | 'end';
        type: 'depends-on' | 'blocks' | 'advanced';
      }> = [];

      // Parse --depends-on (end → start)
      if (options.dependsOn) {
        try {
          const projectIds = resolveDependencyProjects(options.dependsOn);
          for (const projectId of projectIds) {
            // Validate not self-referential
            if (projectId === result.id) {
              console.error(
                `\n⚠️  Warning: Skipping self-referential dependency (project cannot depend on itself)`
              );
              continue;
            }
            dependenciesToCreate.push({
              relatedProjectId: projectId,
              anchorType: 'end',
              relatedAnchorType: 'start',
              type: 'depends-on',
            });
          }
        } catch (error) {
          console.error(
            `\n❌ Error parsing --depends-on: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Parse --blocks (start → end, but we create reverse relations)
      if (options.blocks) {
        try {
          const projectIds = resolveDependencyProjects(options.blocks);
          for (const projectId of projectIds) {
            // Validate not self-referential
            if (projectId === result.id) {
              console.error(
                `\n⚠️  Warning: Skipping self-referential dependency (project cannot block itself)`
              );
              continue;
            }
            // For "blocks", create a dependency where the OTHER project depends on THIS project
            // This means: their end waits for my start
            dependenciesToCreate.push({
              relatedProjectId: projectId,
              anchorType: 'start',
              relatedAnchorType: 'end',
              type: 'blocks',
            });
          }
        } catch (error) {
          console.error(
            `\n❌ Error parsing --blocks: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      // Parse --dependency (advanced syntax)
      if (options.dependency && options.dependency.length > 0) {
        for (const depSpec of options.dependency) {
          try {
            const parsed = parseAdvancedDependency(depSpec);
            // Validate not self-referential
            if (parsed.relatedProjectId === result.id) {
              console.error(`\n⚠️  Warning: Skipping self-referential dependency in "${depSpec}"`);
              continue;
            }
            dependenciesToCreate.push({
              relatedProjectId: parsed.relatedProjectId,
              anchorType: parsed.anchorType,
              relatedAnchorType: parsed.relatedAnchorType,
              type: 'advanced',
            });
          } catch (error) {
            console.error(
              `\n❌ Error parsing --dependency "${depSpec}": ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }

      // Create all dependencies
      if (dependenciesToCreate.length > 0) {
        console.log(
          `\n🔗 Creating ${dependenciesToCreate.length} project dependenc${dependenciesToCreate.length === 1 ? 'y' : 'ies'}...`
        );

        const successfulDeps: string[] = [];
        const failedDeps: Array<{ project: string; error: string }> = [];

        for (const dep of dependenciesToCreate) {
          try {
            const relation = await createProjectRelation(client, {
              type: 'dependency',
              projectId: result.id,
              relatedProjectId: dep.relatedProjectId,
              anchorType: dep.anchorType,
              relatedAnchorType: dep.relatedAnchorType,
            });

            const typeLabel =
              dep.type === 'depends-on'
                ? 'depends on'
                : dep.type === 'blocks'
                  ? 'blocks'
                  : `${dep.anchorType}→${dep.relatedAnchorType}`;
            console.log(`   ✓ Dependency created: ${typeLabel} ${relation.relatedProject.name}`);
            successfulDeps.push(relation.relatedProject.name);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            failedDeps.push({
              project: dep.relatedProjectId,
              error: errorMsg,
            });

            // Check if it's a duplicate error (friendly message)
            if (errorMsg.includes('Relation exists') || errorMsg.includes('already exists')) {
              console.log(`   ⚠️  Dependency already exists with ${dep.relatedProjectId}`);
            } else {
              console.error(
                `   ✗ Failed to create dependency with ${dep.relatedProjectId}: ${errorMsg}`
              );
            }
          }
        }

        // Summary
        if (failedDeps.length > 0) {
          console.log(
            `\n✅ Created ${successfulDeps.length} of ${dependenciesToCreate.length} dependencies`
          );
          if (
            failedDeps.some(
              f => !f.error.includes('Relation exists') && !f.error.includes('already exists')
            )
          ) {
            console.log(`\n💡 Tip: Fix failed dependencies with:`);
            console.log(
              `   agent2linear project dependencies add ${result.id} --depends-on <project-id>`
            );
          }
        }
      }
    }

    if (options.json) {
      restoreStdout();
      const urlKey = result.url.split('linear.app/')[1]?.split('/')[0];
      console.log(
        JSON.stringify(
          { ok: true, workspace: workspaceForJson(ws, urlKey), project: result },
          null,
          2
        )
      );
      process.exit(0);
    }

    // Display success message
    displaySuccess(result, ws);
  } catch (error) {
    restoreStdout();
    if (options.json) throw error;
    if (error instanceof CliError) throw error;
    if (isAuthenticationError(error)) throw error;
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Interactive mode component
function App({ options: _options }: { options: CreateOptions }) {
  const [projectData, setProjectData] = useState<ProjectCreateInput | null>(null);
  const [result, setResult] = useState<ProjectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [config] = useState(() => getConfig());

  const defaultInitiative = config.defaultInitiative
    ? { id: config.defaultInitiative, name: 'Default Initiative' }
    : undefined;

  const defaultTeam = config.defaultTeam
    ? { id: config.defaultTeam, name: 'Default Team' }
    : undefined;

  useEffect(() => {
    if (!projectData) return;

    async function create() {
      if (!projectData) return; // Additional null check for TypeScript

      try {
        setChecking(true);

        // Check for duplicates
        const exists = await getProjectByName(projectData.name);
        if (exists) {
          setError(
            `A project named "${projectData.name}" already exists. Please choose a different name.`
          );
          setChecking(false);
          process.exit(1);
          return;
        }

        // Auto-assign lead if not already set and config allows
        const finalProjectData = { ...projectData };
        if (!finalProjectData.leadId && config.defaultAutoAssignLead !== false) {
          try {
            const currentUser = await getCurrentUser();
            finalProjectData.leadId = currentUser.id;
          } catch {
            // Silently continue without lead if user fetch fails
          }
        }

        // Create the project
        const projectResult = await createProject(finalProjectData);
        setResult(projectResult);
        setChecking(false);

        // Exit after showing success
        setTimeout(() => process.exit(0), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setChecking(false);
        process.exit(1);
      }
    }

    create();
  }, [projectData]);

  if (error) {
    return (
      <Box>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (checking) {
    return (
      <Box>
        <Text>🔍 Checking for duplicates and creating project...</Text>
      </Box>
    );
  }

  if (result) {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>
          ✅ Project created successfully!
        </Text>
        <Box marginTop={1}>
          <Text> Name: {result.name}</Text>
        </Box>
        <Box>
          <Text> ID: {result.id}</Text>
        </Box>
        <Box>
          <Text> URL: {result.url}</Text>
        </Box>
        <Box>
          <Text> State: {result.state}</Text>
        </Box>
        {result.initiative && (
          <Box>
            <Text> Initiative: {result.initiative.name}</Text>
          </Box>
        )}
        {result.team && (
          <Box>
            <Text> Team: {result.team.name}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <ProjectForm
      onSubmit={setProjectData}
      defaultInitiative={defaultInitiative}
      defaultTeam={defaultTeam}
    />
  );
}

function displaySuccess(result: ProjectResult, ws?: WorkspaceResolution) {
  console.log('\n✅ Project created successfully!');
  if (ws) {
    console.log(`   Workspace: ${ws.name ?? (ws.source === 'flag' ? '(ad-hoc)' : '(default)')}`);
  }
  console.log(`   Name: ${result.name}`);
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: ${result.url}`);
  console.log(`   State: ${result.state}`);

  if (result.initiative) {
    console.log(`   Initiative: ${result.initiative.name}`);
  }

  if (result.team) {
    console.log(`   Team: ${result.team.name}`);
  }

  console.log('');
}

async function createProjectCommandInternal(options: CreateOptions = {}) {
  if (options.dryRun && options.web) {
    throw new UsageError('--web cannot be combined with --dry-run');
  }
  if (options.dryRun && options.interactive) {
    throw new UsageError('--interactive cannot be combined with --dry-run');
  }
  if (options.json && options.web) {
    throw new UsageError('--web cannot be combined with JSON output');
  }
  if (options.json && options.interactive) {
    throw new UsageError('--interactive cannot be combined with JSON output');
  }

  // Handle --web flag: open Linear in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear in your browser...');
      await openInBrowser('https://linear.app/');
      console.log('✓ Browser opened. Create your project in Linear.');
      process.exit(0);
    } catch (error) {
      console.error(
        '❌ Error opening browser:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error('   Please visit https://linear.app/ manually.');
      process.exit(1);
    }
    return;
  }

  // Determine if interactive mode (opt-in with --interactive flag)
  const isInteractive = options.interactive === true;

  if (isInteractive) {
    requireInteractiveInput('project create');
    // Interactive mode with Ink
    render(<App options={options} />);
  } else {
    // Non-interactive mode (default)
    await createProjectNonInteractive(options);
  }
}

export async function createProjectCommand(options: CreateOptions = {}) {
  return withCacheWritesSuppressed(options.dryRun === true, () =>
    createProjectCommandInternal(options)
  );
}
