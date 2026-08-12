import { readFileSync } from 'fs';

import { resolveAlias } from '../../lib/aliases.js';
import { withCacheWritesSuppressed } from '../../lib/cache-write-policy.js';
import { NotFoundError, RuntimeError, UsageError } from '../../lib/cli-error.js';
import { confirmDestructiveAction } from '../../lib/confirm-destructive.js';
import { guardWorkspaceForMutation } from '../../lib/confirm-write.js';
import { parseDateForCommand, validateResolutionOverride } from '../../lib/date-parser.js';
import { updateProject } from '../../lib/linear-client.js';
import { showSuccess } from '../../lib/output.js';
import { type OutputValueSource, resolveOutputMode } from '../../lib/output-mode.js';
import { resolveProject } from '../../lib/project-resolver.js';
import type { WorkspaceResolution } from '../../lib/types.js';
import { workspaceForJson } from '../../lib/workspace-banner.js';
import { resolveActiveWorkspace } from '../../lib/workspace-resolver.js';

export interface UpdateOptions {
  status?: string;
  name?: string;
  description?: string;
  content?: string;
  contentFile?: string;
  priority?: string;
  targetDate?: string;
  startDate?: string;
  // M15 Phase 1: Visual & Ownership Fields
  color?: string;
  icon?: string; // NOTE: No client-side validation - passed directly to Linear API
  // See src/commands/project/create.tsx:208 for rationale
  // See README.md "Icon Usage" and MILESTONES.md M14.6 for context
  lead?: string;
  // M15 Phase 2: Collaboration & Organization Fields
  members?: string;
  labels?: string;
  // M15 Phase 3: Date Resolutions
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  // M16 Phase 1: Link Management
  link?: string | string[]; // Adds new links
  removeLink?: string | string[]; // Removes by URL exact match
  // M16 Phase 2: Web Browser Mode
  web?: boolean;
  // M23: Dependency Management
  dependsOn?: string; // Add depends-on relations
  blocks?: string; // Add blocks relations
  dependency?: string[]; // Add advanced dependencies
  removeDependsOn?: string; // Remove depends-on relations
  removeBlocks?: string; // Remove blocks relations
  removeDependency?: string[]; // Remove all dependencies with project
  // Dry-run mode and M33 lifecycle/result controls
  dryRun?: boolean;
  trash?: boolean;
  untrash?: boolean;
  output?: string;
  outputSource?: OutputValueSource;
  json?: boolean;
  yes?: boolean;
  /** Commander represents --no-input as input=false. */
  input?: boolean;
}

// validateDateFormat removed in M22 Phase 5 - replaced with parseDateForCommand()
// Date parsing now supports flexible formats: quarters (Q1 2025), months (Jan 2025), years (2025), and ISO dates
// See src/lib/date-parser.ts for full implementation

function requireWorkspace(resolution: WorkspaceResolution): WorkspaceResolution {
  if (resolution.denied) {
    throw new RuntimeError(resolution.denied.reason + ' — ' + resolution.denied.hint);
  }
  return resolution;
}

function arrayValue(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

async function updateProjectCommandInternal(nameOrId: string, options: UpdateOptions) {
  const resolvedMode =
    options.output === undefined
      ? resolveOutputMode({ allowedModes: ['table', 'json'], json: options.json })
      : resolveOutputMode({
          allowedModes: ['table', 'json'],
          output: options.output,
          outputSource: options.outputSource ?? 'default',
          json: options.json,
        });
  if (resolvedMode === 'tsv') {
    throw new UsageError('TSV output is not supported by project update');
  }
  const mode: 'table' | 'json' = resolvedMode;

  if (options.trash && options.untrash) {
    throw new UsageError('--trash cannot be combined with --untrash');
  }

  const log = (...values: unknown[]): void => {
    if (mode === 'table') console.log(...values);
  };
  const ancillaryFailures: Array<{
    operation: string;
    target: string;
    message: string;
  }> = [];
  const recordAncillaryFailure = (
    operation: string,
    target: string,
    error: unknown,
    description: string
  ): void => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    ancillaryFailures.push({ operation, target, message });
    if (mode === 'table') {
      console.error(`   ✗ ${description}: ${message}`);
    }
  };

  // Validate mutual exclusivity of --content and --content-file
  if (options.content && options.contentFile) {
    throw new UsageError('cannot use both --content and --content-file; choose one content source');
  }

  // Read content from file if --content-file is provided
  let content = options.content;
  if (options.contentFile) {
    try {
      content = readFileSync(options.contentFile, 'utf-8');
      log(`📄 Read content from: ${options.contentFile}`);
    } catch (error) {
      throw new RuntimeError('failed to read project content file ' + options.contentFile, {
        cause: error,
      });
    }
  }

  // Validate at least one field provided
  // Note: content === undefined (not !content) to allow empty string for clearing content
  // Note: link/removeLink/dependency defaults to [] so check length instead of truthiness
  if (
    !options.status &&
    !options.name &&
    !options.description &&
    content === undefined &&
    options.priority === undefined &&
    !options.targetDate &&
    !options.startDate &&
    !options.color &&
    !options.icon &&
    !options.lead &&
    !options.members &&
    !options.labels &&
    !options.startDateResolution &&
    !options.targetDateResolution &&
    (!options.link || options.link.length === 0) &&
    (!options.removeLink || options.removeLink.length === 0) &&
    !options.dependsOn &&
    !options.blocks &&
    (!options.dependency || options.dependency.length === 0) &&
    !options.removeDependsOn &&
    !options.removeBlocks &&
    (!options.removeDependency || options.removeDependency.length === 0) &&
    !options.trash &&
    !options.untrash
  ) {
    throw new UsageError(
      'no update fields provided; specify a project field, ancillary operation, --trash, or --untrash'
    );
  }

  // Prewarm cache for potentially needed entities (reduces API calls by 40-50%)
  // Note: Only prewarm if we're updating fields that need validation
  if (options.status) {
    log('🔄 Loading workspace data...');
    const { prewarmProjectUpdate } = await import('../../lib/batch-fetcher.js');
    await prewarmProjectUpdate();
  }

  // Resolve project
  log(`🔍 Resolving project "${nameOrId}"...`);
  const resolved = await resolveProject(nameOrId);

  if (!resolved) {
    throw new NotFoundError('project not found: ' + nameOrId);
  }

  const projectId = resolved.projectId;
  log(`   ✓ Found project: "${resolved.project?.name}"`);

  // Prepare updates
  const updates: {
    statusId?: string;
    name?: string;
    description?: string;
    content?: string;
    priority?: number;
    startDate?: string;
    targetDate?: string;
    color?: string;
    icon?: string;
    leadId?: string;
    memberIds?: string[];
    labelIds?: string[];
    startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
    targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
    trashed?: boolean;
  } = {};
  const changes: string[] = [];

  // Resolve status if provided
  if (options.status) {
    const { resolveStatusOrThrow } = await import('../../lib/resolution.js');
    const statusId = await resolveStatusOrThrow(options.status, 'project-status');
    updates.statusId = statusId;
    changes.push(`Status → ${options.status}`);
  }

  // Other fields
  if (options.name) {
    updates.name = options.name;
    changes.push(`Name → "${options.name}"`);
  }

  if (options.description) {
    updates.description = options.description;
    changes.push(`Description updated`);
  }

  if (content !== undefined) {
    updates.content = content;
    changes.push(content === '' ? `Content cleared` : `Content updated`);
  }

  if (options.priority !== undefined) {
    const { validatePriority } = await import('../../lib/validators.js');
    const result = validatePriority(options.priority);
    if (!result.valid) {
      throw new UsageError(result.error || 'invalid priority value');
    }
    updates.priority = result.value;
    changes.push(`Priority → ${result.value}`);
  }

  // M22 Phase 5: Parse dates with flexible format support
  if (options.targetDate) {
    const parsed = parseDateForCommand(options.targetDate, 'target date');
    updates.targetDate = parsed.date;
    // Auto-detect resolution from parsed format, or use explicit flag if provided
    if (!options.targetDateResolution && parsed.resolution) {
      updates.targetDateResolution = parsed.resolution;
    }
    changes.push(
      `Target Date → ${parsed.displayText} (${parsed.date}${parsed.resolution ? `, resolution: ${parsed.resolution}` : ''})`
    );

    // Validate resolution override (M22.1)
    const targetValidation = validateResolutionOverride(
      options.targetDate,
      parsed.resolution,
      options.targetDateResolution
    );
    if (targetValidation.warning) {
      log(`⚠️  ${targetValidation.warning}`);
    } else if (targetValidation.info) {
      log(`ℹ️  ${targetValidation.info}`);
    }
  }

  if (options.startDate) {
    const parsed = parseDateForCommand(options.startDate, 'start date');
    updates.startDate = parsed.date;
    // Auto-detect resolution from parsed format, or use explicit flag if provided
    if (!options.startDateResolution && parsed.resolution) {
      updates.startDateResolution = parsed.resolution;
    }
    changes.push(
      `Start Date → ${parsed.displayText} (${parsed.date}${parsed.resolution ? `, resolution: ${parsed.resolution}` : ''})`
    );

    // Validate resolution override (M22.1)
    const startValidation = validateResolutionOverride(
      options.startDate,
      parsed.resolution,
      options.startDateResolution
    );
    if (startValidation.warning) {
      log(`⚠️  ${startValidation.warning}`);
    } else if (startValidation.info) {
      log(`ℹ️  ${startValidation.info}`);
    }
  }

  // M15 Phase 1: Visual & Ownership Fields

  // Color validation and normalization
  if (options.color) {
    const { validateAndNormalizeColor } = await import('../../lib/validators.js');
    const colorResult = validateAndNormalizeColor(options.color);
    if (!colorResult.valid) {
      throw new UsageError(colorResult.error || 'invalid color value');
    }
    updates.color = colorResult.value;
    changes.push(`Color → ${colorResult.value}`);
  }

  // Icon handling (no client-side validation per M14.6)
  if (options.icon) {
    if (!options.icon.trim()) {
      throw new UsageError('icon cannot be empty');
    }
    updates.icon = options.icon;
    changes.push(`Icon → ${options.icon}`);
  }

  // Lead resolution
  if (options.lead) {
    log(`🔍 Validating lead member...`);
    const { resolveMemberIdentifier } = await import('../../lib/linear-client.js');
    const { resolveAlias } = await import('../../lib/aliases.js');

    const member = await resolveMemberIdentifier(options.lead, resolveAlias);

    if (!member) {
      throw new NotFoundError('lead member not found: ' + options.lead);
    }

    // Show what was resolved
    if (options.lead !== member.id) {
      if (options.lead.includes('@')) {
        log(`   📎 Resolved email "${options.lead}" to ${member.name}`);
      } else {
        log(`   📎 Resolved "${options.lead}" to ${member.name}`);
      }
    }

    log(`   ✓ Lead found: ${member.name} (${member.email})`);

    updates.leadId = member.id;
    changes.push(`Lead → ${member.name}`);
  }

  // M15 Phase 2: Collaboration & Organization Fields

  // Members resolution
  if (options.members) {
    log(`🔍 Validating ${options.members.split(',').length} member(s)...`);
    const { parseCommaSeparated } = await import('../../lib/parsers.js');
    const { resolveMemberIdentifier } = await import('../../lib/linear-client.js');
    const { resolveAlias } = await import('../../lib/aliases.js');

    const rawMembers = parseCommaSeparated(options.members);
    const resolvedMembers: string[] = [];

    for (const identifier of rawMembers) {
      const member = await resolveMemberIdentifier(identifier, resolveAlias);

      if (!member) {
        throw new NotFoundError('member not found: ' + identifier);
      }

      // Show what was resolved
      if (identifier !== member.id) {
        if (identifier.includes('@')) {
          log(`   📎 Resolved email "${identifier}" to ${member.name}`);
        } else {
          log(`   📎 Resolved "${identifier}" to ${member.name}`);
        }
      }

      log(`   ✓ Member found: ${member.name} (${member.email})`);
      resolvedMembers.push(member.id);
    }

    updates.memberIds = resolvedMembers;
    changes.push(`Members → ${resolvedMembers.length} member(s)`);
  }

  // Labels resolution
  if (options.labels) {
    const { parseCommaSeparated } = await import('../../lib/parsers.js');
    const { resolveAlias } = await import('../../lib/aliases.js');

    const rawLabels = parseCommaSeparated(options.labels);
    const resolvedLabels: string[] = [];

    for (const labelIdOrAlias of rawLabels) {
      const resolvedLabel = resolveAlias('project-label', labelIdOrAlias);

      // Log if alias was resolved
      if (resolvedLabel !== labelIdOrAlias) {
        log(`   📎 Resolved label alias "${labelIdOrAlias}" to ${resolvedLabel}`);
      }

      resolvedLabels.push(resolvedLabel);
    }

    updates.labelIds = resolvedLabels;
    changes.push(`Labels → ${resolvedLabels.length} label(s)`);
  }

  if (options.trash) {
    updates.trashed = true;
    changes.push('Lifecycle → trashed');
  } else if (options.untrash) {
    updates.trashed = false;
    changes.push('Lifecycle → active');
  }

  // M15 Phase 3: Date Resolutions

  // Start date resolution (resolution-only update)
  if (options.startDateResolution && !options.startDate) {
    updates.startDateResolution = options.startDateResolution;
    changes.push(`Start Date Resolution → ${options.startDateResolution}`);
    log(`ℹ️  Updating resolution without changing date (resolution-only update)`);
  }

  // Target date resolution (resolution-only update)
  if (options.targetDateResolution && !options.targetDate) {
    updates.targetDateResolution = options.targetDateResolution;
    changes.push(`Target Date Resolution → ${options.targetDateResolution}`);
    log(`ℹ️  Updating resolution without changing date (resolution-only update)`);
  }

  // Dry-run mode: emit every planned primary and ancillary effect without prompting.
  if (options.dryRun) {
    const workspace = requireWorkspace(resolveActiveWorkspace());
    const plan = {
      dryRun: true,
      operation: 'project.update',
      workspace: workspaceForJson(workspace),
      project: { id: projectId, name: resolved.project?.name ?? null },
      updates,
      ancillary: {
        addLinks: arrayValue(options.link),
        removeLinks: arrayValue(options.removeLink),
        dependsOn: options.dependsOn ?? null,
        blocks: options.blocks ?? null,
        dependencies: options.dependency ?? [],
        removeDependsOn: options.removeDependsOn ?? null,
        removeBlocks: options.removeBlocks ?? null,
        removeDependencies: options.removeDependency ?? [],
        openInBrowser: options.web === true,
      },
      validation: { localWrites: false, serverMutation: false },
    };
    if (mode === 'json') {
      process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
    } else {
      log('\n[dry-run] Would update project with:');
      log(JSON.stringify(plan, null, 2));
    }
    return;
  }

  const workspace = await guardWorkspaceForMutation({
    json: mode === 'json',
    yes: options.yes === true,
    noInput: options.input === false,
  });
  if (options.trash) {
    const confirmation = await confirmDestructiveAction(
      'Move project "' + (resolved.project?.name ?? projectId) + '" to trash?',
      { yes: options.yes === true, noInput: options.input === false }
    );
    if (confirmation?.confirmed === false) {
      if (mode === 'json') {
        process.stdout.write(
          JSON.stringify({
            ok: false,
            cancelled: true,
            operation: 'project.update',
            workspace: workspaceForJson(workspace),
            project: { id: projectId },
          }) + '\n'
        );
      } else {
        log('Project trash cancelled.');
      }
      return;
    }
  }

  // Update project
  log(`\n📝 Updating project...`);
  for (const change of changes) {
    log(`   ${change}`);
  }

  const result = await updateProject(projectId, updates);

  // M16 Phase 1: External Link Management - Add Links
  if (options.link) {
    const { parsePipeDelimitedArray } = await import('../../lib/parsers.js');
    const { createExternalLink } = await import('../../lib/linear-client.js');

    const linkArgs = Array.isArray(options.link) ? options.link : [options.link];
    const parsedLinks = parsePipeDelimitedArray(linkArgs);
    const linksToCreate = parsedLinks.map(({ key, value }) => ({
      url: key,
      label: value || '',
    }));

    log(`\n🔗 Adding ${linksToCreate.length} external link(s)...`);

    for (const { url, label } of linksToCreate) {
      try {
        await createExternalLink({
          url,
          label,
          projectId,
        });
        log(`   ✓ Link added: ${label || url}`);
      } catch (error) {
        recordAncillaryFailure('link.add', url, error, `Failed to add link "${url}"`);
      }
    }
  }

  // M16 Phase 1: External Link Management - Remove Links
  if (options.removeLink) {
    const { getProjectExternalLinks, deleteExternalLink } = await import(
      '../../lib/linear-client.js'
    );

    const urlsToRemove = Array.isArray(options.removeLink)
      ? options.removeLink
      : [options.removeLink];

    log(`\n🗑️  Removing ${urlsToRemove.length} link(s)...`);

    // Fetch current links
    const existingLinks = await getProjectExternalLinks(projectId);

    for (const url of urlsToRemove) {
      const link = existingLinks.find(l => l.url === url);

      if (link) {
        try {
          await deleteExternalLink(link.id);
          log(`   ✓ Removed link: ${link.label || url}`);
        } catch (error) {
          recordAncillaryFailure('link.remove', url, error, `Failed to remove link "${url}"`);
        }
      } else {
        if (mode === 'table') console.warn(`   ⚠️  Link not found (skipped): ${url}`);
      }
    }
  }

  // M23: Dependency Management - Add dependencies
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
      anchorType: 'start' | 'end';
      relatedAnchorType: 'start' | 'end';
      type: 'depends-on' | 'blocks' | 'advanced';
    }> = [];

    // Parse --depends-on
    if (options.dependsOn) {
      try {
        const projectIds = resolveDependencyProjects(options.dependsOn);
        for (const relatedProjectId of projectIds) {
          if (relatedProjectId === projectId) {
            if (mode === 'table') {
              console.error(`\n⚠️  Warning: Skipping self-referential dependency`);
            }
            continue;
          }
          dependenciesToCreate.push({
            relatedProjectId,
            anchorType: 'end',
            relatedAnchorType: 'start',
            type: 'depends-on',
          });
        }
      } catch (error) {
        recordAncillaryFailure(
          'dependency.parse.depends-on',
          options.dependsOn,
          error,
          'Error parsing --depends-on'
        );
      }
    }

    // Parse --blocks
    if (options.blocks) {
      try {
        const projectIds = resolveDependencyProjects(options.blocks);
        for (const relatedProjectId of projectIds) {
          if (relatedProjectId === projectId) {
            if (mode === 'table') {
              console.error(`\n⚠️  Warning: Skipping self-referential dependency`);
            }
            continue;
          }
          dependenciesToCreate.push({
            relatedProjectId,
            anchorType: 'start',
            relatedAnchorType: 'end',
            type: 'blocks',
          });
        }
      } catch (error) {
        recordAncillaryFailure(
          'dependency.parse.blocks',
          options.blocks,
          error,
          'Error parsing --blocks'
        );
      }
    }

    // Parse --dependency (advanced)
    if (options.dependency && options.dependency.length > 0) {
      for (const depSpec of options.dependency) {
        try {
          const parsed = parseAdvancedDependency(depSpec);
          if (parsed.relatedProjectId === projectId) {
            if (mode === 'table') {
              console.error(`\n⚠️  Warning: Skipping self-referential dependency in "${depSpec}"`);
            }
            continue;
          }
          dependenciesToCreate.push({
            relatedProjectId: parsed.relatedProjectId,
            anchorType: parsed.anchorType,
            relatedAnchorType: parsed.relatedAnchorType,
            type: 'advanced',
          });
        } catch (error) {
          recordAncillaryFailure(
            'dependency.parse.advanced',
            depSpec,
            error,
            `Error parsing --dependency "${depSpec}"`
          );
        }
      }
    }

    // Create dependencies
    if (dependenciesToCreate.length > 0) {
      log(
        `\n🔗 Adding ${dependenciesToCreate.length} dependenc${dependenciesToCreate.length === 1 ? 'y' : 'ies'}...`
      );

      for (const dep of dependenciesToCreate) {
        try {
          const relation = await createProjectRelation(client, {
            type: 'dependency',
            projectId,
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
          log(`   ✓ Added: ${typeLabel} ${relation.relatedProject.name}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          if (errorMsg.includes('Relation exists') || errorMsg.includes('already exists')) {
            log(`   ⚠️  Dependency already exists with ${dep.relatedProjectId}`);
          } else {
            recordAncillaryFailure(
              'dependency.add',
              dep.relatedProjectId,
              error,
              'Failed to add dependency'
            );
          }
        }
      }
    }
  }

  // M23: Dependency Management - Remove dependencies
  if (
    options.removeDependsOn ||
    options.removeBlocks ||
    (options.removeDependency && options.removeDependency.length > 0)
  ) {
    const { getLinearClient, getProjectRelations, deleteProjectRelation } = await import(
      '../../lib/linear-client.js'
    );
    const { resolveDependencyProjects, getRelationDirection } = await import(
      '../../lib/parsers.js'
    );
    const client = getLinearClient();

    // Fetch existing relations
    const existingRelations = await getProjectRelations(client, projectId);

    const relationsToDelete: string[] = [];

    // Remove --depends-on relations
    if (options.removeDependsOn) {
      try {
        const targetProjectIds = resolveDependencyProjects(options.removeDependsOn);
        for (const targetId of targetProjectIds) {
          const matching = existingRelations.filter(rel => {
            const direction = getRelationDirection(rel, projectId);
            return (
              direction === 'depends-on' &&
              rel.project.id === projectId &&
              rel.relatedProject.id === targetId
            );
          });
          relationsToDelete.push(...matching.map(r => r.id));
        }
      } catch (error) {
        recordAncillaryFailure(
          'dependency.parse.remove-depends-on',
          options.removeDependsOn,
          error,
          'Error parsing --remove-depends-on'
        );
      }
    }

    // Remove --blocks relations
    if (options.removeBlocks) {
      try {
        const targetProjectIds = resolveDependencyProjects(options.removeBlocks);
        for (const targetId of targetProjectIds) {
          const matching = existingRelations.filter(rel => {
            const direction = getRelationDirection(rel, projectId);
            return (
              direction === 'blocks' &&
              rel.project.id === projectId &&
              rel.relatedProject.id === targetId
            );
          });
          relationsToDelete.push(...matching.map(r => r.id));
        }
      } catch (error) {
        recordAncillaryFailure(
          'dependency.parse.remove-blocks',
          options.removeBlocks,
          error,
          'Error parsing --remove-blocks'
        );
      }
    }

    // Remove all dependencies with specific projects
    if (options.removeDependency && options.removeDependency.length > 0) {
      try {
        const targetProjectIds = options.removeDependency.map(id => resolveAlias('project', id));

        for (const targetId of targetProjectIds) {
          const matching = existingRelations.filter(
            rel =>
              (rel.project.id === projectId && rel.relatedProject.id === targetId) ||
              (rel.relatedProject.id === projectId && rel.project.id === targetId)
          );
          relationsToDelete.push(...matching.map(r => r.id));
        }
      } catch (error) {
        recordAncillaryFailure(
          'dependency.parse.remove',
          options.removeDependency.join(','),
          error,
          'Error parsing --remove-dependency'
        );
      }
    }

    // Delete relations
    if (relationsToDelete.length > 0) {
      log(
        `\n🗑️  Removing ${relationsToDelete.length} dependenc${relationsToDelete.length === 1 ? 'y' : 'ies'}...`
      );

      for (const relationId of relationsToDelete) {
        try {
          await deleteProjectRelation(client, relationId);
          log(`   ✓ Removed dependency`);
        } catch (error) {
          recordAncillaryFailure(
            'dependency.remove',
            relationId,
            error,
            'Failed to remove dependency'
          );
        }
      }
    } else {
      log(`\n⚠️  No matching dependencies found to remove`);
    }
  }

  if (ancillaryFailures.length > 0) {
    throw new RuntimeError(
      `Project '${projectId}' was updated, but ${ancillaryFailures.length} requested ancillary operation${ancillaryFailures.length === 1 ? '' : 's'} failed`,
      {
        details: {
          projectId,
          failures: ancillaryFailures,
        },
      }
    );
  }

  log('');
  if (mode === 'json') {
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          workspace: workspaceForJson(workspace),
          operation: 'project.update',
          project: result,
          lifecycle: { trashed: updates.trashed ?? null },
        },
        null,
        2
      ) + '\n'
    );
  } else {
    showSuccess('Project updated successfully!', {
      Name: result.name,
      ID: result.id,
      URL: result.url,
    });
  }

  // M16 Phase 2: Web Browser Mode
  if (options.web) {
    log('\n🌐 Opening project in browser...');
    try {
      const { openInBrowser } = await import('../../lib/browser.js');
      await openInBrowser(result.url);
      log('✓ Browser opened.');
    } catch (error) {
      console.error(
        '⚠️  Could not open browser:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      console.error(`   Please visit: ${result.url}`);
    }
  }
}

export async function updateProjectCommand(nameOrId: string, options: UpdateOptions) {
  return withCacheWritesSuppressed(options.dryRun === true, () =>
    updateProjectCommandInternal(nameOrId, options)
  );
}
