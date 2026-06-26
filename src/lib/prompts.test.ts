import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __resetGitContextCache } from './git-context.js';
import { resetInvocationContext } from './invocation-context.js';
import type { OverrideContext } from './overrides.js';
import { type LoadedPromptRule,resolvePrompt, resolvePromptRules } from './prompts.js';

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

/**
 * M30 fix A — a flat `{ team, branch }` promptRule must outrank a `{ team }`-only
 * rule (both leaves are scored additively in one matchWhen pass). Tested at the
 * resolvePromptRules level because these temp dirs are not git repos, so a branch
 * can't reach the team layer through resolvePrompt.
 */
describe('resolvePromptRules — flat { team, branch } outranks { team } (fix A)', () => {
  const ctx: OverrideContext = {
    contextDir: '/x',
    repoRoot: '/x',
    remotes: {},
    branch: 'release/1.0',
    team: 'team_pay',
  };
  const rule = (when: object, prompt: string): LoadedPromptRule => ({
    rule: { when: when as never, prompt },
    scope: 'global',
  });

  it('the more specific rule wins even when the broader rule is declared LAST', () => {
    const winner = resolvePromptRules(ctx, [
      rule({ team: 'team_pay', branch: 'release/*' }, 'specific'), // declared first
      rule({ team: 'team_pay' }, 'broad'), // declared last — would win a score tie
    ]);
    // Pre-fix both scored 1 (collision) → 'broad' won by declaration order.
    expect(winner?.rule.prompt).toBe('specific');
  });

  it('order-independent: the flat rule still wins when declared first', () => {
    const winner = resolvePromptRules(ctx, [
      rule({ team: 'team_pay' }, 'broad'),
      rule({ team: 'team_pay', branch: 'release/*' }, 'specific'),
    ]);
    expect(winner?.rule.prompt).toBe('specific');
  });
});

/**
 * M30 fix B — a `team` ALIAS nested in allOf/anyOf/not must resolve to the canonical
 * id before matching (matchWhen compares against the already-resolved ctx.team).
 */
describe('resolvePromptRules — nested team aliases normalize (fix B)', () => {
  const ctxFor = (team: string): OverrideContext => ({
    contextDir: repoRoot,
    repoRoot,
    remotes: {},
    team,
  });
  const rule = (when: object, prompt: string): LoadedPromptRule => ({
    rule: { when: when as never, prompt },
    scope: 'global',
  });

  it('an alias nested in allOf matches the resolved team id', () => {
    writeGlobalAliases({ teams: { payments: 'team_pay' } });
    process.chdir(repoRoot); // hermetic: discover the stubbed global aliases, not the real repo's
    const winner = resolvePromptRules(ctxFor('team_pay'), [
      rule({ allOf: [{ team: 'payments' }] }, 'pay-issue'),
    ]);
    // Pre-fix: nested 'payments' compared raw against 'team_pay' → no match → null.
    expect(winner?.rule.prompt).toBe('pay-issue');
  });

  it('an alias nested in anyOf and not also normalizes', () => {
    writeGlobalAliases({ teams: { payments: 'team_pay' } });
    process.chdir(repoRoot);
    expect(
      resolvePromptRules(ctxFor('team_pay'), [rule({ anyOf: [{ team: 'payments' }] }, 'a')])?.rule.prompt
    ).toBe('a');
    // not{ payments→team_pay } excludes team_pay, matches a different team.
    expect(resolvePromptRules(ctxFor('team_pay'), [rule({ not: { team: 'payments' } }, 'n')])).toBeNull();
    expect(
      resolvePromptRules(ctxFor('team_other'), [rule({ not: { team: 'payments' } }, 'n')])?.rule.prompt
    ).toBe('n');
  });
});
