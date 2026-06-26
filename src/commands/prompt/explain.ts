import { resolveAlias } from '../../lib/aliases.js';
import { canonicalizeDir, getConfig, resolveRepoRoot } from '../../lib/config.js';
import { buildGitContext, type RemoteIdentity } from '../../lib/git-context.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import {
  buildPromptOverrideContext,
  loadPromptRules,
  type PromptSelection,
  resolvePrompt,
  resolvePromptRules,
} from '../../lib/prompts.js';
import type { ConfigLocation } from '../../lib/types.js';
import { sourceLabel } from '../config/explain.js';

/**
 * `prompt explain [dir]` (M30 Phase 4): mirrors `config explain` but adds the prompt
 * team layer (which `config explain` alone can't show). It calls `resolvePrompt` once
 * for the AUTHORITATIVE final selection (never re-deriving the ladder) and assembles a
 * decision trace: the context, the resolved `defaultPrompt` + provenance, the team
 * (`--team`/`defaultTeam` + resolved id), the matched `promptRule` (shown even when it
 * doesn't win), and the final selection + tier. Rendering is split into pure functions
 * so it can be unit-tested without the CLI; unlike `prompt get`, explain never exits 1 —
 * an unresolved/`--team`-strict error is captured into the model and rendered.
 */

export interface PromptExplainTeam {
  /** The raw team selector (`--team` or `defaultTeam`), before alias resolution. */
  input?: string;
  /** The resolved canonical team id used for matching. */
  resolved?: string;
  /** Whether `--team` was passed explicitly (drives the strict no-match error). */
  explicit: boolean;
}

export interface PromptExplainMatchedRule {
  /** Scope the matched rule was declared in. */
  scope: 'global' | 'project';
  /** The rule's `when` clause (undefined ⇒ catch-all). */
  when?: Record<string, unknown>;
  /** The prompt name the matched rule selects. */
  prompt: string;
}

export interface PromptExplainData {
  contextDir: string;
  repoRoot: string | null;
  branch?: string;
  remotes: Record<string, RemoteIdentity>;
  /** The resolved general `defaultPrompt` config value (may be undefined). */
  defaultPrompt?: string;
  /** Provenance of the resolved `defaultPrompt`. */
  defaultPromptLocation: ConfigLocation;
  /** The team layer inputs (input/resolved/explicit). */
  team: PromptExplainTeam;
  /** The matched `promptRule`, if any (shown even when a higher tier wins). */
  matchedRule: PromptExplainMatchedRule | null;
  /** The authoritative final selection (null when nothing resolved). */
  selection: PromptSelection | null;
  /** The authoritative final prompt name (null on error). */
  selectedName: string | null;
  /** A resolution error message, when nothing resolved (explain still exits 0). */
  error?: string;
  /** A remediation hint from prompt resolution, surfaced with `error` (parity with `prompt get`). */
  hint?: string;
}

/**
 * Build the prompt-explain model for a context dir + team options. Reuses
 * `getConfig`/`buildGitContext`/`resolveRepoRoot` (like `config explain`) for the
 * resolved `defaultPrompt` + context, evaluates the matched `promptRule`
 * INDEPENDENTLY of who wins (so it surfaces even when a location override outranks
 * it), and reads the authoritative selection from `resolvePrompt`.
 */
export function buildPromptExplainData(
  dir?: string,
  options: { team?: string; force?: boolean } = {}
): PromptExplainData {
  const contextDir = canonicalizeDir(dir ?? getInvocationContext().contextDir ?? process.cwd());
  const git = buildGitContext(contextDir);
  const repoRoot = resolveRepoRoot(contextDir) ?? git.repoRoot;
  const config = getConfig(dir);

  // Team layer inputs (mirror resolvePrompt): team = --team ?? defaultTeam.
  const explicitTeam = options.team !== undefined;
  const teamInput = options.team ?? config.defaultTeam;
  const resolvedTeam = teamInput ? resolveAlias('team', teamInput) : undefined;

  // Evaluate the matched rule independently of who ultimately wins — its value as a
  // diagnostic is showing "this team rule matched" alongside the final selection.
  let matchedRule: PromptExplainMatchedRule | null = null;
  if (resolvedTeam) {
    const overrideCtx = buildPromptOverrideContext(contextDir, resolvedTeam);
    const winner = resolvePromptRules(overrideCtx, loadPromptRules(contextDir));
    if (winner) {
      matchedRule = {
        scope: winner.scope,
        when: winner.rule.when as Record<string, unknown> | undefined,
        prompt: winner.rule.prompt,
      };
    }
  }

  // Authoritative final outcome — never re-derive the ladder here.
  const result = resolvePrompt({ team: options.team, explicitTeam, force: options.force }, dir);

  return {
    contextDir,
    repoRoot,
    branch: git.branch,
    remotes: git.remotes,
    defaultPrompt: config.defaultPrompt,
    defaultPromptLocation: config.locations.defaultPrompt,
    team: { input: teamInput, resolved: resolvedTeam, explicit: explicitTeam },
    matchedRule,
    selection: result.ok ? result.prompt.selection : null,
    selectedName: result.ok ? result.prompt.name : null,
    error: result.ok ? undefined : result.error,
    hint: result.ok ? undefined : result.hint,
  };
}

/** Render the prompt-explain model as human-readable text. */
export function renderPromptExplainText(data: PromptExplainData): string {
  const lines: string[] = [
    'context:',
    `  contextDir  ${data.contextDir}`,
    `  repoRoot    ${data.repoRoot ?? '(none)'}`,
  ];
  const remoteNames = Object.keys(data.remotes);
  if (remoteNames.length === 0) {
    lines.push('  remotes     (none)');
  } else {
    remoteNames.forEach((name, i) => {
      const r = data.remotes[name];
      lines.push(`  ${(i === 0 ? 'remotes' : '').padEnd(9)} ${name} → ${r.host}  ${r.owner}/${r.name}`);
    });
  }
  lines.push(`  branch      ${data.branch ?? '(none)'}`);

  lines.push('defaultPrompt:');
  const shownDefault = data.defaultPrompt === undefined ? '(not set)' : data.defaultPrompt;
  lines.push(`  ${shownDefault.padEnd(24)} ← ${sourceLabel(data.defaultPromptLocation)}`);

  lines.push('team:');
  if (data.team.input === undefined) {
    lines.push('  (none)');
  } else {
    const origin = data.team.explicit ? '--team' : 'defaultTeam';
    const resolved = data.team.resolved && data.team.resolved !== data.team.input ? ` → ${data.team.resolved}` : '';
    lines.push(`  ${data.team.input}${resolved}  (${origin})`);
  }
  if (data.matchedRule) {
    const scopeLabel = data.matchedRule.scope === 'project' ? 'repo' : 'global';
    const whenStr = data.matchedRule.when ? JSON.stringify(data.matchedRule.when) : '{}';
    lines.push(`  matched rule  ${scopeLabel} (when ${whenStr}) → ${data.matchedRule.prompt}`);
  } else if (data.team.input !== undefined) {
    lines.push('  matched rule  (none)');
  }

  lines.push('selection:');
  if (data.selection) {
    lines.push(`  ${(data.selectedName ?? '').padEnd(24)} ← ${data.selection}`);
  } else {
    lines.push(`  (unresolved)  ${data.error ?? ''}`.trimEnd());
    if (data.hint) {
      lines.push(`  hint          ${data.hint}`);
    }
  }
  return lines.join('\n');
}

/** Render the prompt-explain model as a machine-readable object (for `--json`). */
export function buildPromptExplainJson(data: PromptExplainData): Record<string, unknown> {
  const loc = data.defaultPromptLocation;
  return {
    contextDir: data.contextDir,
    repoRoot: data.repoRoot,
    branch: data.branch ?? null,
    remotes: data.remotes,
    defaultPrompt: {
      value: data.defaultPrompt ?? null,
      source: loc.type,
      ...(loc.type === 'override' ? { scope: loc.scope, ruleIndex: loc.ruleIndex, when: loc.when } : {}),
    },
    team: {
      input: data.team.input ?? null,
      resolved: data.team.resolved ?? null,
      explicit: data.team.explicit,
    },
    matchedRule: data.matchedRule
      ? { scope: data.matchedRule.scope, when: data.matchedRule.when ?? {}, prompt: data.matchedRule.prompt }
      : null,
    selection: data.selection,
    selectedName: data.selectedName,
    error: data.error ?? null,
    hint: data.hint ?? null,
  };
}

/** Command action for `prompt explain [dir]`. */
export async function explainPrompt(
  dir: string | undefined,
  options: { json?: boolean; team?: string; force?: boolean }
): Promise<void> {
  const data = buildPromptExplainData(dir, { team: options.team, force: options.force });
  if (options.json) {
    console.log(JSON.stringify(buildPromptExplainJson(data), null, 2));
  } else {
    console.log(renderPromptExplainText(data));
  }
}
