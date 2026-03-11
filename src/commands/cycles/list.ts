import { getAllCycles } from '../../lib/linear-client.js';
import { getConfig } from '../../lib/config.js';
import { resolveAlias } from '../../lib/aliases.js';
import { showError, formatListTSV, formatListJSON } from '../../lib/output.js';

interface ListCyclesOptions {
  team?: string;
  format?: string;
}

/**
 * List cycles with optional team filter
 */
export async function listCyclesCommand(options: ListCyclesOptions) {
  try {
    const config = getConfig();
    let teamId = options.team || config.defaultTeam;

    if (teamId) {
      teamId = resolveAlias('team', teamId);
    }

    const cycles = await getAllCycles(teamId);

    if (cycles.length === 0) {
      console.log('No cycles found.');
      return;
    }

    switch (options.format) {
      case 'json':
        console.log(formatListJSON(cycles));
        break;
      case 'tsv':
        console.log(formatListTSV(cycles, ['id', 'name', 'number', 'startsAt', 'endsAt', 'teamName']));
        break;
      default: {
        console.log(`\nCycles${teamId ? '' : ' (all teams)'}:\n`);
        for (const cycle of cycles) {
          const dates = [cycle.startsAt, cycle.endsAt].filter(Boolean).join(' → ');
          const team = cycle.teamName ? ` [${cycle.teamName}]` : '';
          console.log(`  ${cycle.name} (#${cycle.number})${team}`);
          if (dates) {
            console.log(`    ${dates}`);
          }
        }
        console.log(`\nTotal: ${cycles.length} cycle(s)`);
        break;
      }
    }
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
