import { canonicalizeDir, getConfig, resolveRepoRoot } from '../../lib/config.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import type { ConfigLocation, ResolvedConfig } from '../../lib/types.js';

/**
 * `config explain [dir]` (M29 §7): for a resolution-context directory, print each
 * resolved default, its value, and the winning rule per field. The rendering is
 * extracted into pure functions so it can be unit-tested without driving the CLI.
 */

/** Overridable defaults shown by `config explain`, in display order. */
const EXPLAIN_FIELDS = [
  'defaultTeam',
  'defaultInitiative',
  'defaultProject',
  'defaultIssueTemplate',
  'defaultProjectTemplate',
  'defaultMilestoneTemplate',
  'defaultAutoAssignLead',
] as const;

export interface ExplainField {
  key: string;
  value: string | undefined;
  location: ConfigLocation;
}

export interface ExplainData {
  contextDir: string;
  repoRoot: string | null;
  fields: ExplainField[];
}

/** Human-readable provenance label for a resolved field. */
export function sourceLabel(location: ConfigLocation): string {
  if (location.type === 'override') {
    const scopeLabel = location.scope === 'project' ? 'repo' : 'global';
    return `${scopeLabel} override  when${JSON.stringify(location.when)}`;
  }
  if (location.type === 'project') {
    return 'repo config';
  }
  if (location.type === 'profile') {
    return 'profile';
  }
  if (location.type === 'global') {
    return 'global config';
  }
  if (location.type === 'env') {
    return 'environment';
  }
  return 'unset';
}

/**
 * Build the explain model for a context dir. A missing / repo-less dir yields
 * catch-all/global values only (no crash) — the §9 query behavior.
 */
export function buildExplainData(dir?: string): ExplainData {
  const contextDir = canonicalizeDir(dir ?? getInvocationContext().contextDir ?? process.cwd());
  const repoRoot = resolveRepoRoot(contextDir);
  const config = getConfig(dir);
  const fields: ExplainField[] = EXPLAIN_FIELDS.map((key) => {
    const value = config[key as keyof ResolvedConfig];
    return {
      key,
      value: value === undefined ? undefined : String(value),
      location: config.locations[key],
    };
  });
  return { contextDir, repoRoot, fields };
}

/** Render the explain model as human-readable text. */
export function renderExplainText(data: ExplainData): string {
  const lines: string[] = [
    'context:',
    `  contextDir  ${data.contextDir}`,
    `  repoRoot    ${data.repoRoot ?? '(none)'}`,
    'resolved:',
  ];
  for (const field of data.fields) {
    lines.push(`  ${field.key.padEnd(24)} ${(field.value ?? '(not set)').padEnd(16)} ← ${sourceLabel(field.location)}`);
  }
  if (!data.fields.some((f) => f.location.type === 'override')) {
    lines.push('(no override rules matched this context)');
  }
  return lines.join('\n');
}

/** Render the explain model as a machine-readable object (for `--json`). */
export function buildExplainJson(data: ExplainData): Record<string, unknown> {
  return {
    contextDir: data.contextDir,
    repoRoot: data.repoRoot,
    resolved: Object.fromEntries(
      data.fields.map((field) => [
        field.key,
        {
          value: field.value ?? null,
          source: field.location.type,
          ...(field.location.type === 'override'
            ? { scope: field.location.scope, ruleIndex: field.location.ruleIndex, when: field.location.when }
            : {}),
        },
      ])
    ),
  };
}

/** Command action for `config explain [dir]`. */
export async function explainConfig(dir: string | undefined, options: { json?: boolean }): Promise<void> {
  const data = buildExplainData(dir);
  if (options.json) {
    console.log(JSON.stringify(buildExplainJson(data), null, 2));
  } else {
    console.log(renderExplainText(data));
  }
}
