import { readFileSync } from 'fs';
import { resolveProject } from '../../lib/project-resolver.js';
import { updateProject } from '../../lib/linear-client.js';
import { showEntityNotFound, showError, showSuccess } from '../../lib/output.js';
import { resolveAlias } from '../../lib/aliases.js';
import { parseDateForCommand, validateResolutionOverride } from '../../lib/date-parser.js';

interface UpdateOptions {
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
  icon?: string;  // NOTE: No client-side validation - passed directly to Linear API
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
  link?: string | string[];        // Adds new links
  removeLink?: string | string[];  // Removes by URL exact match
  // M16 Phase 2: Web Browser Mode
  web?: boolean;
  // M23: Dependency Management
  dependsOn?: string;              // Add depends-on relations
  blocks?: string;                 // Add blocks relations
  dependency?: string[];           // Add advanced dependencies
  removeDependsOn?: string;        // Remove depends-on relations
  removeBlocks?: string;           // Remove blocks relations
  removeDependency?: string[];     // Remove all dependencies with project
}

// validateDateFormat removed in M22 Phase 5 - replaced with parseDateForCommand()
// Date parsing now supports flexible formats: quarters (Q1 2025), months (Jan 2025), years (2025), and ISO dates
// See src/lib/date-parser.ts for full implementation

export async function updateProjectCommand(nameOrId: string, options: UpdateOptions) {
  try {
    // Validate mutual exclusivity of --content and --content-file
    if (options.content && options.contentFile) {
      showError(
        'Cannot use both --content and --content-file',
        'Choose one:\n' +
        '  --content "markdown text"  (inline content)\n' +
        '  --content-file path/to/file.md  (file content)'
      );
      process.exit(1);
    }

    // Read content from file if --content-file is provided
    let content = options.content;
    if (options.contentFile) {
      try {
        content = readFileSync(options.contentFile, 'utf-8');
        console.log(`📄 Read content from: ${options.contentFile}`);
      } catch (error) {
        console.error(`❌ Error reading file: ${options.contentFile}\n`);
        if (error instanceof Error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.error('   File not found. Please check the path and try again.');
          } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
            console.error('   Permission denied. Please check file permissions.');
          } else {
            console.error(`   ${error.message}`);
          }
        }
        process.exit(1);
      }
    }

    // Validate at least one field provided
    // Note: content === undefined (not !content) to allow empty string for clearing content
    // Note: link/removeLink/dependency defaults to [] so check length instead of truthiness
    if (!options.status && !options.name && !options.description && content === undefined &&
        options.priority === undefined && !options.targetDate && !options.startDate &&
        !options.color && !options.icon && !options.lead && !options.members && !options.labels &&
        !options.startDateResolution && !options.targetDateResolution &&
        (!options.link || options.link.length === 0) &&
        (!options.removeLink || options.removeLink.length === 0) &&
        !options.dependsOn && !options.blocks &&
        (!options.dependency || options.dependency.length === 0) &&
        !options.removeDependsOn && !options.removeBlocks &&
        (!options.removeDependency || options.removeDependency.length === 0)) {
      showError(
        'No update fields provided',
        'Specify at least one field to update:\n' +
        '  --status, --name, --description, --content, --content-file, --priority,\n' +
        '  --target-date, --start-date, --color, --icon, --lead, --members, --labels,\n' +
        '  --start-date-resolution, --target-date-resolution, --link, --remove-link'
      );
      process.exit(1);
    }

    // Prewarm cache for potentially needed entities (reduces API calls by 40-50%)
    // Note: Only prewarm if we're updating fields that need validation
    if (options.status) {
      console.log('🔄 Loading workspace data...');
      const { prewarmProjectUpdate } = await import('../../lib/batch-fetcher.js');
      await prewarmProjectUpdate();
    }

    // Resolve project
    console.log(`🔍 Resolving project "${nameOrId}"...`);
    const resolved = await resolveProject(nameOrId);

    if (!resolved) {
      showEntityNotFound('project', nameOrId);
      console.error('   Tip: Use exact project name, project ID, or create an alias');
      process.exit(1);
    }

    const projectId = resolved.projectId;
    console.log(`   ✓ Found project: "${resolved.project?.name}"`);

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
        showError('Invalid priority value', result.error || 'Unknown error');
        process.exit(1);
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
      changes.push(`Target Date → ${parsed.displayText} (${parsed.date}${parsed.resolution ? `, resolution: ${parsed.resolution}` : ''})`);

      // Validate resolution override (M22.1)
      const targetValidation = validateResolutionOverride(
        options.targetDate,
        parsed.resolution,
        options.targetDateResolution,
      );
      if (targetValidation.warning) {
        console.log(`⚠️  ${targetValidation.warning}`);
      } else if (targetValidation.info) {
        console.log(`ℹ️  ${targetValidation.info}`);
      }
    }

    if (options.startDate) {
      const parsed = parseDateForCommand(options.startDate, 'start date');
      updates.startDate = parsed.date;
      // Auto-detect resolution from parsed format, or use explicit flag if provided
      if (!options.startDateResolution && parsed.resolution) {
        updates.startDateResolution = parsed.resolution;
      }
      changes.push(`Start Date → ${parsed.displayText} (${parsed.date}${parsed.resolution ? `, resolution: ${parsed.resolution}` : ''})`);

      // Validate resolution override (M22.1)
      const startValidation = validateResolutionOverride(
        options.startDate,
        parsed.resolution,
        options.startDateResolution,
      );
      if (startValidation.warning) {
        console.log(`⚠️  ${startValidation.warning}`);
      } else if (startValidation.info) {
        console.log(`ℹ️  ${startValidation.info}`);
      }
    }

    // M15 Phase 1: Visual & Ownership Fields

    // Color validation and normalization
    if (options.color) {
      const { validateAndNormalizeColor } = await import('../../lib/validators.js');
      const colorResult = validateAndNormalizeColor(options.color);
      if (!colorResult.valid) {
        showError('Invalid color value', colorResult.error || 'Unknown error');
        process.exit(1);
      }
      updates.color = colorResult.value;
      changes.push(`Color → ${colorResult.value}`);
    }

    // Icon handling (no client-side validation per M14.6)
    if (options.icon) {
      if (!options.icon.trim()) {
        showError('Invalid icon', 'Icon cannot be empty');
        process.exit(1);
      }
      updates.icon = options.icon;
      changes.push(`Icon → ${options.icon}`);
    }

    // Lead resolution
    if (options.lead) {
      console.log(`🔍 Validating lead member...`);
      const { resolveMemberIdentifier } = await import('../../lib/linear-client.js');
      const { resolveAlias } = await import('../../lib/aliases.js');

      const member = await resolveMemberIdentifier(options.lead, resolveAlias);

      if (!member) {
        const { formatEntityNotFoundError } = await import('../../lib/validators.js');
        console.error(formatEntityNotFoundError('lead member', options.lead, 'members list'));
        console.error(`   Note: Tried alias lookup, ID lookup, and email lookup`);
        process.exit(1);
      }

      // Show what was resolved
      if (options.lead !== member.id) {
        if (options.lead.includes('@')) {
          console.log(`   📎 Resolved email "${options.lead}" to ${member.name}`);
        } else {
          console.log(`   📎 Resolved "${options.lead}" to ${member.name}`);
        }
      }

      console.log(`   ✓ Lead found: ${member.name} (${member.email})`);

      updates.leadId = member.id;
      changes.push(`Lead → ${member.name}`);
    }

    // M15 Phase 2: Collaboration & Organization Fields

    // Members resolution
    if (options.members) {
      console.log(`🔍 Validating ${options.members.split(',').length} member(s)...`);
      const { parseCommaSeparated } = await import('../../lib/parsers.js');
      const { resolveMemberIdentifier } = await import('../../lib/linear-client.js');
      const { resolveAlias } = await import('../../lib/aliases.js');

      const rawMembers = parseCommaSeparated(options.members);
      const resolvedMembers: string[] = [];

      for (const identifier of rawMembers) {
        const member = await resolveMemberIdentifier(identifier, resolveAlias);

        if (!member) {
          const { formatEntityNotFoundError } = await import('../../lib/validators.js');
          console.error(formatEntityNotFoundError('member', identifier, 'members list'));
          console.error(`   Note: Tried alias lookup, ID lookup, and email lookup`);
          process.exit(1);
        }

        // Show what was resolved
        if (identifier !== member.id) {
          if (identifier.includes('@')) {
            console.log(`   📎 Resolved email "${identifier}" to ${member.name}`);
          } else {
            console.log(`   📎 Resolved "${identifier}" to ${member.name}`);
          }
        }

        console.log(`   ✓ Member found: ${member.name} (${member.email})`);
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
          console.log(`   📎 Resolved label alias "${labelIdOrAlias}" to ${resolvedLabel}`);
        }

        resolvedLabels.push(resolvedLabel);
      }

      updates.labelIds = resolvedLabels;
      changes.push(`Labels → ${resolvedLabels.length} label(s)`);
    }

    // M15 Phase 3: Date Resolutions

    // Start date resolution (resolution-only update)
    if (options.startDateResolution && !options.startDate) {
      updates.startDateResolution = options.startDateResolution;
      changes.push(`Start Date Resolution → ${options.startDateResolution}`);
      console.log(`ℹ️  Updating resolution without changing date (resolution-only update)`);
    }

    // Target date resolution (resolution-only update)
    if (options.targetDateResolution && !options.targetDate) {
      updates.targetDateResolution = options.targetDateResolution;
      changes.push(`Target Date Resolution → ${options.targetDateResolution}`);
      console.log(`ℹ️  Updating resolution without changing date (resolution-only update)`);
    }

    // Update project
    console.log(`\n📝 Updating project...`);
    for (const change of changes) {
      console.log(`   ${change}`);
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
        label: value || ''
      }));

      console.log(`\n🔗 Adding ${linksToCreate.length} external link(s)...`);

      for (const { url, label } of linksToCreate) {
        try {
          await createExternalLink({
            url,
            label,
            projectId,
          });
          console.log(`   ✓ Link added: ${label || url}`);
        } catch (error) {
          console.error(`   ✗ Failed to add link "${url}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    // M16 Phase 1: External Link Management - Remove Links
    if (options.removeLink) {
      const { getProjectExternalLinks, deleteExternalLink } = await import('../../lib/linear-client.js');

      const urlsToRemove = Array.isArray(options.removeLink)
        ? options.removeLink
        : [options.removeLink];

      console.log(`\n🗑️  Removing ${urlsToRemove.length} link(s)...`);

      // Fetch current links
      const existingLinks = await getProjectExternalLinks(projectId);

      for (const url of urlsToRemove) {
        const link = existingLinks.find(l => l.url === url);

        if (link) {
          try {
            await deleteExternalLink(link.id);
            console.log(`   ✓ Removed link: ${link.label || url}`);
          } catch (error) {
            console.error(`   ✗ Failed to remove link "${url}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        } else {
          console.warn(`   ⚠️  Link not found (skipped): ${url}`);
        }
      }
    }

    // M23: Dependency Management - Add dependencies
    if (options.dependsOn || options.blocks || (options.dependency && options.dependency.length > 0)) {
      const { getLinearClient, createProjectRelation } = await import('../../lib/linear-client.js');
      const { resolveDependencyProjects, parseAdvancedDependency } = await import('../../lib/parsers.js');
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
              console.error(`\n⚠️  Warning: Skipping self-referential dependency`);
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
          console.error(`\n❌ Error parsing --depends-on: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Parse --blocks
      if (options.blocks) {
        try {
          const projectIds = resolveDependencyProjects(options.blocks);
          for (const relatedProjectId of projectIds) {
            if (relatedProjectId === projectId) {
              console.error(`\n⚠️  Warning: Skipping self-referential dependency`);
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
          console.error(`\n❌ Error parsing --blocks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Parse --dependency (advanced)
      if (options.dependency && options.dependency.length > 0) {
        for (const depSpec of options.dependency) {
          try {
            const parsed = parseAdvancedDependency(depSpec);
            if (parsed.relatedProjectId === projectId) {
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
            console.error(`\n❌ Error parsing --dependency "${depSpec}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      // Create dependencies
      if (dependenciesToCreate.length > 0) {
        console.log(`\n🔗 Adding ${dependenciesToCreate.length} dependenc${dependenciesToCreate.length === 1 ? 'y' : 'ies'}...`);

        for (const dep of dependenciesToCreate) {
          try {
            const relation = await createProjectRelation(client, {
              type: 'dependency',
              projectId,
              relatedProjectId: dep.relatedProjectId,
              anchorType: dep.anchorType,
              relatedAnchorType: dep.relatedAnchorType,
            });

            const typeLabel = dep.type === 'depends-on' ? 'depends on' :
                             dep.type === 'blocks' ? 'blocks' :
                             `${dep.anchorType}→${dep.relatedAnchorType}`;
            console.log(`   ✓ Added: ${typeLabel} ${relation.relatedProject.name}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            if (errorMsg.includes('Relation exists') || errorMsg.includes('already exists')) {
              console.log(`   ⚠️  Dependency already exists with ${dep.relatedProjectId}`);
            } else {
              console.error(`   ✗ Failed: ${errorMsg}`);
            }
          }
        }
      }
    }

    // M23: Dependency Management - Remove dependencies
    if (options.removeDependsOn || options.removeBlocks || (options.removeDependency && options.removeDependency.length > 0)) {
      const { getLinearClient, getProjectRelations, deleteProjectRelation } = await import('../../lib/linear-client.js');
      const { resolveDependencyProjects, getRelationDirection } = await import('../../lib/parsers.js');
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
              return direction === 'depends-on' &&
                     (rel.project.id === projectId && rel.relatedProject.id === targetId);
            });
            relationsToDelete.push(...matching.map(r => r.id));
          }
        } catch (error) {
          console.error(`\n❌ Error parsing --remove-depends-on: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Remove --blocks relations
      if (options.removeBlocks) {
        try {
          const targetProjectIds = resolveDependencyProjects(options.removeBlocks);
          for (const targetId of targetProjectIds) {
            const matching = existingRelations.filter(rel => {
              const direction = getRelationDirection(rel, projectId);
              return direction === 'blocks' &&
                     (rel.project.id === projectId && rel.relatedProject.id === targetId);
            });
            relationsToDelete.push(...matching.map(r => r.id));
          }
        } catch (error) {
          console.error(`\n❌ Error parsing --remove-blocks: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Remove all dependencies with specific projects
      if (options.removeDependency && options.removeDependency.length > 0) {
        try {
          const targetProjectIds = options.removeDependency.map(id =>
            resolveAlias('project', id)
          );

          for (const targetId of targetProjectIds) {
            const matching = existingRelations.filter(rel =>
              (rel.project.id === projectId && rel.relatedProject.id === targetId) ||
              (rel.relatedProject.id === projectId && rel.project.id === targetId)
            );
            relationsToDelete.push(...matching.map(r => r.id));
          }
        } catch (error) {
          console.error(`\n❌ Error parsing --remove-dependency: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Delete relations
      if (relationsToDelete.length > 0) {
        console.log(`\n🗑️  Removing ${relationsToDelete.length} dependenc${relationsToDelete.length === 1 ? 'y' : 'ies'}...`);

        for (const relationId of relationsToDelete) {
          try {
            await deleteProjectRelation(client, relationId);
            console.log(`   ✓ Removed dependency`);
          } catch (error) {
            console.error(`   ✗ Failed to remove: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      } else {
        console.log(`\n⚠️  No matching dependencies found to remove`);
      }
    }

    console.log('');
    showSuccess('Project updated successfully!', {
      'Name': result.name,
      'ID': result.id,
      'URL': result.url,
    });

    // M16 Phase 2: Web Browser Mode
    if (options.web) {
      console.log('\n🌐 Opening project in browser...');
      try {
        const { openInBrowser } = await import('../../lib/browser.js');
        await openInBrowser(result.url);
        console.log('✓ Browser opened.');
      } catch (error) {
        console.error('⚠️  Could not open browser:', error instanceof Error ? error.message : 'Unknown error');
        console.error(`   Please visit: ${result.url}`);
      }
    }

  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
