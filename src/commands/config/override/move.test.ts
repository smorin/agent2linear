import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readConfigForScope } from '../../../lib/config.js';
import { __resetGitContextCache } from '../../../lib/git-context.js';
import { resetInvocationContext } from '../../../lib/invocation-context.js';
import { runOverrideMove } from './move.js';

let xdgConfig: string;
let workdir: string;
const origCwd = process.cwd();

function seedGlobal(overrides: unknown[]): void {
  const dir = join(xdgConfig, 'agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ overrides }, null, 2));
}

function ids() {
  return (readConfigForScope('global').overrides ?? []).map((r) => r.id);
}

function seedThree(): void {
  seedGlobal([
    { id: 'a', when: { repo: 'acme/web' }, defaultTeam: 't-a' },
    { id: 'b', when: { repo: 'acme/web' }, defaultTeam: 't-b' },
    { id: 'c', when: { repo: 'acme/web' }, defaultTeam: 't-c' },
  ]);
}

beforeEach(() => {
  xdgConfig = mkdtempSync(join(tmpdir(), 'a2l-ovmove-cfg-'));
  workdir = mkdtempSync(join(tmpdir(), 'a2l-ovmove-cwd-'));
  vi.stubEnv('XDG_CONFIG_HOME', xdgConfig);
  vi.stubEnv('LINEAR_API_KEY', '');
  vi.stubEnv('AGENT2LINEAR_WORKSPACE', '');
  process.chdir(workdir);
  resetInvocationContext();
  __resetGitContextCache();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(origCwd);
  resetInvocationContext();
  __resetGitContextCache();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(xdgConfig, { recursive: true, force: true });
  rmSync(workdir, { recursive: true, force: true });
});

describe('runOverrideMove', () => {
  // --before, moving forward (fromIndex < anchorIndex): a before c => [b, a, c]
  it('--before with fromIndex < anchorIndex', () => {
    seedThree();
    runOverrideMove('a', { before: 'c', global: true });
    expect(ids()).toEqual(['b', 'a', 'c']);
  });

  // --before, moving backward (fromIndex > anchorIndex): c before a => [c, a, b]
  it('--before with fromIndex > anchorIndex', () => {
    seedThree();
    runOverrideMove('c', { before: 'a', global: true });
    expect(ids()).toEqual(['c', 'a', 'b']);
  });

  // --after, moving forward (fromIndex < anchorIndex): a after b => [b, a, c]
  it('--after with fromIndex < anchorIndex', () => {
    seedThree();
    runOverrideMove('a', { after: 'b', global: true });
    expect(ids()).toEqual(['b', 'a', 'c']);
  });

  // --after, moving backward (fromIndex > anchorIndex): c after a => [a, c, b]
  it('--after with fromIndex > anchorIndex', () => {
    seedThree();
    runOverrideMove('c', { after: 'a', global: true });
    expect(ids()).toEqual(['a', 'c', 'b']);
  });

  it('resolves both selectors in-scope, incl. #index anchors', () => {
    seedThree();
    runOverrideMove('#2', { before: '#0', global: true });
    expect(ids()).toEqual(['c', 'a', 'b']);
  });

  it('requires exactly one of --before / --after', () => {
    seedThree();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideMove('a', { global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/exactly one of --before/);
    // Both at once is also rejected.
    runOverrideMove('a', { before: 'b', after: 'c', global: true });
    expect(err.mock.calls.flat().join(' ')).toMatch(/exactly one of --before/);
  });

  it('rejects moving a rule relative to itself', () => {
    seedThree();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideMove('a', { before: 'a', global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/relative to itself/);
  });

  it('errors when the moved selector is not found', () => {
    seedThree();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideMove('nope', { before: 'a', global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/"nope" not found/);
  });

  it('errors when the anchor selector is not found', () => {
    seedThree();
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const err = vi.spyOn(console, 'error');
    runOverrideMove('a', { before: 'nope', global: true });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join(' ')).toMatch(/"nope" not found/);
  });

  it('--json emits the moved rule record with its new index', () => {
    seedThree();
    const log = vi.spyOn(console, 'log');
    runOverrideMove('a', { after: 'c', global: true, json: true });
    const out = log.mock.calls.map((c) => String(c[0])).join('\n');
    const parsed = JSON.parse(out);
    expect(parsed.label).toBe('a');
    expect(parsed.index).toBe(2);
    expect(ids()).toEqual(['b', 'c', 'a']);
  });
});
