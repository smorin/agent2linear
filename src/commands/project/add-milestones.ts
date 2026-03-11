import { getConfig } from '../../lib/config.js';
import { createProjectMilestone,validateProjectExists } from '../../lib/linear-client.js';
import { getMilestoneTemplate, resolveMilestoneDates } from '../../lib/milestone-templates.js';
import { showEntityNotFound,showError, showResolvedAlias, showSuccess, showValidated, showValidating } from '../../lib/output.js';
import { resolveProject } from '../../lib/project-resolver.js';

interface AddMilestonesOptions {
  template?: string;
}

export async function addMilestones(projectNameOrId: string, options: AddMilestonesOptions = {}) {
  try {
    // Use smart resolver to handle ID, alias, or name
    console.log(`🔍 Resolving project "${projectNameOrId}"...`);

    const resolved = await resolveProject(projectNameOrId);

    if (!resolved) {
      showEntityNotFound('project', projectNameOrId);
      console.error('   Tip: Use exact project name, project ID, or create an alias');
      process.exit(1);
    }

    const resolvedProjectId = resolved.projectId;

    // Show how the project was resolved
    if (resolved.resolvedBy === 'alias') {
      showResolvedAlias(resolved.usedAlias!, resolvedProjectId);
    } else if (resolved.resolvedBy === 'name') {
      console.log(`   ✓ Found project by name: "${resolved.project?.name}"`);
    }

    // Validate project exists
    showValidating('project', resolvedProjectId);
    const projectCheck = await validateProjectExists(resolvedProjectId);

    if (!projectCheck.valid) {
      showError(projectCheck.error || 'Project validation failed');
      process.exit(1);
    }

    showValidated('project', projectCheck.name!);

    // Get template name from options or config
    let templateName = options.template;
    if (!templateName) {
      const config = getConfig();
      templateName = config.defaultMilestoneTemplate;
    }

    if (!templateName) {
      showError(
        'No milestone template specified',
        'Provide a template using --template flag or set a default:\n' +
        '  $ agent2linear config set defaultMilestoneTemplate <template-name>'
      );
      process.exit(1);
    }

    // Load the template
    console.log(`🔍 Loading milestone template: ${templateName}...`);
    const result = getMilestoneTemplate(templateName);

    if (!result) {
      const { formatEntityNotFoundError } = await import('../../lib/validators.js');
      showError(formatEntityNotFoundError('milestone template', templateName, 'milestone-templates list'));
      process.exit(1);
    }

    const { template } = result;
    console.log(`   ✓ Template loaded (${template.milestones.length} milestone${template.milestones.length === 1 ? '' : 's'})`);
    console.log('');

    // Create milestones
    console.log('🚀 Creating milestones...');
    const createdMilestones: { id: string; name: string }[] = [];
    const baseDate = new Date();

    for (const milestoneDef of template.milestones) {
      const resolved = resolveMilestoneDates(milestoneDef, baseDate);

      try {
        const milestone = await createProjectMilestone(resolvedProjectId, {
          name: resolved.name,
          description: resolved.description,
          targetDate: resolved.targetDate,
        });

        createdMilestones.push(milestone);
        console.log(`   ✓ Created: ${milestone.name} (${milestone.id})`);
      } catch (error) {
        console.error(`   ✗ Failed to create: ${milestoneDef.name}`);
        console.error(`     Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('');
    showSuccess(
      `Successfully created ${createdMilestones.length} milestone${createdMilestones.length === 1 ? '' : 's'} for project: ${projectCheck.name}`
    );

    if (createdMilestones.length < template.milestones.length) {
      console.log('');
      console.log(`⚠️  Warning: ${template.milestones.length - createdMilestones.length} milestone${template.milestones.length - createdMilestones.length === 1 ? '' : 's'} failed to create`);
    }
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
