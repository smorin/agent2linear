import { canonicalizeDir, getConfig, resolveRepoRoot } from '../../lib/config.js';
import { buildGitContext, type RemoteIdentity } from '../../lib/git-context.js';
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
  /** Raw resolved value (string | boolean | number | undefined); stringified only for text render (G). */
  value: unknown;
  location: ConfigLocation;
}

export interface ExplainData {
  contextDir: string;
  repoRoot: string | null;
  branch?: string;
  remotes: Record<string, RemoteIdentity>;
  fields: ExplainField[];
}

/** Human-readable provenance label for a resolved field. */
export function sourceLabel(location: ConfigLocation): string {
  if (location.type === 'override') {
    const scopeLabel = location.scope === 'project' ? 'repo' : 'global';
    return `${scopeLabel} override (when ${JSON.stringify(location.when)})`;
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
  const git = buildGitContext(contextDir);
  const repoRoot = resolveRepoRoot(contextDir) ?? git.repoRoot;
  const config = getConfig(dir);
  const fields: ExplainField[] = EXPLAIN_FIELDS.map((key) => {
    return {
      key,
      // Keep the raw value so `--json` preserves booleans/numbers (G); the text
      // renderer stringifies for display.
      value: config[key as keyof ResolvedConfig],
      location: config.locations[key],
    };
  });
  return { contextDir, repoRoot, branch: git.branch, remotes: git.remotes, fields };
}

/** Render the explain model as human-readable text. */
export function renderExplainText(data: ExplainData): string {
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
  lines.push(`  branch      ${data.branch ?? '(none)'}`, 'resolved:');
  for (const field of data.fields) {
    const shown = field.value === undefined ? '(not set)' : String(field.value);
    lines.push(`  ${field.key.padEnd(24)} ${shown.padEnd(16)} ← ${sourceLabel(field.location)}`);
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
    branch: data.branch ?? null,
    remotes: data.remotes,
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
