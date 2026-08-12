import { describe, expect, it } from 'vitest';

import { stdinAllocationConflict } from './stdin-allocation.js';

describe('stdinAllocationConflict', () => {
  it('CMT-INP-STDIN-APIKEY-CONFLICT rejects explicit comment-body stdin', () => {
    expect(stdinAllocationConflict({
      apiKeyFile: '-',
      commandPath: ['issue', 'comment', 'add'],
      bodyFile: '-',
      stdinIsTTY: false,
    })).toMatch(/both --api-key-file - and a comment body/);
  });

  it('CMT-INP-STDIN-APIKEY-CONFLICT rejects implicit non-TTY comment-body stdin', () => {
    expect(stdinAllocationConflict({
      apiKeyFile: '-',
      commandPath: ['project', 'comment', 'add'],
      stdinIsTTY: false,
    })).toMatch(/both --api-key-file - and a comment body/);
  });

  it('allows inline bodies, path bodies, TTY missing bodies, and unrelated commands', () => {
    expect(stdinAllocationConflict({
      apiKeyFile: '-',
      commandPath: ['issue', 'comment', 'add'],
      body: 'inline',
      stdinIsTTY: false,
    })).toBeNull();
    expect(stdinAllocationConflict({
      apiKeyFile: '-',
      commandPath: ['project', 'comment', 'add'],
      bodyFile: 'note.md',
      stdinIsTTY: false,
    })).toBeNull();
    expect(stdinAllocationConflict({
      apiKeyFile: '-',
      commandPath: ['issue', 'comment', 'add'],
      stdinIsTTY: true,
    })).toBeNull();
    expect(stdinAllocationConflict({
      apiKeyFile: '-',
      commandPath: ['issue', 'comment', 'list'],
      stdinIsTTY: false,
    })).toBeNull();
  });

  it('allows stdin body when the API key comes from anywhere except stdin', () => {
    expect(stdinAllocationConflict({
      apiKeyFile: 'key.txt',
      commandPath: ['issue', 'comment', 'add'],
      bodyFile: '-',
      stdinIsTTY: false,
    })).toBeNull();
  });

  it('rejects issue create implicit stdin when the title is absent', () => {
    expect(
      stdinAllocationConflict({
        apiKeyFile: '-',
        commandPath: ['issue', 'create'],
        stdinIsTTY: false,
      })
    ).toMatch(/issue create input/);
  });

  it('rejects issue create implicit stdin when an explicit title is empty', () => {
    expect(
      stdinAllocationConflict({
        apiKeyFile: '-',
        commandPath: ['issue', 'create'],
        title: '',
        stdinIsTTY: false,
      })
    ).toMatch(/issue create input/);
  });

  it('allows issue create when an explicit title prevents implicit stdin', () => {
    expect(
      stdinAllocationConflict({
        apiKeyFile: '-',
        commandPath: ['issue', 'create'],
        title: 'Explicit title',
        stdinIsTTY: false,
      })
    ).toBeNull();
  });

  it('rejects issue update --description - before either stdin reader runs', () => {
    expect(
      stdinAllocationConflict({
        apiKeyFile: '-',
        commandPath: ['issue', 'update'],
        description: '-',
        stdinIsTTY: true,
      })
    ).toMatch(/issue description/);
  });

  it('rejects stdin credentials before explicit interactive input starts', () => {
    expect(
      stdinAllocationConflict({
        apiKeyFile: '-',
        commandPath: ['project', 'create'],
        interactiveInput: true,
        stdinIsTTY: true,
      })
    ).toMatch(/interactive input/);
  });

  it('rejects stdin credentials before a destructive confirmation unless bypassed', () => {
    const input = {
      apiKeyFile: '-',
      commandPath: ['issue', 'update'],
      destructiveConfirmation: true,
      stdinIsTTY: true,
    } as const;
    expect(stdinAllocationConflict(input)).toMatch(/confirmation input/);
    expect(stdinAllocationConflict({ ...input, yes: true })).toBeNull();
    expect(stdinAllocationConflict({ ...input, noInput: true })).toBeNull();
    expect(stdinAllocationConflict({ ...input, dryRun: true })).toBeNull();
  });
});
