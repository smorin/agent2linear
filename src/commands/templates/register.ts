import { Command } from 'commander';

import { listTemplates } from './list.js';
import { viewTemplate } from './view.js';

export function registerTemplatesCommands(cli: Command): void {
  const templates = cli
    .command('templates')
    .alias('tmpl')
    .description('Manage Linear templates');

  templates
    .command('list [type]')
    .alias('ls')
    .description('List all templates or filter by type (issue/project)')
    .option('-I, --interactive', 'Use interactive mode for browsing')
    .option('-w, --web', 'Open Linear templates page in browser')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear templates list              # List all templates (grouped by type)
  $ agent2linear tmpl ls                      # Same as 'list' (alias)
  $ agent2linear templates list issues        # List only issue templates
  $ agent2linear templates list projects      # List only project templates
  $ agent2linear templates list --interactive # Browse interactively
  $ agent2linear templates list --web         # Open in browser
  $ agent2linear templates list --format json # Output as JSON (flat list)
  $ agent2linear templates list --format tsv  # Output as TSV (flat list)
  $ agent2linear tmpl list -f tsv | grep issue  # Filter issue templates
`)
    .action(async (type?: string, options?: { interactive?: boolean; web?: boolean; format?: 'tsv' | 'json' }) => {
      await listTemplates(type, options || {});
    });

  templates
    .command('view <id>')
    .description('View details of a specific template')
    .option('-w, --web', 'Open templates page in browser (templates do not have individual URLs)')
    .addHelpText('after', `
Examples:
  $ agent2linear templates view template_abc123
  $ agent2linear tmpl view template_xyz789
  $ agent2linear templates view template_abc123 --web
  $ agent2linear tmpl view mytemplate --web
`)
    .action(async (id: string, options) => {
      await viewTemplate(id, options);
    });
}
