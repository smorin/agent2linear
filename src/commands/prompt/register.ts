import { Argument, Command } from 'commander';

import { explainPrompt } from './explain.js';
import { runPromptGet } from './get.js';
import { listPrompts } from './list.js';

export function registerPromptCommands(cli: Command): void {
  const prompt = cli
    .command('prompt')
    .alias('skill')
    .description('Get the markdown prompt to follow before creating a Linear issue')
    .addHelpText('before', `
Aliased as \`skill\`: \`a2l skill get\` returns the right skill (prompt) to call —
the context-appropriate guidance an agent should follow before creating an issue.
\`skill\` and \`prompt\` are interchangeable (\`skill get\` = \`prompt get\`, etc.).

Prompts are hand-authored markdown stored in a committable prompts.json:
- Global:  $XDG_CONFIG_HOME/agent2linear/prompts.json (default: ~/.config/agent2linear/prompts.json)
- Project: .agent2linear/prompts.json (nearest, searching up from the current directory)

Each prompt is { description?, body? | bodyFile? } (exactly one of body/bodyFile).
A top-level config \`defaultPrompt\` selects the general prompt; target a directory
via the global -C/--cwd lever.
`);

  prompt
    .command('get')
    .addArgument(new Argument('[name]', 'Exact prompt name to fetch (highest precedence)'))
    .description('Print the applicable prompt as raw markdown (or --json envelope)')
    .option('--team <id|alias>', 'Select the team layer (a promptRule for this team must exist)')
    .option('--force', 'With an explicit --team, take the team prompt first (outranks a location override); error if no rule matches')
    .option('--json', 'Output a machine-readable { name, source, selection, body, context } envelope')
    .addHelpText('after', `
Selection precedence: explicit name → specific location override (path/repo/owner/host)
→ team (promptRules) → general defaultPrompt → error. An explicit --team with no
matching promptRule is a hard error. With --force and an explicit --team, the team
prompt is evaluated first and outranks a location override (no rule ⇒ hard error).

Examples:
  $ agent2linear prompt get                       # the general defaultPrompt for the current dir
  $ agent2linear prompt get payments-issue        # an exact prompt by unique name
  $ agent2linear prompt get --team payments        # the team-layer prompt for the payments team
  $ agent2linear prompt get --team payments --force # force the payments team prompt (beats location)
  $ agent2linear prompt get --json                # structured envelope (for agents)
  $ agent2linear -C apps/mobile prompt get         # resolve as if launched in apps/mobile
`)
    .action(async (name: string | undefined, options: { json?: boolean; team?: string; force?: boolean }) => {
      await runPromptGet(name, options);
    });

  prompt
    .command('list')
    .alias('ls')
    .addArgument(new Argument('[partial]', 'Filter to prompts whose NAME contains this substring (case-insensitive)'))
    .description('List available prompt names (grouped by source)')
    .option('-f, --format <type>', 'Output format: tsv, json')
    .option('-d, --descriptions', 'Include each prompt\'s description in the human output')
    .addHelpText('after', `
Default human output is NAMES ONLY (grouped by source). Add --descriptions to show
each prompt's description. --format json|tsv always emits the complete record
(name, description, source). An optional [partial] filters to prompt names that
contain the substring (case-insensitive); it applies to every format.

Examples:
  $ agent2linear prompt list                # All prompt names (grouped by source)
  $ agent2linear prompt list --descriptions # Names + descriptions
  $ agent2linear prompt list pay            # Only names containing "pay"
  $ agent2linear prompt list --format json  # Complete records as JSON
  $ agent2linear prompt ls -f tsv | cut -f1 # Just prompt names
`)
    .action(async (partial: string | undefined, options?: { format?: 'tsv' | 'json'; descriptions?: boolean }) => {
      await listPrompts({ ...(options || {}), partial });
    });

  prompt
    .command('explain')
    .addArgument(new Argument('[dir]', 'Resolution-context directory (positional sugar for the global -C/--cwd)'))
    .description('Explain which prompt would be selected for a directory context, and why')
    .option('--team <id|alias>', 'Evaluate the team layer for this team (mirrors prompt get)')
    .option('--force', 'With an explicit --team, take the team prompt first (mirrors prompt get)')
    .option('--json', 'Output machine-readable JSON (for agents)')
    .addHelpText('after', `
Mirrors \`config explain\` and adds the prompt team layer: it shows the context, the
resolved defaultPrompt + provenance, the team (--team/defaultTeam + resolved id), the
matched promptRule (shown even when a location override outranks it), and the final
selection + tier. Unlike \`prompt get\`, it never exits 1 — an unresolved selection is
reported in the trace.

Examples:
  $ agent2linear prompt explain                  # explain selection for the current dir
  $ agent2linear prompt explain apps/mobile      # explain as if in apps/mobile
  $ agent2linear prompt explain --json           # machine-readable output
  $ agent2linear prompt explain --team payments  # explain the team-layer selection
  $ agent2linear -C apps/mobile prompt explain   # same, via the global -C/--cwd lever
`)
    .action(async (dir: string | undefined, options: { json?: boolean; team?: string; force?: boolean }) => {
      await explainPrompt(dir, options);
    });
}
