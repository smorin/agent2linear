import { createMilestoneTemplate, parseDateOffset } from '../../lib/milestone-templates.js';
import { showSuccess, showError } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';
import type { MilestoneTemplate, MilestoneDefinition } from '../../lib/types.js';

interface CreateTemplateOptions {
  global?: boolean;
  project?: boolean;
  description?: string;
  milestone?: string[];  // Changed from 'milestones' to 'milestone' to match CLI option name
}

/**
 * Parse a milestone specification string
 * Format: "name:targetDate:description"
 * Example: "Planning:+7d:Define sprint goals"
 */
function parseMilestoneSpec(spec: string): MilestoneDefinition {
  const parts = spec.split(':');

  if (parts.length < 1) {
    throw new Error('Milestone spec must have at least a name');
  }

  const milestone: MilestoneDefinition = {
    name: parts[0].trim(),
  };

  if (parts.length > 1 && parts[1].trim()) {
    const targetDateStr = parts[1].trim();
    // Validate date format
    if (!parseDateOffset(targetDateStr)) {
      throw new Error(`Invalid date format: "${targetDateStr}". Use +7d, +2w, +1m, or ISO date`);
    }
    milestone.targetDate = targetDateStr;
  }

  if (parts.length > 2 && parts[2].trim()) {
    milestone.description = parts.slice(2).join(':').trim();
  }

  return milestone;
}

/**
 * Create a milestone template (non-interactive mode)
 */
export async function createTemplate(
  name: string,
  options: CreateTemplateOptions = {}
) {
  try {
    // Determine scope
    const { scope, label: scopeLabel } = getScopeInfo(options);

    // Validate milestones option
    if (!options.milestone || options.milestone.length === 0) {
      showError(
        'At least one milestone is required',
        'Use --milestone "name:targetDate:description" to add milestones'
      );
      process.exit(1);
    }

    console.log(`🔨 Creating milestone template "${name}"...`);

    // Parse milestone specs
    const milestones: MilestoneDefinition[] = [];
    for (const spec of options.milestone) {
      try {
        const milestone = parseMilestoneSpec(spec);
        milestones.push(milestone);
        console.log(`   ✓ Parsed milestone: ${milestone.name}${milestone.targetDate ? ` (${milestone.targetDate})` : ''}`);
      } catch (error) {
        showError(
          `Failed to parse milestone spec: "${spec}"`,
          error instanceof Error ? error.message : 'Unknown error'
        );
        process.exit(1);
      }
    }

    // Build template object
    const template: MilestoneTemplate = {
      name: name,
      milestones,
    };

    if (options.description) {
      template.description = options.description;
    }

    // Create template
    const result = createMilestoneTemplate(name, template, scope);

    if (!result.success) {
      showError(result.error ?? 'Failed to create template');
      process.exit(1);
    }

    const details: Record<string, string> = {
      'Template': name,
      'Milestones': milestones.length.toString(),
      'Scope': scopeLabel,
    };

    if (template.description) {
      details['Description'] = template.description;
    }

    showSuccess('Milestone template created successfully!', details);

    console.log(`\n💡 Usage:`);
    console.log(`   $ linear-create project create --milestone-template ${name}`);
    console.log(`   $ linear-create project add-milestones <project-id> --template ${name}`);
    console.log(`   $ linear-create config set defaultMilestoneTemplate ${name}\n`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
