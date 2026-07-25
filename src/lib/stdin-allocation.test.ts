import { describe, expect, it } from 'vitest';

import { stdinAllocationConflict } from './stdin-allocation.js';

describe('stdinAllocationConflict', () => {
  it('CMT-INP-STDIN-APIKEY-CONFLICT rejects explicit comment-body stdin', () => {
    expect(stdinAllocationConflict({
      apiKey: '-',
      commandPath: ['issue', 'comment', 'add'],
      bodyFile: '-',
      stdinIsTTY: false,
    })).toMatch(/both --api-key - and a comment body/);
  });

  it('CMT-INP-STDIN-APIKEY-CONFLICT rejects implicit non-TTY comment-body stdin', () => {
    expect(stdinAllocationConflict({
      apiKey: '-',
      commandPath: ['project', 'comment', 'add'],
      stdinIsTTY: false,
    })).toMatch(/both --api-key - and a comment body/);
  });

  it('allows inline bodies, path bodies, TTY missing bodies, and unrelated commands', () => {
    expect(stdinAllocationConflict({
      apiKey: '-',
      commandPath: ['issue', 'comment', 'add'],
      body: 'inline',
      stdinIsTTY: false,
    })).toBeNull();
    expect(stdinAllocationConflict({
      apiKey: '-',
      commandPath: ['project', 'comment', 'add'],
      bodyFile: 'note.md',
      stdinIsTTY: false,
    })).toBeNull();
    expect(stdinAllocationConflict({
      apiKey: '-',
      commandPath: ['issue', 'comment', 'add'],
      stdinIsTTY: true,
    })).toBeNull();
    expect(stdinAllocationConflict({
      apiKey: '-',
      commandPath: ['issue', 'comment', 'list'],
      stdinIsTTY: false,
    })).toBeNull();
  });

  it('allows stdin body when the API key comes from anywhere except stdin', () => {
    expect(stdinAllocationConflict({
      apiKey: 'lin_api_literal',
      commandPath: ['issue', 'comment', 'add'],
      bodyFile: '-',
      stdinIsTTY: false,
    })).toBeNull();
  });
});
