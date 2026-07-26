import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { registerIssueLabelsCommands } from '../issue-labels/register.js';
import { registerProjectLabelsCommands } from '../project-labels/register.js';

function optionFlags(command: Command): string[] {
  return command.options.map(option => option.flags);
}

function child(parent: Command, name: string): Command {
  const command = parent.commands.find(candidate => candidate.name() === name);
  if (!command) throw new Error('missing command ' + name);
  return command;
}

describe('M33 issue-label command registration', () => {
  it('[LPL-CMD-IL-GROUP][LPL-ALS-IL-GROUP][LPL-CMD-IL-RETIRE][LPL-CMD-IL-RESTORE] preserves group aliases and adds lifecycle leaves', () => {
    const root = new Command();
    registerIssueLabelsCommands(root);
    const group = child(root, 'issue-labels');

    expect(group.aliases()).toContain('ilbl');
    expect(group.commands.map(command => command.name())).toEqual([
      'list',
      'view',
      'create',
      'update',
      'delete',
      'retire',
      'restore',
      'sync-aliases',
    ]);
    expect(child(group, 'list').aliases()).toContain('ls');
  });

  it('[LPL-OPT-IL-LIST-LIMIT][LPL-OPT-IL-LIST-AFTER][LPL-OPT-IL-LIST-INCLUDERETIRED][LPL-OPT-IL-LIST-NOHISTORY] registers the full list option contract', () => {
    const root = new Command();
    registerIssueLabelsCommands(root);
    const flags = optionFlags(child(child(root, 'issue-labels'), 'list'));

    expect(flags).toEqual(
      expect.arrayContaining([
        '-t, --team <id>',
        '-w, --workspace',
        '--color <hex>',
        '-f, --format <type>',
        '--limit <number>',
        '--after <cursor>',
        '--include-retired',
        '-a, --all',
        '--no-cursor-history',
      ])
    );
  });

  it('[LPL-OPT-IL-CREATE-OUTPUT][LPL-OPT-IL-UPDATE-OUTPUT][LPL-OPT-IL-DELETE-OUTPUT][LPL-OPT-IL-RETIRE-OUTPUT][LPL-OPT-IL-RESTORE-OUTPUT] registers result controls independently', () => {
    const root = new Command();
    registerIssueLabelsCommands(root);
    const group = child(root, 'issue-labels');

    for (const name of ['create', 'update', 'delete', 'retire', 'restore']) {
      const flags = optionFlags(child(group, name));
      expect(flags, name).toEqual(
        expect.arrayContaining([
          '-o, --output <table|json>',
          '--json',
          '--dry-run',
          '-y, --yes',
          '--no-input',
        ])
      );
    }
  });
});

describe('M33 project-label command registration', () => {
  it('[LPL-CMD-PL-GROUP][LPL-ALS-PL-GROUP][LPL-CMD-PL-RETIRE][LPL-CMD-PL-RESTORE] preserves group aliases and adds lifecycle leaves', () => {
    const root = new Command();
    registerProjectLabelsCommands(root);
    const group = child(root, 'project-labels');

    expect(group.aliases()).toContain('plbl');
    expect(group.commands.map(command => command.name())).toEqual([
      'list',
      'view',
      'create',
      'update',
      'delete',
      'retire',
      'restore',
      'sync-aliases',
    ]);
    expect(child(group, 'list').aliases()).toContain('ls');
  });

  it('[LPL-OPT-PL-LIST-LIMIT][LPL-OPT-PL-LIST-AFTER][LPL-OPT-PL-LIST-INCLUDERETIRED][LPL-OPT-PL-LIST-NOHISTORY] registers pagination without archived scope', () => {
    const root = new Command();
    registerProjectLabelsCommands(root);
    const flags = optionFlags(child(child(root, 'project-labels'), 'list'));

    expect(flags).toEqual(
      expect.arrayContaining([
        '--color <hex>',
        '-f, --format <type>',
        '--limit <number>',
        '--after <cursor>',
        '--include-retired',
        '-a, --all',
        '--no-cursor-history',
      ])
    );
    expect(flags.some(flag => flag.includes('archived'))).toBe(false);
  });

  it('[LPL-OPT-PL-CREATE-OUTPUT][LPL-OPT-PL-UPDATE-OUTPUT][LPL-OPT-PL-DELETE-OUTPUT][LPL-OPT-PL-RETIRE-OUTPUT][LPL-OPT-PL-RESTORE-OUTPUT] registers result controls independently', () => {
    const root = new Command();
    registerProjectLabelsCommands(root);
    const group = child(root, 'project-labels');

    for (const name of ['create', 'update', 'delete', 'retire', 'restore']) {
      const flags = optionFlags(child(group, name));
      expect(flags, name).toEqual(
        expect.arrayContaining([
          '-o, --output <table|json>',
          '--json',
          '--dry-run',
          '-y, --yes',
          '--no-input',
        ])
      );
    }
  });
});
