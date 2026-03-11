import { Command } from 'commander';

import { createTemplate } from './create.js';
import { createTemplateInteractive } from './create-interactive.js';
import { editTemplateInteractive } from './edit-interactive.js';
import { listMilestoneTemplates } from './list.js';
import { removeTemplate } from './remove.js';
import { viewMilestoneTemplate } from './view.js';

export function registerMilestoneTemplatesCommands(cli: Command): void {
  const milestoneTemplates = cli
    .command('milestone-templates')
    .alias('mtmpl')
    .description('Manage milestone templates for projects')
    .action(() => {
      milestoneTemplates.help();
    });

  milestoneTemplates
    .command('list')
    .alias('ls')
    .description('List all available milestone templates')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear milestone-templates list              # List all templates (grouped by source)
  $ agent2linear mtmpl ls                               # Same as 'list' (alias)
  $ agent2linear milestone-templates list --format json # Output as JSON (flat list)
  $ agent2linear milestone-templates list --format tsv  # Output as TSV (flat list)
  $ agent2linear mtmpl list -f tsv | cut -f1            # Get just template names
`)
    .action(async (options?: { format?: 'tsv' | 'json' }) => {
      await listMilestoneTemplates(options || {});
    });

  milestoneTemplates
    .command('view <name>')
    .description('View details of a specific milestone template')
    .addHelpText('after', `
Examples:
  $ agent2linear milestone-templates view basic-sprint
  $ agent2linear mtmpl view product-launch
`)
    .action(async (name: string) => {
      await viewMilestoneTemplate(name);
    });

  milestoneTemplates
    .command('create [name]')
    .description('Create a new milestone template')
    .option('-g, --global', 'Create in global scope (default)')
    .option('-p, --project', 'Create in project scope')
    .option('-d, --description <text>', 'Template description')
    .option('-m, --milestone <spec>', 'Milestone spec (name:targetDate:description)', (value, previous: string[] = []) => [...previous, value], [])
    .option('-I, --interactive', 'Use interactive mode')
    .addHelpText('after', `
Examples:
  # Interactive mode (recommended) - name collected interactively
  $ agent2linear milestone-templates create --interactive
  $ agent2linear mtmpl create -I

  # Non-interactive mode - name required as argument
  $ agent2linear milestone-templates create basic-sprint \\
      --description "Simple 2-week sprint" \\
      --milestone "Planning:+1d:Define sprint goals" \\
      --milestone "Development:+10d:Implementation phase" \\
      --milestone "Review:+14d:Code review and deployment"

  # Project scope
  $ agent2linear milestone-templates create --project --interactive

Note: Milestone spec format is "name:targetDate:description"
  - name: Required
  - targetDate: Optional (+7d, +2w, +1m, or ISO date)
  - description: Optional (markdown supported)
`)
    .action(async (name: string | undefined, options) => {
      if (options.interactive) {
        // In interactive mode, name is collected interactively
        await createTemplateInteractive(options);
      } else {
        if (!name) {
          console.error('❌ Error: Template name is required in non-interactive mode\n');
          console.error('Provide a name:');
          console.error('  $ agent2linear milestone-templates create my-template --milestone ...\n');
          console.error('Or use interactive mode:');
          console.error('  $ agent2linear milestone-templates create --interactive\n');
          process.exit(1);
        }
        await createTemplate(name, options);
      }
    });

  milestoneTemplates
    .command('edit <name>')
    .description('Edit an existing milestone template (interactive only)')
    .option('-g, --global', 'Edit in global scope')
    .option('-p, --project', 'Edit in project scope')
    .addHelpText('after', `
Examples:
  $ agent2linear milestone-templates edit basic-sprint
  $ agent2linear mtmpl edit product-launch --global

Note: If no scope is specified, the template will be edited in its current scope.
`)
    .action(async (name: string, options) => {
      await editTemplateInteractive(name, options);
    });

  milestoneTemplates
    .command('remove <name>')
    .alias('rm')
    .description('Remove a milestone template')
    .option('-g, --global', 'Remove from global scope')
    .option('-p, --project', 'Remove from project scope')
    .option('-y, --yes', 'Skip confirmation prompt')
    .addHelpText('after', `
Examples:
  $ agent2linear milestone-templates remove basic-sprint
  $ agent2linear mtmpl rm product-launch --yes
  $ agent2linear milestone-templates remove my-sprint --project

Note: If no scope is specified, the template will be removed from its current scope.
`)
    .action(async (name: string, options) => {
      await removeTemplate(name, options);
    });
}
