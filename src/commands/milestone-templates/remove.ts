import readline from 'readline';

import { CliError } from '../../lib/cli-error.js';
import { requireInteractiveInput } from '../../lib/interaction-policy.js';
import { getMilestoneTemplate,removeMilestoneTemplate } from '../../lib/milestone-templates.js';
import { showError,showSuccess } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';

interface RemoveTemplateOptions {
  global?: boolean;
  project?: boolean;
  yes?: boolean;
}

/**
 * Prompt user for confirmation
 */
function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Remove a milestone template
 */
export async function removeTemplate(
  name: string,
  options: RemoveTemplateOptions = {}
) {
  try {
    // First check if template exists
    const existing = getMilestoneTemplate(name);
    if (!existing) {
      showError(
        `Template "${name}" not found`,
        'Use "agent2linear milestone-templates list" to see available templates'
      );
      process.exit(1);
    }

    // Determine scope - if not specified, use the scope where template exists
    let scope: 'global' | 'project';
    let scopeLabel: string;

    if (options.global || options.project) {
      const scopeInfo = getScopeInfo(options);
      scope = scopeInfo.scope;
      scopeLabel = scopeInfo.label;

      // Verify template exists in this scope
      if (existing.source !== scope) {
        showError(
          `Template "${name}" exists in ${existing.source} scope, not ${scope}`,
          `Use --${existing.source} flag or omit scope flag to remove from ${existing.source} scope`
        );
        process.exit(1);
      }
    } else {
      // Use detected scope
      scope = existing.source;
      scopeLabel = scope === 'global' ? 'Global' : 'Project';
    }

    // Show template info
    console.log(`\n🗑️  Removing milestone template "${name}"...`);
    console.log(`   Scope: ${scopeLabel}`);
    console.log(`   Milestones: ${existing.template.milestones.length}`);
    if (existing.template.description) {
      console.log(`   Description: ${existing.template.description}`);
    }

    // Confirm deletion unless --yes flag is set
    if (!options.yes) {
      requireInteractiveInput('milestone-templates remove');
      console.log();
      const confirmed = await confirm('Are you sure you want to remove this template? (y/N) ');
      if (!confirmed) {
        console.log('❌ Cancelled\n');
        process.exit(0);
      }
    }

    // Remove template
    const result = removeMilestoneTemplate(name, scope);

    if (!result.success) {
      showError(result.error ?? 'Failed to remove template');
      process.exit(1);
    }

    const details: Record<string, string> = {
      'Template': name,
      'Scope': scopeLabel,
    };

    showSuccess('Milestone template removed successfully!', details);
  } catch (error) {
    if (error instanceof CliError) throw error;
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
