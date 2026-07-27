import { Command } from 'commander';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { UsageError } from '../../lib/cli-error.js';
import { type CursorHistoryEntryInput, CursorHistoryStore } from '../../lib/cursor-history.js';
import { registerCursorHistoryCommands } from './register.js';

let root: string;
let store: CursorHistoryStore;
let stdout: string;
let stderr: string;

const input = (cursor = 'raw-cursor'): CursorHistoryEntryInput => ({
  cursor,
  workspace: { key: 'safe-hash', id: null, name: 'ConceptM' },
  commandPath: 'issue list',
  resource: 'issue',
  target: null,
  filters: { team: 'ENG' },
  orderBy: 'priority desc',
  limit: 50,
  sourceCommand: "a2l issue list --team 'ENG'",
  nextCommand: `a2l issue list --team 'ENG' --after '${cursor}'`,
  allRemainingCommand: `a2l issue list --team 'ENG' --after '${cursor}' --all`,
});

function program(): Command {
  const cli = new Command();
  cli.name('agent2linear').exitOverride();
  cli.configureOutput({
    writeOut: value => {
      stdout += value;
    },
    writeErr: value => {
      stderr += value;
    },
  });
  registerCursorHistoryCommands(cli, {
    store,
    stdout: value => {
      stdout += value;
    },
    stderr: value => {
      stderr += value;
    },
    isInteractive: () => false,
  });
  return cli;
}

function completeHelp(command: Command | undefined): string {
  expect(command).toBeDefined();
  let value = '';
  command?.configureOutput({
    writeOut: output => {
      value += output;
    },
  });
  command?.outputHelp();
  return value;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'a2l-history-command-'));
  store = new CursorHistoryStore({
    filePath: join(root, 'state', 'agent2linear', 'cursor-history.json'),
  });
  stdout = '';
  stderr = '';
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('cursor-history registration and lifecycle', () => {
  it('CPH-CMD-HISTORY-GROUP rejects an incomplete group with help on stderr', async () => {
    await expect(
      program().parseAsync(['cursor-history'], { from: 'user' })
    ).rejects.toMatchObject({ code: 'commander.help', exitCode: 1 });
    expect(stdout).toBe('');
    expect(stderr).toContain('Usage: agent2linear cursor-history');
    expect(stderr).toContain('list');
    expect(stderr).toContain('view');
    expect(stderr).toContain('clear');
  });

  it('[CPH-DOC-HELP-HISTORY][CPH-TST-PARSER] publishes local lifecycle examples for every history command', () => {
    const cli = program();
    const group = cli.commands.find(command => command.name() === 'cursor-history');
    const groupHelp = completeHelp(group);
    expect(groupHelp).toContain('Examples:');
    expect(groupHelp).toContain('a2l cursor-history list');

    const list = group?.commands.find(command => command.name() === 'list');
    const listHelp = completeHelp(list);
    expect(listHelp).toContain("--cursor '<raw-linear-cursor>'");
    expect(listHelp).toContain('--output json');

    const view = group?.commands.find(command => command.name() === 'view');
    expect(completeHelp(view)).toContain('a2l cursor-history view <entry-id>');

    const clear = group?.commands.find(command => command.name() === 'clear');
    const clearHelp = completeHelp(clear);
    expect(clearHelp).toContain('a2l cursor-history clear --dry-run');
    expect(clearHelp).toContain('a2l cursor-history clear --yes');
  });

  it('CPH-CMD-HISTORY-LIST returns a stable local JSON envelope without auth', async () => {
    const entry = await store.append(input());
    await program().parseAsync(['cursor-history', 'list', '--json'], { from: 'user' });
    expect(stderr).toBe('');
    expect(JSON.parse(stdout)).toEqual({
      entries: [entry],
      returnedCount: 1,
      retainedCount: 1,
      maxEntries: 1000,
    });
  });

  it('CPH-OPT-HISTORY-LIST-LIMIT and cursor filtering are strict and local', async () => {
    await store.append(input('one'));
    await store.append(input('two'));
    await program().parseAsync(
      ['cursor-history', 'list', '--limit', '1', '--cursor', 'one', '--output', 'json'],
      { from: 'user' }
    );
    expect(JSON.parse(stdout).entries).toHaveLength(1);
    expect(JSON.parse(stdout).entries[0].cursor).toBe('one');

    stdout = '';
    await expect(
      program().parseAsync(['cursor-history', 'list', '--limit', '1.5'], { from: 'user' })
    ).rejects.toBeInstanceOf(UsageError);
    expect(stdout).toBe('');
  });

  it('CPH-RULE-HISTORY-LIST-JSON accepts JSON equivalence and rejects conflicts', async () => {
    await program().parseAsync(['cursor-history', 'list', '--json', '--output', 'json'], {
      from: 'user',
    });
    expect(() => JSON.parse(stdout)).not.toThrow();

    stdout = '';
    await expect(
      program().parseAsync(['cursor-history', 'list', '--json', '--output', 'table'], {
        from: 'user',
      })
    ).rejects.toBeInstanceOf(UsageError);
    expect(stdout).toBe('');
  });

  it('CPH-CMD-HISTORY-VIEW prints one entry and uses exits 2 versus 3', async () => {
    const entry = await store.append(input());
    await program().parseAsync(['cursor-history', 'view', entry.id, '--json'], { from: 'user' });
    expect(JSON.parse(stdout)).toEqual(entry);

    stdout = '';
    await expect(
      program().parseAsync(['cursor-history', 'view', 'not-a-uuid'], { from: 'user' })
    ).rejects.toMatchObject({ exitCode: 2 });

    await expect(
      program().parseAsync(['cursor-history', 'view', '00000000-0000-4000-8000-000000000099'], {
        from: 'user',
      })
    ).rejects.toMatchObject({ exitCode: 3 });
  });

  it('CPH-OPT-HISTORY-CLEAR-DRYRUN reports without prompting or writing', async () => {
    await store.append(input());
    await program().parseAsync(['cursor-history', 'clear', '--dry-run', '--json'], {
      from: 'user',
    });
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, dryRun: true, deletedCount: 1 });
    expect(store.list()).toHaveLength(1);
  });

  it('CPH-OPT-HISTORY-CLEAR-NOINPUT requires consent before any write', async () => {
    await store.append(input());
    await expect(
      program().parseAsync(['cursor-history', 'clear', '--no-input'], { from: 'user' })
    ).rejects.toBeInstanceOf(UsageError);
    expect(store.list()).toHaveLength(1);
  });

  it('CPH-OPT-HISTORY-CLEAR-YES deletes only cursor history', async () => {
    await store.append(input());
    await program().parseAsync(['cursor-history', 'clear', '--yes', '--json'], {
      from: 'user',
    });
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, dryRun: false, deletedCount: 1 });
    expect(store.list()).toEqual([]);
  });
});
