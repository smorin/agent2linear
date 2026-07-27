import { Command } from 'commander';

import { resolveAlias } from '../../lib/aliases.js';
import { isAuthenticationError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import { extractIconsFromEntities } from '../../lib/icons.js';
import { validateTeamExists } from '../../lib/linear-client.js';

export function extractIcons(program: Command) {
  program
    .command('extract')
    .description('Extract icons from workspace entities')
    .option('--type <type>', 'Entity type (labels|workflow-states|projects)')
    .option('-t, --team <id>', 'Filter by team (ID, name, or alias)')
    .option('-w, --workspace', 'Search entire workspace (ignore defaultTeam)')
    .option('-f, --format <format>', 'Output format (json|tsv)', 'default')
    .action(async (options) => {
      try {
        let resolvedTeamId: string | undefined;

        // Determine team scope (same pattern as issue-labels list)
        if (!options.workspace) {
          if (options.team) {
            // Resolve team alias
            resolvedTeamId = resolveAlias('team', options.team);

            // Validate team exists
            const teamCheck = await validateTeamExists(resolvedTeamId);
            if (!teamCheck.valid) {
              console.error(`❌ ${teamCheck.error}`);
              process.exit(1);
            }
            console.log(`📎 Using team: ${teamCheck.name}`);
          } else {
            // Use defaultTeam from config
            const config = getConfig();
            if (config.defaultTeam) {
              resolvedTeamId = config.defaultTeam;
              console.log(`📎 Using default team: ${resolvedTeamId}`);
            }
          }
        }

        const scope = options.workspace ? 'workspace' : (resolvedTeamId ? 'team' : 'workspace');
        console.log(`🔍 Extracting icons from ${scope}...`);

        const icons = await extractIconsFromEntities(options.type as 'labels' | 'workflow-states' | 'projects' | undefined, resolvedTeamId);
        console.log(`   Found ${icons.length} unique icons`);
        console.log('');

        if (options.format === 'json') {
          console.log(JSON.stringify(icons, null, 2));
          return;
        }

        if (options.format === 'tsv') {
          console.log('Emoji\tUsage\tEntities');
          for (const icon of icons) {
            console.log(`${icon.emoji}\t${icon.usageCount}\t${icon.entities.join(', ')}`);
          }
          return;
        }

        console.log('Icon  Usage  Entities');
        console.log('────  ─────  ────────');
        for (const icon of icons) {
          const entities = icon.entities.slice(0, 3).join(', ');
          const more = icon.entities.length > 3 ? `, +${icon.entities.length - 3} more` : '';
          console.log(`${icon.emoji}     ${icon.usageCount.toString().padStart(5)}  ${entities}${more}`);
        }
        console.log('');
      } catch (error) {
        if (isAuthenticationError(error)) throw error;
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    });
}
