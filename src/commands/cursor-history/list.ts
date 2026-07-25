import { CURSOR_HISTORY_MAX_ENTRIES } from '../../lib/cursor-history.js';
import {
  commandOutputMode,
  type CursorHistoryCommandDependencies,
  type OutputOptions,
  parseHistoryLimit,
  validateHistoryCursor,
  writeJson,
} from './shared.js';

export interface CursorHistoryListOptions extends OutputOptions {
  limit?: string;
  cursor?: string;
}

export function runCursorHistoryList(
  options: CursorHistoryListOptions,
  dependencies: CursorHistoryCommandDependencies
): void {
  const mode = commandOutputMode(options);
  const limit = parseHistoryLimit(options.limit);
  const cursor = validateHistoryCursor(options.cursor);
  const history = dependencies.store.read();
  const matching = history.entries.filter(entry => cursor === undefined || entry.cursor === cursor);
  const entries = matching.slice(0, limit);

  if (mode === 'json') {
    writeJson(dependencies, {
      entries,
      returnedCount: entries.length,
      retainedCount: history.entries.length,
      maxEntries: CURSOR_HISTORY_MAX_ENTRIES,
    });
    return;
  }

  if (entries.length === 0) {
    dependencies.stdout('No cursor history entries found.\nTotal: 0\n');
    return;
  }

  for (const entry of entries) {
    const target = entry.target ? `${entry.target.label} (${entry.target.id})` : '(collection)';
    const workspace =
      entry.workspace.name ?? entry.workspace.id ?? entry.workspace.key ?? '(unknown)';
    dependencies.stdout(
      [
        `${entry.createdAt} · ${entry.id}`,
        `  Workspace: ${workspace}`,
        `  Resource: ${entry.resource}`,
        `  Target: ${target}`,
        `  Cursor: ${entry.cursor}`,
        `  Source: ${entry.sourceCommand}`,
        `  Next: ${entry.nextCommand}`,
        `  All remaining: ${entry.allRemainingCommand}`,
        '',
      ].join('\n')
    );
  }
  dependencies.stdout(`Total: ${entries.length}\n`);
}
