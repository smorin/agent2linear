import { resolveProject } from '../../lib/project-resolver.js';
import { updateProject } from '../../lib/linear-client.js';
import { resolveProjectStatusId } from '../../lib/status-cache.js';
import { resolveAlias } from '../../lib/aliases.js';
import { showEntityNotFound, showError, showSuccess } from '../../lib/output.js';

interface UpdateOptions {
  status?: string;
  name?: string;
  description?: string;
  priority?: string;
  targetDate?: string;
  startDate?: string;
}

export async function updateProjectCommand(nameOrId: string, options: UpdateOptions) {
  try {
    // Validate at least one field provided
    if (!options.status && !options.name && !options.description &&
        options.priority === undefined && !options.targetDate && !options.startDate) {
      showError(
        'No update fields provided',
        'Specify at least one field to update:\n' +
        '  --status, --name, --description, --priority, --target-date, --start-date'
      );
      process.exit(1);
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
    const updates: any = {};
    const changes: string[] = [];

    // Resolve status if provided
    if (options.status) {
      console.log(`\n🔍 Resolving status "${options.status}"...`);

      // Try alias first
      const aliasResolved = resolveAlias('project-status', options.status);
      let statusId: string | null = null;

      if (aliasResolved !== options.status) {
        // Alias was found
        statusId = aliasResolved;
        console.log(`   ✓ Resolved alias: ${options.status} → ${statusId}`);
      } else {
        // Try name or ID lookup
        statusId = await resolveProjectStatusId(options.status);
        if (statusId) {
          if (statusId === options.status) {
            console.log(`   ✓ Using status ID: ${statusId}`);
          } else {
            console.log(`   ✓ Found status by name: "${options.status}"`);
          }
        } else {
          showError(
            `Status not found: "${options.status}"`,
            'Use a valid status name, ID, or alias'
          );
          process.exit(1);
        }
      }

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

    if (options.priority !== undefined) {
      const priority = parseInt(options.priority, 10);
      if (isNaN(priority) || priority < 0 || priority > 4) {
        showError(
          'Invalid priority value',
          'Priority must be a number between 0 and 4:\n' +
          '  0 = None, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low'
        );
        process.exit(1);
      }
      updates.priority = priority;
      changes.push(`Priority → ${priority}`);
    }

    if (options.targetDate) {
      updates.targetDate = options.targetDate;
      changes.push(`Target Date → ${options.targetDate}`);
    }

    if (options.startDate) {
      updates.startDate = options.startDate;
      changes.push(`Start Date → ${options.startDate}`);
    }

    // Update project
    console.log(`\n📝 Updating project...`);
    for (const change of changes) {
      console.log(`   ${change}`);
    }

    const result = await updateProject(projectId, updates);

    console.log('');
    showSuccess('Project updated successfully!', {
      'Name': result.name,
      'ID': result.id,
      'URL': result.url,
    });

  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
