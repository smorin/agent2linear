import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

import { registerIssueCommentCommands } from '../issue/comment/register.js';
import { registerProjectCommentCommands } from '../project/comment/register.js';
import { rejectLegacyIssueCommentArgv } from './register.js';

function command(parent: Command, name: string): Command {
  const found = parent.commands.find(item => item.name() === name);
  if (!found) throw new Error('missing command ' + name);
  return found;
}

function optionNames(item: Command): string[] {
  return item.options.map(option => option.long).filter((value): value is string => Boolean(value));
}

describe('M35 comment registration', () => {
  it('CMT-CMD-ISSUE-GROUP registers only add/list leaves and all issue options', () => {
    const root = new Command();
    const issue = root.command('issue');
    registerIssueCommentCommands(issue, {
      add: vi.fn(async () => undefined),
      list: vi.fn(async () => undefined),
    });
    const group = command(issue, 'comment');
    expect(group.commands.map(item => item.name())).toEqual(['add', 'list']);
    expect(group.aliases()).toEqual([]);

    const add = command(group, 'add');
    expect(add.registeredArguments.map(argument => argument.name())).toEqual(['identifier']);
    expect(optionNames(add)).toEqual([
      '--body',
      '--body-file',
      '--reply-to',
      '--dry-run',
      '--output',
      '--json',
      '--yes',
      '--no-input',
    ]);

    const list = command(group, 'list');
    expect(list.registeredArguments.map(argument => argument.name())).toEqual(['identifier']);
    expect(optionNames(list)).toEqual([
      '--limit',
      '--after',
      '--all',
      '--no-cursor-history',
      '--output',
      '--json',
    ]);
  });

  it('CMT-CMD-PROJECT-GROUP registers symmetrical project leaves without aliases', () => {
    const root = new Command();
    const project = root.command('project').alias('proj');
    registerProjectCommentCommands(project, {
      add: vi.fn(async () => undefined),
      list: vi.fn(async () => undefined),
    });
    const group = command(project, 'comment');
    expect(group.aliases()).toEqual([]);
    expect(group.commands.map(item => item.name())).toEqual(['add', 'list']);
    expect(command(group, 'add').registeredArguments[0].name()).toBe('name-or-id');
    expect(command(group, 'list').registeredArguments[0].name()).toBe('name-or-id');
  });

  it('CMT-CMD-ISSUE-ADD/LIST pass parsed leaf options and the leaf Command to handlers', async () => {
    const add = vi.fn(async () => undefined);
    const list = vi.fn(async () => undefined);
    const root = new Command().exitOverride();
    const issue = root.command('issue');
    registerIssueCommentCommands(issue, { add, list });

    await root.parseAsync([
      'node', 'a2l', 'issue', 'comment', 'add', 'ENG-1', '--body', 'hello', '--json',
    ]);
    expect(add).toHaveBeenCalledWith(
      'ENG-1',
      expect.objectContaining({ body: 'hello', json: true, output: 'table' }),
      expect.objectContaining({ name: expect.any(Function) })
    );

    await root.parseAsync([
      'node', 'a2l', 'issue', 'comment', 'list', 'ENG-1', '--limit', '1', '--all',
    ]);
    expect(list).toHaveBeenCalledWith(
      'ENG-1',
      expect.objectContaining({ limit: '1', all: true, output: 'table' }),
      expect.objectContaining({ name: expect.any(Function) })
    );
  });

  it('CMT-CMD-NO-ALIASES does not let legacy parsing hide unknown leaf options', async () => {
    const list = vi.fn(async () => undefined);
    const root = new Command().exitOverride();
    const issue = root.command('issue');
    registerIssueCommentCommands(issue, {
      add: vi.fn(async () => undefined),
      list,
    });
    await expect(root.parseAsync([
      'node', 'a2l', 'issue', 'comment', 'list', 'ENG-1', '--page', '2',
    ])).rejects.toMatchObject({ code: 'commander.unknownOption' });
    expect(list).not.toHaveBeenCalled();
  });

  it('CMT-CMD-ISSUE-GROUP-BARE renders group help to stderr and fails usage 2', async () => {
    const stderr = vi.fn();
    const root = new Command().exitOverride().configureOutput({
      writeOut: vi.fn(),
      writeErr: stderr,
      outputError: vi.fn(),
    });
    const issue = root.command('issue');
    registerIssueCommentCommands(issue, {
      add: vi.fn(async () => undefined),
      list: vi.fn(async () => undefined),
    });
    await expect(root.parseAsync(['node', 'a2l', 'issue', 'comment'])).rejects.toMatchObject({
      code: 'commander.help',
      exitCode: 1,
    });
    expect(stderr.mock.calls.flat().join('')).toContain('Usage:');
  });

  it('CMT-CMD-LEGACY-REJECT rejects the old leaf with an exact quoted replacement', () => {
    expect(() =>
      rejectLegacyIssueCommentArgv([
      'issue',
      'comment',
      'ENG-123',
      '--body',
      'hello world',
      ])
    ).toThrow(
      "legacy comment syntax has been removed\ntry: a2l issue comment add 'ENG-123' --body 'hello world'"
    );
  });

  it('CMT-OPT-COMMENT-HELP includes defaults, interactions, and examples', () => {
    const root = new Command();
    const issue = root.command('issue');
    registerIssueCommentCommands(issue, {
      add: vi.fn(async () => undefined),
      list: vi.fn(async () => undefined),
    });
    const group = command(issue, 'comment');
    const rendered: string[] = [];
    for (const item of [group, command(group, 'add'), command(group, 'list')]) {
      item.configureOutput({ writeOut: value => rendered.push(value), writeErr: value => rendered.push(value) });
      item.outputHelp();
    }
    const help = rendered.join('');
    expect(help).toContain('Examples:');
    expect(help).toContain('--body-file -');
    expect(help).toContain('default: 50');
    expect(help).toContain('--after');
  });
});
