import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { registerIssueCommands } from './issue/register.js';
import { registerProjectCommands } from './project/register.js';

function commandAt(root: Command, ...path: string[]): Command {
  let current = root;
  for (const name of path) {
    const next = current.commands.find(command => command.name() === name);
    if (!next) throw new Error(`missing command ${path.join(' ')}`);
    current = next;
  }
  return current;
}

function flags(command: Command): string[] {
  return command.options.map(option => option.flags);
}

function issueCommand(name: string): Command {
  const root = new Command();
  registerIssueCommands(root);
  return commandAt(root, 'issue', name);
}

function projectCommand(...path: string[]): Command {
  const root = new Command();
  registerProjectCommands(root);
  return commandAt(root, 'project', ...path);
}

function expectJsonSelectors(command: Command): void {
  expect(flags(command)).toEqual(
    expect.arrayContaining(['-o, --output <table|json>', '--json'])
  );
}

describe('M36 issue result selectors', () => {
  it('[RLS-OUT-ISSUE-CREATE] registers canonical output and JSON selectors', () => {
    expectJsonSelectors(issueCommand('create'));
  });

  it('[RLS-OUT-ISSUE-UPDATE] registers canonical output and JSON selectors', () => {
    expectJsonSelectors(issueCommand('update'));
  });

  it('[RLS-OUT-ISSUE-VIEW] registers canonical output and JSON selectors', () => {
    expectJsonSelectors(issueCommand('view'));
  });
});

describe('M36 project result selectors', () => {
  it('[RLS-OUT-PROJECT-CREATE] registers canonical output and JSON selectors', () => {
    expectJsonSelectors(projectCommand('create'));
  });

  it('[RLS-OUT-PROJECT-UPDATE] preserves canonical output and JSON selectors', () => {
    expectJsonSelectors(projectCommand('update'));
  });

  it('[RLS-OUT-PROJECT-VIEW] registers canonical output and JSON selectors', () => {
    expectJsonSelectors(projectCommand('view'));
  });

  it('[RLS-OUT-PROJECT-DEPENDENCIES-LIST] registers canonical output and JSON selectors', () => {
    expectJsonSelectors(projectCommand('dependencies', 'list'));
  });
});
