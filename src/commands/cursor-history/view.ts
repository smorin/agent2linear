import { NotFoundError } from '../../lib/cli-error.js';
import {
  commandOutputMode,
  type CursorHistoryCommandDependencies,
  type OutputOptions,
  validateHistoryEntryId,
  writeJson,
} from './shared.js';

export type CursorHistoryViewOptions = OutputOptions;

export function runCursorHistoryView(
  idValue: string,
  options: CursorHistoryViewOptions,
  dependencies: CursorHistoryCommandDependencies
): void {
  const mode = commandOutputMode(options);
  const id = validateHistoryEntryId(idValue);
  const entry = dependencies.store.view(id);
  if (!entry) {
    throw new NotFoundError(`Cursor history entry not found: ${id}`);
  }

  if (mode === 'json') {
    writeJson(dependencies, entry);
    return;
  }

  dependencies.stdout(
    [
      `Cursor history entry ${entry.id}`,
      `Created: ${entry.createdAt}`,
      `Cursor: ${entry.cursor}`,
      `Workspace: ${JSON.stringify(entry.workspace)}`,
      `Command path: ${entry.commandPath}`,
      `Resource: ${entry.resource}`,
      `Target: ${entry.target ? JSON.stringify(entry.target) : '(collection)'}`,
      `Filters: ${JSON.stringify(entry.filters)}`,
      `Order: ${entry.orderBy}`,
      `Limit: ${entry.limit}`,
      `Source command: ${entry.sourceCommand}`,
      `Next command: ${entry.nextCommand}`,
      `All remaining command: ${entry.allRemainingCommand}`,
      '',
    ].join('\n')
  );
}
