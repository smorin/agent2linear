import { Command } from 'commander';
import { describe, expect, it } from 'vitest';

import { registerLabelsShim } from './register.js';

describe('M33 labels compatibility shim', () => {
  it('[LPL-CMD-LABELS-SHIM][LPL-ALS-LABELS-SHIM][LPL-CMD-LABELS-LIST-SHIM][LPL-ALS-LABELS-LIST-SHIM] preserves only the compatibility routes', () => {
    const root = new Command();
    registerLabelsShim(root);
    const group = root.commands.find(command => command.name() === 'labels');

    expect(group?.aliases()).toContain('lbl');
    expect(group?.commands.map(command => command.name())).toEqual(['list']);
    expect(group?.commands[0].aliases()).toContain('ls');
  });

  it('[LPL-RULE-LABELS-DEPRECATION] exits successfully, warns on stderr, and names both replacements and removal release', async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const root = new Command().exitOverride();
    root.configureOutput({
      writeOut: value => stdout.push(value),
      writeErr: value => stderr.push(value),
    });
    registerLabelsShim(root, {
      writeStdout: value => stdout.push(value),
      writeStderr: value => stderr.push(value),
    });

    await expect(root.parseAsync(['node', 'a2l', 'labels', 'list'])).resolves.toBe(root);

    expect(stderr.join('')).toContain('deprecated');
    expect(stderr.join('')).toContain('v2.0.0');
    expect(stdout.join('')).toContain('a2l issue-labels list');
    expect(stdout.join('')).toContain('a2l project-labels list');
  });

  it('[LPL-CMD-LABELS-SHIM] registers no create, update, delete, retire, or restore CRUD leaves', () => {
    const root = new Command();
    registerLabelsShim(root);
    const group = root.commands.find(command => command.name() === 'labels');
    const names = group?.commands.map(command => command.name()) ?? [];

    for (const forbidden of ['create', 'update', 'delete', 'retire', 'restore']) {
      expect(names).not.toContain(forbidden);
    }
  });
});
