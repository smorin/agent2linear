import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { dirname, isAbsolute, join } from 'path';

import { canonicalizeDir, getConfig } from './config.js';
import { getInvocationContext } from './invocation-context.js';
import type { PromptEntry, Prompts } from './types.js';
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

function projectPromptsReadFile(): string | null {
  const dir = findProjectConfigDir();
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
 */
export function loadPrompts(): { [name: string]: LoadedPrompt } {
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
  const projectFile = projectPromptsReadFile();
  const projectPrompts = projectFile ? readPromptsFile(projectFile) : null;
  if (projectFile && projectPrompts?.prompts) {
    for (const [name, entry] of Object.entries(projectPrompts.prompts)) {
      result[name] = { entry, source: 'project', file: projectFile };
    }
  }

  return result;
}

/** Get a single prompt by its unique name, or null when not found. */
export function getPrompt(name: string): LoadedPrompt | null {
  const prompts = loadPrompts();
  return prompts[name] || null;
}

/** List all available prompt names (global + project, sorted). */
export function listPromptNames(): string[] {
  return Object.keys(loadPrompts()).sort();
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
  name: string
): { body: string; source: 'global' | 'project'; file: string } | null {
  const loaded = getPrompt(name);
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
export function getProjectPromptsPath(): string | null {
  return projectPromptsReadFile();
}

/**
 * Which tier of the resolution ladder selected the prompt. Phase 1 emits only
 * `explicit` (a positional name) or `general` (the top-level `defaultPrompt`);
 * `location`/`team` are added in later phases.
 */
export type PromptSelection = 'explicit' | 'general';

export interface ResolvedPrompt {
  name: string;
  /** The scope the body came from. */
  source: 'global' | 'project';
  selection: PromptSelection;
  body: string;
  context: { contextDir: string };
}

export type ResolvePromptResult =
  | { ok: true; prompt: ResolvedPrompt }
  | { ok: false; error: string; hint?: string };

/**
 * Resolve the prompt that applies for the given options/context (Phase 1 ladder):
 *   1. explicit `name` → exact lookup (unknown name → error).
 *   2. else the general `defaultPrompt` (top-level config value) → load its body.
 *   3. else error (nothing resolves).
 *
 * Resolution context is the canonical cwd unless `dir` (the `-C`/positional lever)
 * is supplied. The body is loaded via `resolvePromptBody`, so a `bodyFile` is
 * anchored to the declaring `prompts.json`'s directory.
 */
export function resolvePrompt(
  options: { name?: string },
  dir?: string
): ResolvePromptResult {
  const config = getConfig(dir);
  // Mirror getConfig's effective-dir computation so `context.contextDir` is the
  // directory the resolution actually used (explicit `dir` → invocation `-C` → cwd).
  const contextDir = canonicalizeDir(dir ?? getInvocationContext().contextDir ?? process.cwd());

  // 1. Explicit name → exact, highest-precedence lookup.
  if (options.name) {
    try {
      const resolved = resolvePromptBody(options.name);
      if (!resolved) {
        return {
          ok: false,
          error: `Prompt not found: ${options.name}`,
          hint: 'Use "agent2linear prompt list" to see available prompts',
        };
      }
      return {
        ok: true,
        prompt: {
          name: options.name,
          source: resolved.source,
          selection: 'explicit',
          body: resolved.body,
          context: { contextDir },
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // 2. General `defaultPrompt` (top-level OR override-resolved config value).
  const defaultName = config.defaultPrompt;
  if (defaultName) {
    try {
      const resolved = resolvePromptBody(defaultName);
      if (!resolved) {
        return {
          ok: false,
          error: `Configured defaultPrompt not found: ${defaultName}`,
          hint: 'Set a valid prompt with "agent2linear config set defaultPrompt <name>"',
        };
      }
      return {
        ok: true,
        prompt: {
          name: defaultName,
          source: resolved.source,
          selection: 'general',
          body: resolved.body,
          context: { contextDir },
        },
      };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // 3. Nothing resolved.
  return {
    ok: false,
    error: 'No prompt configured',
    hint: 'Set a default with "agent2linear config set defaultPrompt <name>" or pass a prompt name',
  };
}
