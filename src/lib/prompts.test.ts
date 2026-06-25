import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from './git-context.js';
import { resetInvocationContext } from './invocation-context.js';
import { resolvePrompt } from './prompts.js';

/**
 * M30 Phase 3 — `resolvePrompt` precedence matrix (explicit > location > team >
 * general), the explicit-`--team` no-match error, derived-team fall-through, and
 * alias-vs-id team equivalence.
 *
 * Resolution context is the process cwd (the `-C` lever does `process.chdir` in
 * production, cli.ts:82), so each test `process.chdir`s into the resolution dir and
 * calls `resolvePrompt` with NO `dir` arg — exactly what `runPromptGet` does. The
 * temp dirs are not git repos, so the team layer's git context is empty and
 * `path`/`team` matching is all that's exercised.
 */

let tmp: string;
let home: string;
let xdg: string;
let repoRoot: string;
let subDir: string;
let originalCwd: string;

/** Write the global aliases.json under the stubbed XDG dir. */
function writeGlobalAliases(content: object): void {
  mkdirSync(join(xdg, 'agent2linear'), { recursive: true });
  writeFileSync(join(xdg, 'agent2linear', 'aliases.json'), JSON.stringify(content, null, 2), 'utf-8');
}

/** Write the project .agent2linear/<file> for the test repo. */
function writeProjectFile(file: string, content: object): void {
  const dir = join(repoRoot, '.agent2linear');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), JSON.stringify(content, null, 2), 'utf-8');
}

beforeEach(() => {
  originalCwd = process.cwd();
  resetInvocationContext();
  __resetGitContextCache();
  tmp = mkdtempSync(join(tmpdir(), 'a2l-prompt-resolve-'));
  home = join(tmp, 'home');
  xdg = join(tmp, 'xdgcfg');
  repoRoot = join(home, 'work', 'repo');
  subDir = join(repoRoot, 'apps', 'mobile');
  mkdirSync(home, { recursive: true });
  mkdirSync(xdg, { recursive: true });
  mkdirSync(subDir, { recursive: true });
  vi.stubEnv('HOME', home);
  vi.stubEnv('XDG_CONFIG_HOME', xdg);
});

afterEach(() => {
  process.chdir(originalCwd); // leave tmp before removing it
  resetInvocationContext();
  __resetGitContextCache();
  vi.unstubAllEnvs();
  rmSync(tmp, { recursive: true, force: true });
});

describe('resolvePrompt — precedence ladder', () => {
  it('explicit name beats everything', () => {
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      defaultTeam: 'team_pay',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    writeProjectFile('prompts.json', {
      prompts: {
        general: { body: 'GENERAL' },
        'mobile-issue': { body: 'MOBILE' },
        'pay-issue': { body: 'PAY' },
        'explicit-one': { body: 'EXPLICIT' },
      },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    process.chdir(subDir);
    const r = resolvePrompt({ name: 'explicit-one' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('explicit');
      expect(r.prompt.body).toBe('EXPLICIT');
    }
  });

  it('a location override outranks a matching team rule', () => {
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      defaultTeam: 'team_pay',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'mobile-issue': { body: 'MOBILE' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    process.chdir(subDir);
    const r = resolvePrompt({ team: 'team_pay', explicitTeam: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('location');
      expect(r.prompt.name).toBe('mobile-issue');
    }
  });

  it('a team rule outranks the general default (no location override in scope)', () => {
    writeProjectFile('config.json', { defaultPrompt: 'general', defaultTeam: 'team_pay' });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    // Resolve at the repo root (no path override applies).
    process.chdir(repoRoot);
    const r = resolvePrompt({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('team');
      expect(r.prompt.name).toBe('pay-issue');
    }
  });

  it('falls through to the general default when no team rule matches a derived team', () => {
    writeProjectFile('config.json', { defaultPrompt: 'general', defaultTeam: 'team_unmatched' });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    process.chdir(repoRoot);
    const r = resolvePrompt({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('general');
      expect(r.prompt.name).toBe('general');
    }
  });

  it('a branch-only override is general-tier (never location)', () => {
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      overrides: [{ when: { branch: 'release/*' }, defaultPrompt: 'release-prompt' }],
    });
    writeProjectFile('prompts.json', { prompts: { general: { body: 'GENERAL' }, 'release-prompt': { body: 'REL' } } });
    // No git branch here, so the branch override does not win anyway; the point is
    // even if it did, whenIsLocationSpecific(branch) is false → never 'location'.
    process.chdir(repoRoot);
    const r = resolvePrompt({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('general');
    }
  });
});

describe('resolvePrompt — explicit --team strictness', () => {
  it('errors (exit-1 path) when --team is explicit and no rule matches', () => {
    writeProjectFile('config.json', { defaultPrompt: 'general', defaultTeam: 'team_pay' });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    process.chdir(repoRoot);
    const r = resolvePrompt({ team: 'team_other', explicitTeam: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/No prompt configured for team/);
    }
  });

  it('does NOT error for an explicit --team when a location override wins', () => {
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    writeProjectFile('prompts.json', { prompts: { general: { body: 'G' }, 'mobile-issue': { body: 'M' } } });
    process.chdir(subDir);
    const r = resolvePrompt({ team: 'team_unmatched', explicitTeam: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('location');
    }
  });
});

describe('resolvePrompt — alias vs id team equivalence', () => {
  it('a promptRule keyed on a team alias matches when --team is the raw id (and vice versa)', () => {
    // Global aliases.json maps the alias "payments" → team_pay.
    writeGlobalAliases({ teams: { payments: 'team_pay' } });
    writeProjectFile('config.json', { defaultPrompt: 'general' });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'pay-issue': { body: 'PAY' } },
      // Rule keyed on the ALIAS; --team passed as the raw id (and vice versa).
      promptRules: [{ when: { team: 'payments' }, prompt: 'pay-issue' }],
    });
    process.chdir(repoRoot);

    const byId = resolvePrompt({ team: 'team_pay', explicitTeam: true });
    expect(byId.ok).toBe(true);
    if (byId.ok) {
      expect(byId.prompt.selection).toBe('team');
      expect(byId.prompt.name).toBe('pay-issue');
    }

    const byAlias = resolvePrompt({ team: 'payments', explicitTeam: true });
    expect(byAlias.ok).toBe(true);
    if (byAlias.ok) {
      expect(byAlias.prompt.name).toBe('pay-issue');
    }
  });
});

describe('resolvePrompt — --force team-first (scoped to explicit --team)', () => {
  it('force + explicit --team + a matching rule beats an in-scope location override', () => {
    // Same fixture as "a location override outranks a matching team rule", but with
    // force:true flipping the expectation to the team prompt.
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      defaultTeam: 'team_pay',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'mobile-issue': { body: 'MOBILE' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    process.chdir(subDir);
    const r = resolvePrompt({ team: 'team_pay', explicitTeam: true, force: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('team');
      expect(r.prompt.name).toBe('pay-issue');
    }
  });

  it('force + explicit --team + no matching rule errors even with a location override AND a general default', () => {
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      defaultTeam: 'team_pay',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'mobile-issue': { body: 'MOBILE' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    // In apps/mobile the location override (mobile-issue) WOULD win, and a general
    // default exists — force + no matching rule must still hard-error.
    process.chdir(subDir);
    const r = resolvePrompt({ team: 'team_other', explicitTeam: true, force: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/No prompt configured for team/);
    }
  });

  it('force WITHOUT an explicit --team is a no-op (normal ladder result)', () => {
    // Location override in scope; force set but no --team ⇒ the ladder runs unchanged
    // and the location override wins (proving force did not engage).
    writeProjectFile('config.json', {
      defaultPrompt: 'general',
      defaultTeam: 'team_pay',
      overrides: [{ when: { path: 'apps/mobile/**' }, defaultPrompt: 'mobile-issue' }],
    });
    writeProjectFile('prompts.json', {
      prompts: { general: { body: 'GENERAL' }, 'mobile-issue': { body: 'MOBILE' }, 'pay-issue': { body: 'PAY' } },
      promptRules: [{ when: { team: 'team_pay' }, prompt: 'pay-issue' }],
    });
    process.chdir(subDir);
    const r = resolvePrompt({ force: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prompt.selection).toBe('location');
      expect(r.prompt.name).toBe('mobile-issue');
    }
  });
});
