import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getGlobalPromptsPath,
  getPrompt,
  loadPrompts,
  resolvePromptBody,
  validatePrompt,
} from './prompts.js';

let tmp: string;
let home: string;
let xdg: string;
let originalCwd: string;

function writeGlobalPrompts(content: object): void {
  const file = join(xdg, 'agent2linear', 'prompts.json');
  mkdirSync(join(xdg, 'agent2linear'), { recursive: true });
  writeFileSync(file, JSON.stringify(content, null, 2), 'utf-8');
}

beforeEach(() => {
  originalCwd = process.cwd();
  tmp = mkdtempSync(join(tmpdir(), 'a2l-prompts-'));
  home = join(tmp, 'home');
  xdg = join(tmp, 'xdgcfg');
  mkdirSync(home, { recursive: true });
  mkdirSync(xdg, { recursive: true });
  vi.stubEnv('HOME', home);
  vi.stubEnv('XDG_CONFIG_HOME', xdg);
});

afterEach(() => {
  process.chdir(originalCwd);
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('prompts.ts global path honors XDG', () => {
  it('resolves the global prompts file under $XDG_CONFIG_HOME', () => {
    const expected = join(xdg, 'agent2linear', 'prompts.json');
    expect(getGlobalPromptsPath()).toBe(expected);
  });

  it('loads an inline body prompt from the global store', () => {
    writeGlobalPrompts({ prompts: { general: { body: '## Title\n' } } });
    process.chdir(home); // no project .agent2linear discoverable above home
    const prompts = loadPrompts();
    expect(prompts.general).toBeDefined();
    expect(prompts.general.source).toBe('global');
    expect(resolvePromptBody('general')?.body).toBe('## Title\n');
  });
});

describe('prompts.ts global + project merge (project overwrites by name)', () => {
  it('project prompt overrides a same-named global prompt', () => {
    writeGlobalPrompts({
      prompts: {
        general: { body: 'GLOBAL general' },
        onlyGlobal: { body: 'global-only' },
      },
    });
    // A project .agent2linear/prompts.json located between cwd and home.
    const projectRoot = join(home, 'work', 'repo');
    const projectDir = join(projectRoot, '.agent2linear');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, 'prompts.json'),
      JSON.stringify({ prompts: { general: { body: 'PROJECT general' } } }),
      'utf-8'
    );
    process.chdir(projectRoot);

    const prompts = loadPrompts();
    expect(prompts.general.source).toBe('project');
    expect(resolvePromptBody('general')?.body).toBe('PROJECT general');
    // Global-only entry still resolves.
    expect(prompts.onlyGlobal.source).toBe('global');
    expect(resolvePromptBody('onlyGlobal')?.body).toBe('global-only');
  });
});

describe('resolvePromptBody bodyFile anchoring', () => {
  it('anchors a relative bodyFile to the declaring prompts.json directory', () => {
    writeGlobalPrompts({ prompts: { fromFile: { bodyFile: 'bodies/foo.md' } } });
    const bodiesDir = join(xdg, 'agent2linear', 'bodies');
    mkdirSync(bodiesDir, { recursive: true });
    writeFileSync(join(bodiesDir, 'foo.md'), 'FILE BODY\n', 'utf-8');
    process.chdir(home);

    // Resolve from an unrelated cwd to prove anchoring is to the declaring file,
    // not the invocation cwd.
    const elsewhere = join(home, 'elsewhere');
    mkdirSync(elsewhere, { recursive: true });
    process.chdir(elsewhere);

    expect(resolvePromptBody('fromFile')?.body).toBe('FILE BODY\n');
  });

  it('throws a clear error when a bodyFile cannot be read', () => {
    writeGlobalPrompts({ prompts: { missing: { bodyFile: 'bodies/does-not-exist.md' } } });
    process.chdir(home);
    expect(() => resolvePromptBody('missing')).toThrow(/bodyFile could not be read/);
  });

  it('returns null for an unknown prompt name', () => {
    writeGlobalPrompts({ prompts: { general: { body: 'x' } } });
    process.chdir(home);
    expect(getPrompt('nope')).toBeNull();
    expect(resolvePromptBody('nope')).toBeNull();
  });
});

describe('validatePrompt (exactly one of body | bodyFile)', () => {
  it('accepts an inline body only', () => {
    expect(validatePrompt({ body: 'x' }).valid).toBe(true);
  });

  it('accepts a bodyFile only', () => {
    expect(validatePrompt({ bodyFile: 'x.md' }).valid).toBe(true);
  });

  it('rejects neither body nor bodyFile', () => {
    const result = validatePrompt({ description: 'no body' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/either/);
  });

  it('rejects both body and bodyFile', () => {
    const result = validatePrompt({ body: 'x', bodyFile: 'x.md' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/not both/);
  });
});

describe('contextDir scopes PROJECT prompt discovery (fix E — -C / explain [dir])', () => {
  it('resolvePromptBody(name, dir) reads the target dir project, not cwd', () => {
    // Two sibling project roots, each with its own .agent2linear/prompts.json
    // defining a same-named prompt with a different body.
    const repoA = join(home, 'a');
    const repoB = join(home, 'b');
    for (const [root, body] of [[repoA, 'FROM A'], [repoB, 'FROM B']] as const) {
      const dir = join(root, '.agent2linear');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'prompts.json'), JSON.stringify({ prompts: { p: { body } } }), 'utf-8');
    }
    process.chdir(repoA);

    // No dir → cwd (repoA): unchanged behavior.
    expect(resolvePromptBody('p')?.body).toBe('FROM A');
    // Explicit dir → repoB's project store (the -C / `explain <dir>` path), even
    // though cwd is still repoA.
    expect(resolvePromptBody('p', repoB)?.body).toBe('FROM B');
  });
});
