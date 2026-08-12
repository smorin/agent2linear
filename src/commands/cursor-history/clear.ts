import { UsageError } from '../../lib/cli-error.js';
import { noInputRequested } from '../../lib/interaction-policy.js';
import {
  commandOutputMode,
  type CursorHistoryCommandDependencies,
  type OutputOptions,
  writeJson,
} from './shared.js';

export interface CursorHistoryClearOptions extends OutputOptions {
  dryRun?: boolean;
  yes?: boolean;
  noInput?: boolean;
}

export async function runCursorHistoryClear(
  options: CursorHistoryClearOptions,
  dependencies: CursorHistoryCommandDependencies
): Promise<void> {
  const mode = commandOutputMode(options);
  const history = dependencies.store.read();
  const count = history.entries.length;

  if (options.dryRun) {
    renderClearResult(mode, dependencies, true, count);
    return;
  }

  if (!options.yes) {
    if (noInputRequested(options.noInput)) {
      throw new UsageError('cursor-history clear requires --yes when --no-input is set');
    }
    if (mode === 'json' || !dependencies.isInteractive()) {
      throw new UsageError('cursor-history clear requires --yes in non-interactive or JSON mode');
    }
    const confirmed = await dependencies.confirm(
      `Clear ${count} cursor history entr${count === 1 ? 'y' : 'ies'}? [y/N] `
    );
    if (!confirmed) {
      dependencies.stderr('Cursor history was not cleared.\n');
      return;
    }
  }

  const deletedCount = await dependencies.store.clear();
  renderClearResult(mode, dependencies, false, deletedCount);
}

function renderClearResult(
  mode: string,
  dependencies: CursorHistoryCommandDependencies,
  dryRun: boolean,
  deletedCount: number
): void {
  if (mode === 'json') {
    writeJson(dependencies, {
      ok: true,
      dryRun,
      deletedCount,
      path: dependencies.store.filePath,
    });
    return;
  }

  if (dryRun) {
    dependencies.stdout(
      `Dry run: would clear ${deletedCount} cursor history entr${deletedCount === 1 ? 'y' : 'ies'} from ${dependencies.store.filePath}.\n`
    );
    return;
  }
  dependencies.stdout(
    `Cleared ${deletedCount} cursor history entr${deletedCount === 1 ? 'y' : 'ies'}.\n`
  );
}
