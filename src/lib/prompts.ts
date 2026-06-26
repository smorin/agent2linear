import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, isAbsolute, join } from 'path';

import { resolveAlias } from './aliases.js';
import { canonicalizeDir, getConfig, resolveRepoRoot } from './config.js';
import { buildGitContext, type RemoteIdentity } from './git-context.js';
import { getInvocationContext } from './invocation-context.js';
import { logger } from './logger.js';
import { compareKeys, matchWhen, type OverrideContext } from './overrides.js';
import type { PromptEntry, PromptRule, Prompts, PromptWhen, WhenClause } from './types.js';
import { findProjectConfigDir, userConfigDir } from './xdg-paths.js';

const PROMPTS_FILENAME = 'prompts.json';

/** Resolved prompt store entry: the entry, its source scope, and the declaring file. */
export interface LoadedPrompt {
  entry: PromptEntry;
  source: 'global' | 'project';
  file: string;
}

function globalPromptsFile(): string {
  return join(userConfigDir(), PROMPTS_FILENAME);
}

function projectPromptsReadFile(contextDir?: string): string | null {
  const dir = findProjectConfigDir(contextDir);
  return dir ? join(dir, PROMPTS_FILENAME) : null;
}

/** Read a prompts JSON file; returns null when absent or malformed (warn to stderr). */
function readPromptsFile(path: string): Prompts | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content) as Prompts;
  } catch (error) {
    console.warn(
      `Warning: Failed to parse prompts from ${path}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Load prompts from both global and project locations. Project prompts override
 * global prompts by name (same merge as milestone-templates). Each entry is tagged
 * with its `source` scope and the `file` that declared it (so a relative `bodyFile`
 * can be anchored to the declaring file's directory, not the invocation cwd).
 *
 * `contextDir` (the effective resolution dir from `resolvePrompt`/`getConfig`)
 * anchors PROJECT prompt discovery, so a `-C <dir>` / `prompt explain <dir>` reads
 * the target repo's `.agent2linear/prompts.json` — matching where `getConfig(dir)`
 * resolved `defaultPrompt`. Omitted ⇒ `process.cwd()` (unchanged behavior).
 */
export function loadPrompts(contextDir?: string): { [name: string]: LoadedPrompt } {
  const result: { [name: string]: LoadedPrompt } = {};

  // Global prompts first.
  const globalFile = globalPromptsFile();
  const globalPrompts = readPromptsFile(globalFile);
  if (globalPrompts?.prompts) {
    for (const [name, entry] of Object.entries(globalPrompts.prompts)) {
      result[name] = { entry, source: 'global', file: globalFile };
    }
  }

  // Project prompts override global by name.
  const projectFile = projectPromptsReadFile(contextDir);
  const projectPrompts = projectFile ? readPromptsFile(projectFile) : null;
  if (projectFile && projectPrompts?.prompts) {
    for (const [name, entry] of Object.entries(projectPrompts.prompts)) {
      result[name] = { entry, source: 'project', file: projectFile };
    }
  }

  return result;
}

/** A `promptRule` tagged with the scope it was declared in (for §5.6 tie-breaking). */
export interface LoadedPromptRule {
  rule: PromptRule;
  scope: 'global' | 'project';
}

/**
 * Load the team-layer `promptRules` from both scopes (global then project, so a
 * project rule sorts after an equal-specificity global one and wins). Each rule is
 * tagged with its declaring scope, mirroring the override layers in `getConfig`.
 */
export function loadPromptRules(contextDir?: string): LoadedPromptRule[] {
  const result: LoadedPromptRule[] = [];

  const globalPrompts = readPromptsFile(globalPromptsFile());
  if (Array.isArray(globalPrompts?.promptRules)) {
    for (const rule of globalPrompts.promptRules) {
      result.push({ rule, scope: 'global' });
    }
  }

  const projectFile = projectPromptsReadFile(contextDir);
  const projectPrompts = projectFile ? readPromptsFile(projectFile) : null;
  if (Array.isArray(projectPrompts?.promptRules)) {
    for (const rule of projectPrompts.promptRules) {
      result.push({ rule, scope: 'project' });
    }
  }

  return result;
}

/** Get a single prompt by its unique name, or null when not found. */
export function getPrompt(name: string, contextDir?: string): LoadedPrompt | null {
  const prompts = loadPrompts(contextDir);
  return prompts[name] || null;
}

/** List all available prompt names (global + project, sorted). */
export function listPromptNames(contextDir?: string): string[] {
  return Object.keys(loadPrompts(contextDir)).sort();
}

/**
 * Validate a prompt entry's shape: exactly one of `body` | `bodyFile` must be set.
 */
export function validatePrompt(entry: PromptEntry): { valid: boolean; error?: string } {
  const hasBody = typeof entry.body === 'string';
  const hasBodyFile = typeof entry.bodyFile === 'string';
  if (hasBody && hasBodyFile) {
    return { valid: false, error: 'Prompt must set exactly one of "body" or "bodyFile", not both' };
  }
  if (!hasBody && !hasBodyFile) {
    return { valid: false, error: 'Prompt must set either "body" or "bodyFile"' };
  }
  return { valid: true };
}

/** Expand a leading `~` (or `~/`) to the user's home directory. */
function expandHome(p: string): string {
  if (p === '~') {
    return homedir();
  }
  if (p.startsWith('~/')) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

/**
 * Resolve a prompt's markdown body by name. Inline `body` is returned verbatim;
 * a `bodyFile` is read from disk. A relative `bodyFile` is anchored to the
 * directory of the `prompts.json` that declared it (so a committed project
 * prompts.json resolves portably regardless of invocation cwd); an absolute or
 * `~`-prefixed path is used as-is. Returns null when the name is unknown; throws
 * on an invalid entry or an unreadable `bodyFile`.
 */
export function resolvePromptBody(
  name: string,
  contextDir?: string
): { body: string; source: 'global' | 'project'; file: string } | null {
  const loaded = getPrompt(name, contextDir);
  if (!loaded) {
    return null;
  }

  const validation = validatePrompt(loaded.entry);
  if (!validation.valid) {
    throw new Error(`Prompt "${name}" is invalid: ${validation.error}`);
  }

  if (typeof loaded.entry.body === 'string') {
    return { body: loaded.entry.body, source: loaded.source, file: loaded.file };
  }

  // bodyFile path resolution (anchored to the declaring file's directory).
  const rawPath = loaded.entry.bodyFile as string;
  const expanded = expandHome(rawPath);
  const resolvedPath = isAbsolute(expanded) ? expanded : join(dirname(loaded.file), expanded);

  try {
    const body = readFileSync(resolvedPath, 'utf-8');
    return { body, source: loaded.source, file: loaded.file };
  } catch (error) {
    throw new Error(
      `Prompt "${name}" bodyFile could not be read (${resolvedPath}): ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/** Path to the global prompts file (whether or not it exists). */
export function getGlobalPromptsPath(): string {
  return globalPromptsFile();
}

/** Path to the discovered project prompts file, or null when no `.agent2linear/` is found. */
export function getProjectPromptsPath(contextDir?: string): string | null {
  return projectPromptsReadFile(contextDir);
}

/**
 * Which tier of the resolution ladder selected the prompt:
 *   `explicit` — a positional `[name]`.
 *   `location` — a location-specific override set `defaultPrompt` (path/repo/owner/host).
 *   `team`     — a `promptRule` matched the resolved team (Phase 3).
 *   `general`  — the top-level (or branch-only-override) `defaultPrompt`.
 */
export type PromptSelection = 'explicit' | 'location' | 'team' | 'general';

/** Team layer context recorded on a resolved prompt (for `prompt explain`, Phase 4). */
export interface PromptTeamContext {
  /** The raw team selector (`--team` or `defaultTeam`), before alias resolution. */
  input?: string;
  /** The resolved canonical team id used for matching. */
  resolved?: string;
  /** Whether `--team` was passed explicitly (drives the strict no-match error). */
  explicit: boolean;
}

export interface ResolvedPrompt {
  name: string;
  /** The scope the body came from. */
  source: 'global' | 'project';
  selection: PromptSelection;
  body: string;
  context: { contextDir: string; team?: PromptTeamContext };
}

export type ResolvePromptResult =
  | { ok: true; prompt: ResolvedPrompt }
  | { ok: false; error: string; hint?: string };

/**
 * Build the `OverrideContext` the team layer matches against. Reuses the SAME
 * effective-dir derivation `getConfig` uses plus `buildGitContext`/`resolveRepoRoot`
 * (like `config explain`), so the team layer and the location layer agree on the
 * directory. `team` is the resolved canonical id (or undefined).
 */
export function buildPromptOverrideContext(contextDir: string, team: string | undefined): OverrideContext {
  const git = buildGitContext(contextDir);
  const repoRoot = resolveRepoRoot(contextDir) ?? git.repoRoot;
  const remotes: Record<string, RemoteIdentity> = git.remotes;
  return { contextDir, repoRoot, branch: git.branch, remotes, team };
}

/**
 * Recursively canonicalize every `team` leaf in a promptRule `when` clause via
 * resolveAlias, so an alias and the raw `team_*` id compare equal EVERYWHERE —
 * including nested in `allOf`/`anyOf`/`not`. matchWhen supports `team` recursively
 * (under `allowTeam`) but compares against the already-resolved `ctx.team`, so a
 * nested alias left un-normalized would silently never match (M30 fix B).
 */
function normalizeTeamAliases(node: PromptWhen): PromptWhen {
  const out: PromptWhen = { ...node };
  if (typeof out.team === 'string') {
    out.team = resolveAlias('team', out.team);
  }
  if (Array.isArray(out.allOf)) {
    out.allOf = out.allOf.map((child) => normalizeTeamAliases(child as PromptWhen));
  }
  if (Array.isArray(out.anyOf)) {
    out.anyOf = out.anyOf.map((child) => normalizeTeamAliases(child as PromptWhen));
  }
  if (out.not !== undefined) {
    out.not = normalizeTeamAliases(out.not as PromptWhen);
  }
  return out;
}

/**
 * Resolve the winning team `promptRule` for the given context, or null when none
 * match. Reuses the team-aware `matchWhen` (with `allowTeam`) and the same
 * scope/specificity/declaration-order sort as `resolveOverrides`: rules are sorted
 * weakest → strongest and the LAST match wins (project beats global on a tie).
 * A malformed/unsupported rule is warn-skipped, never thrown (mirrors `resolveOverrides`).
 * Returns the whole `LoadedPromptRule` (not just the name) so `prompt explain` can
 * surface which rule matched, even when a higher tier ultimately wins.
 */
export function resolvePromptRules(ctx: OverrideContext, rules: LoadedPromptRule[]): LoadedPromptRule | null {
  const matched: Array<{ loaded: LoadedPromptRule; key: number[] }> = [];

  for (let i = 0; i < rules.length; i++) {
    const loaded = rules[i];
    const { rule, scope } = loaded;
    // PromptRule is NESTED (like a config `overrides[]` entry): a `when` clause plus
    // the `prompt` name. An absent `when` is a catch-all. Normalize EVERY `team` leaf
    // (top-level AND nested in allOf/anyOf/not) to a canonical id so an alias and the
    // raw `team_*` id compare equal everywhere matchWhen recurses.
    const when = normalizeTeamAliases({ ...(rule.when ?? {}) } as PromptWhen);
    let result: { matched: boolean; score: number[] };
    try {
      result = matchWhen(when as WhenClause, ctx, { allowTeam: true });
    } catch (error) {
      logger.warn(`Skipping promptRule #${i} (${scope}): ${(error as Error).message}`);
      continue;
    }
    if (!result.matched) {
      continue;
    }
    const scopeRank = scope === 'project' ? 1 : 0;
    matched.push({ loaded, key: [scopeRank, ...result.score] });
  }

  if (matched.length === 0) {
    return null;
  }
  // Stable sort weakest → strongest; the last element is the winner (ties → the
  // later/declared-last and project-scope rule, since global rules precede project).
  matched.sort((a, b) => compareKeys(a.key, b.key));
  return matched[matched.length - 1].loaded;
}

/** Load the named body and wrap it as a successful resolution at the given tier. */
function loadBodyAs(
  name: string,
  selection: PromptSelection,
  context: ResolvedPrompt['context'],
  contextDir?: string
): ResolvePromptResult {
  try {
    const resolved = resolvePromptBody(name, contextDir);
    if (!resolved) {
      return {
        ok: false,
        error:
          selection === 'explicit'
            ? `Prompt not found: ${name}`
            : `Configured prompt not found: ${name}`,
        // The remediation depends on WHERE the (now-missing) name came from: a name
        // selected by a promptRule (team tier) or an overrides[] defaultPrompt
        // (location tier) is fixed in prompts.json / the rule itself, NOT by
        // `config set defaultPrompt` — only the general/explicit tiers point there.
        hint:
          selection === 'explicit'
            ? 'Use "agent2linear prompt list" to see available prompts'
            : selection === 'team'
              ? 'Add the missing prompt to prompts.json, or update the matching promptRule'
              : selection === 'location'
                ? 'Add the missing prompt to prompts.json, or update the overrides[] defaultPrompt value'
                : 'Set a valid prompt with "agent2linear config set defaultPrompt <name>"',
      };
    }
    return {
      ok: true,
      prompt: { name, source: resolved.source, selection, body: resolved.body, context },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Resolve the prompt that applies for the given options/context (M1 ladder):
 *   1. explicit `name` → exact, highest-precedence lookup (unknown → error).
 *   1.5. forced team (`force` + an explicit `--team`): evaluate the team layer
 *      BEFORE the location step. A matching `promptRule` → team (outranks any
 *      location override). No match → hard error (exit 1), even when a location
 *      override or a general default would otherwise resolve. A no-op without an
 *      explicit `--team`.
 *   2. else `getConfig(dir)`: if `defaultPrompt` was set by a LOCATION-specific
 *      override (path/repo/owner/host) → location wins.
 *   3. else the team layer: `team = --team ?? config.defaultTeam`; a matching
 *      `promptRule` → team. If `--team` was explicit and nothing matched → error.
 *   4. else the general `defaultPrompt` (top-level OR a branch-only override).
 *   5. else error (nothing resolves).
 *
 * Resolution context is the canonical cwd unless `dir` (the `-C`/positional lever)
 * is supplied. Bodies are loaded via `resolvePromptBody`, so a `bodyFile` is
 * anchored to the declaring `prompts.json`'s directory.
 */
export function resolvePrompt(
  options: { name?: string; team?: string; explicitTeam?: boolean; force?: boolean },
  dir?: string
): ResolvePromptResult {
  const config = getConfig(dir);
  // Mirror getConfig's effective-dir computation so `context.contextDir` is the
  // directory the resolution actually used (explicit `dir` → invocation `-C` → cwd).
  const contextDir = canonicalizeDir(dir ?? getInvocationContext().contextDir ?? process.cwd());

  // 1. Explicit name → exact, highest-precedence lookup.
  if (options.name) {
    return loadBodyAs(options.name, 'explicit', { contextDir }, contextDir);
  }

  // Team layer inputs (hoisted: the forced branch below and the normal team step
  // both consume them). team = --team ?? defaultTeam.
  const teamInput = options.team ?? config.defaultTeam;
  const explicitTeam = options.explicitTeam ?? false;
  const force = options.force ?? false;
  const resolvedTeam = teamInput ? resolveAlias('team', teamInput) : undefined;
  const teamContext: PromptTeamContext = {
    input: teamInput,
    resolved: resolvedTeam,
    explicit: explicitTeam,
  };

  const matchTeamPrompt = (): string | null => {
    if (!resolvedTeam) {
      return null;
    }
    const overrideCtx = buildPromptOverrideContext(contextDir, resolvedTeam);
    return resolvePromptRules(overrideCtx, loadPromptRules(contextDir))?.rule.prompt ?? null;
  };

  // 1.5. Forced team (team-first): scoped to an EXPLICIT `--team`. A matching
  // promptRule OUTRANKS any location override; no match is a hard error even when a
  // location override or general default would otherwise resolve. Without an explicit
  // `--team`, `force` is a no-op (fall through to the normal ladder).
  if (force && explicitTeam) {
    const forcedPrompt = matchTeamPrompt();
    if (forcedPrompt) {
      return loadBodyAs(forcedPrompt, 'team', { contextDir, team: teamContext }, contextDir);
    }
    return {
      ok: false,
      error: `No prompt configured for team: ${options.team}`,
      hint: 'Add a promptRule with "when": { "team": "<id|alias>" } to prompts.json, or omit --force/--team',
    };
  }

  const defaultName = config.defaultPrompt;
  const defaultLocation = config.locations.defaultPrompt;

  // 2. Location-specific override outranks the team layer. `locationCarried` is set
  // by resolveOverrides from the WINNING match's score (the actual `anyOf` arm
  // maxSpec chose), so a branch-only match in a mixed `anyOf` override is NOT
  // treated as location-tier even though the clause also contains a path arm.
  if (
    defaultName &&
    defaultLocation.type === 'override' &&
    defaultLocation.locationCarried === true
  ) {
    return loadBodyAs(defaultName, 'location', { contextDir }, contextDir);
  }

  // 3. Team layer: team = --team ?? defaultTeam.
  const teamPrompt = matchTeamPrompt();
  if (teamPrompt) {
    return loadBodyAs(teamPrompt, 'team', { contextDir, team: teamContext }, contextDir);
  }

  // An explicit `--team` with no matching promptRule is a hard error (exit 1) —
  // distinct from the general fallback a DERIVED team falls through to.
  if (explicitTeam) {
    return {
      ok: false,
      error: `No prompt configured for team: ${options.team}`,
      hint: 'Add a promptRule with "when": { "team": "<id|alias>" } to prompts.json, or omit --team',
    };
  }

  // 4. General `defaultPrompt` (top-level OR a branch-only / catch-all override).
  if (defaultName) {
    return loadBodyAs(defaultName, 'general', { contextDir, team: teamContext }, contextDir);
  }

  // 5. Nothing resolved.
  return {
    ok: false,
    error: 'No prompt configured',
    hint: 'Set a default with "agent2linear config set defaultPrompt <name>" or pass a prompt name',
  };
}
