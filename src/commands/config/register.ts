import { Argument,Command } from 'commander';

import type { ConfigKey } from '../../lib/config.js';
import { editConfig } from './edit.js';
import { getConfigValue } from './get.js';
import { listConfig } from './list.js';
import { setConfig } from './set.js';
import { unsetConfig } from './unset.js';

export function registerConfigCommands(cli: Command): void {
  const config = cli
    .command('config')
    .alias('cfg')
    .description('Manage configuration settings for agent2linear')
    .addHelpText('before', `
Current respected settings:
- \`apiKey\`: Linear API authentication key (get yours at linear.app/settings/api)
- \`defaultInitiative\`: Default initiative ID for project creation (format: init_xxx)
- \`defaultTeam\`: Default team ID for project creation (format: team_xxx)
- \`defaultProject\`: Default project ID for issue creation
- \`defaultIssueTemplate\`: Default template ID for issue creation (format: template_xxx)
- \`defaultProjectTemplate\`: Default template ID for project creation (format: template_xxx)
- \`defaultMilestoneTemplate\`: Default milestone template name for project milestones
- \`projectCacheMinTTL\`: Cache time-to-live in minutes (default: 60, range: 1-1440)

Configuration files:
- Global:  $XDG_CONFIG_HOME/agent2linear/config.json (default: ~/.config/agent2linear/config.json)
- Project: .agent2linear/config.json (nearest, searching up from the current directory)
- Priority: environment > project > global (for apiKey)
            project > global (for other settings)
`)
    .addHelpText('after', `
Related Commands:
  $ agent2linear initiatives select   # Interactive initiative picker
  $ agent2linear teams select         # Interactive team picker

Learn More:
  Get your Linear API key at: https://linear.app/settings/api
`)
    .action(() => {
      config.help();
    });

  config
    .command('list')
    .alias('show')
    .description('List all configuration values')
    .addHelpText('after', `
Examples:
  $ agent2linear config list  # Display all config values and sources
  $ agent2linear cfg show     # Same as 'list' (alias for backward compatibility)
`)
    .action(async () => {
      await listConfig();
    });

  config
    .command('get')
    .addArgument(
      new Argument('<key>', 'Configuration key')
        .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultProject', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL', 'defaultProfile', 'noMatchPolicy', 'confirmAutoDetectedWrites'])
    )
    .description('Get a single configuration value')
    .addHelpText('after', `
Examples:
  $ agent2linear config get apiKey
  $ agent2linear cfg get defaultInitiative
  $ agent2linear cfg get defaultProjectTemplate
  $ agent2linear cfg get defaultMilestoneTemplate
  $ agent2linear cfg get projectCacheMinTTL
`)
    .action(async (key: string) => {
      await getConfigValue(key as ConfigKey);
    });

  config
    .command('set')
    .addArgument(
      new Argument('<key>', 'Configuration key')
        .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultProject', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL', 'defaultProfile', 'noMatchPolicy', 'confirmAutoDetectedWrites'])
    )
    .addArgument(new Argument('<value>', 'Configuration value'))
    .description('Set a configuration value')
    .option('-g, --global', 'Set in global config (default)')
    .option('-p, --project', 'Set in project config')
    .addHelpText('after', `
Examples:
  $ agent2linear config set apiKey lin_api_xxx...
  $ agent2linear config set defaultInitiative init_abc123 --global
  $ agent2linear config set defaultTeam team_xyz789 --project
  $ agent2linear config set defaultProjectTemplate template_abc123
  $ agent2linear config set defaultMilestoneTemplate basic-sprint
  $ agent2linear config set projectCacheMinTTL 120  # Cache for 2 hours
`)
    .action(async (key: string, value: string, options) => {
      await setConfig(key, value, options);
    });

  config
    .command('unset')
    .addArgument(
      new Argument('<key>', 'Configuration key')
        .choices(['apiKey', 'defaultInitiative', 'defaultTeam', 'defaultProject', 'defaultIssueTemplate', 'defaultProjectTemplate', 'defaultMilestoneTemplate', 'projectCacheMinTTL', 'defaultProfile', 'noMatchPolicy', 'confirmAutoDetectedWrites'])
    )
    .description('Remove a configuration value')
    .option('-g, --global', 'Remove from global config (default)')
    .option('-p, --project', 'Remove from project config')
    .addHelpText('after', `
Examples:
  $ agent2linear config unset apiKey --global
  $ agent2linear config unset defaultTeam --project
  $ agent2linear config unset defaultProjectTemplate
  $ agent2linear config unset defaultMilestoneTemplate
  $ agent2linear config unset projectCacheMinTTL
`)
    .action(async (key: string, options) => {
      await unsetConfig(key, options);
    });

  config
    .command('edit')
    .description('Edit configuration interactively')
    .option('-g, --global', 'Edit global config (skip scope prompt)')
    .option('-p, --project', 'Edit project config (skip scope prompt)')
    .option('--key <key>', 'Configuration key to edit (non-interactive)')
    .option('--value <value>', 'Configuration value (requires --key, non-interactive)')
    .addHelpText('after', `
Examples:
  $ agent2linear config edit                      # Interactive multi-value editing
  $ agent2linear config edit --global             # Edit global config interactively
  $ agent2linear config edit --key apiKey --value lin_api_xxx  # Non-interactive single value
  $ agent2linear cfg edit                         # Same as 'config edit' (alias)
`)
    .action(async (options) => {
      await editConfig(options);
    });
}
