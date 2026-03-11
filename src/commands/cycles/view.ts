import { resolveAlias } from '../../lib/aliases.js';
import { getCycleById } from '../../lib/linear-client.js';
import { showError } from '../../lib/output.js';

/**
 * View a single cycle's details
 */
export async function viewCycleCommand(idOrAlias: string, options: { json?: boolean }) {
  try {
    const cycleId = resolveAlias('cycle', idOrAlias);

    const cycle = await getCycleById(cycleId);
    if (!cycle) {
      showError(`Cycle not found: "${idOrAlias}"`, 'Use "agent2linear cycles list" to see available cycles');
      process.exit(1);
    }

    if (options.json) {
      console.log(JSON.stringify(cycle, null, 2));
      return;
    }

    console.log(`\nCycle: ${cycle.name || `Cycle ${cycle.number}`}`);
    console.log(`  ID:     ${cycle.id}`);
    console.log(`  Number: ${cycle.number}`);
    if (cycle.startsAt) console.log(`  Starts: ${cycle.startsAt}`);
    if (cycle.endsAt) console.log(`  Ends:   ${cycle.endsAt}`);
    console.log();
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
