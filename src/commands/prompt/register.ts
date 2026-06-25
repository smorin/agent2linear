import { Argument, Command } from 'commander';

import { runPromptGet } from './get.js';
import { listPrompts } from './list.js';

export function registerPromptCommands(cli: Command): void {
  const prompt = cli
    .command('prompt')
    .description('Get the markdown prompt to follow before creating a Linear issue')
    .addHelpText('before', `
Prompts are hand-authored markdown stored in a committable prompts.json:
- Global:  $XDG_CONFIG_HOME/agent2linear/prompts.json (default: ~/.config/agent2linear/prompts.json)
- Project: .agent2linear/prompts.json (nearest, searching up from the current directory)

Each prompt is { description?, body? | bodyFile? } (exactly one of body/bodyFile).
A top-level config \`defaultPrompt\` selects the general prompt; target a directory
via the global -C/--cwd lever.
`)
    .action(() => {
      prompt.help();
    });

  prompt
    .command('get')
    .addArgument(new Argument('[name]', 'Exact prompt name to fetch (highest precedence)'))
    .description('Print the applicable prompt as raw markdown (or --json envelope)')
    .option('--json', 'Output a machine-readable { name, source, selection, body, context } envelope')
    .addHelpText('after', `
Examples:
  $ agent2linear prompt get                     # the general defaultPrompt for the current dir
  $ agent2linear prompt get payments-issue       # an exact prompt by unique name
  $ agent2linear prompt get --json               # structured envelope (for agents)
  $ agent2linear -C apps/mobile prompt get        # resolve as if launched in apps/mobile
`)
    .action(async (name: string | undefined, options: { json?: boolean }) => {
      await runPromptGet(name, options);
    });

  prompt
    .command('list')
    .alias('ls')
    .description('List available prompt names (grouped by source)')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .addHelpText('after', `
Examples:
  $ agent2linear prompt list              # List all prompts (grouped by source)
  $ agent2linear prompt list --format json # Output as JSON (flat list)
  $ agent2linear prompt ls -f tsv | cut -f1 # Get just prompt names
`)
    .action(async (options?: { format?: 'tsv' | 'json' }) => {
      await listPrompts(options || {});
    });
}
