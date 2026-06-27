import { canonicalizeDir, getConfig, readGlobalConfig, readProjectConfig, resolveRepoRoot } from '../../lib/config.js';
import { buildGitContext, type RemoteIdentity } from '../../lib/git-context.js';
import { getInvocationContext } from '../../lib/invocation-context.js';
import { matchWhen, type OverrideContext } from '../../lib/overrides.js';
import type { ConfigLocation, ConfigOverride, ResolvedConfig, WhenClause } from '../../lib/types.js';
import { ruleLabel, specificityTag } from './override/shared.js';

/**
 * `config explain [dir]` (M29 §7): for a resolution-context directory, print each
 * resolved default, its value, and the winning rule per field. The rendering is
 * extracted into pure functions so it can be unit-tested without driving the CLI.
 *
 * M31 (4b, lite): additionally annotates EVERY rule in both scopes with ✓/✗ for the
 * context — match status driven by the resolver's own `matchWhen` (no drift) — plus
 * the fields each rule actually wins. `winsFields` is derived from the resolved
 * `locations` (the source of truth), so a rule that matches yet wins nothing
 * (out-specified, or a global rule suppressed by repo top-level config) is shown
 * truthfully without recomputing value resolution.
 */

/** Overridable defaults shown by `config explain`, in display order. */
const EXPLAIN_FIELDS = [
  'defaultTeam',
  'defaultInitiative',
  'defaultProject',
  'defaultIssueTemplate',
  'defaultProjectTemplate',
  'defaultMilestoneTemplate',
  'defaultPrompt',
  'defaultAutoAssignLead',
] as const;

export interface ExplainField {
  key: string;
  /** Raw resolved value (string | boolean | number | undefined); stringified only for text render (G). */
  value: unknown;
  location: ConfigLocation;
}

/**
 * One annotated override rule for the 4b all-rules `explain` view: its selector
 * `label`, scope, compact `when`, whether it MATCHES this context (`matched`, from
 * `matchWhen`), the static tier `tag`, and the resolved fields it actually WINS.
 */
export interface ExplainRule {
  label: string;
  scope: 'global' | 'project';
  ruleIndex: number;
  when: WhenClause;
  matched: boolean;
  tag: string;
  winsFields: string[];
}

export interface ExplainData {
  contextDir: string;
  repoRoot: string | null;
  branch?: string;
  remotes: Record<string, RemoteIdentity>;
  fields: ExplainField[];
  /** M31 (4b): every override rule (both scopes), annotated ✓/✗ for this context. */
  rules: ExplainRule[];
}

/**
 * The `config ov` selector that names a resolved override rule: its label (`ruleId`)
 * when present, else `#<ruleIndex>` (the addressing form for a legacy unlabeled rule).
 * Mirrors `serializeRule`'s `label` so explain's output is a valid `config ov` selector
 * (Q5). Falls back to `#?` only if neither is set (never happens via the resolver).
 */
export function overrideSelector(location: ConfigLocation): string {
  if (location.ruleId !== undefined) {
    return location.ruleId;
  }
  return location.ruleIndex !== undefined ? `#${location.ruleIndex}` : '#?';
}

/** Human-readable provenance label for a resolved field. */
export function sourceLabel(location: ConfigLocation): string {
  if (location.type === 'override') {
    const scopeLabel = location.scope === 'project' ? 'repo' : 'global';
    return `${scopeLabel} override ${overrideSelector(location)} (when ${JSON.stringify(location.when)})`;
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
  // M31 (4b): annotate every override rule for this context. The matching context is
  // the SAME data `getConfig`/`resolveOverrides` use (contextDir/repoRoot/branch/
  // remotes), so the ✓/✗ from `matchWhen` can never disagree with the resolution.
  const ctx: OverrideContext = { contextDir, repoRoot, branch: git.branch, remotes: git.remotes };
  // Coerce to an array — a hand-edited `"overrides": {}` (non-array) must not crash the
  // annotate `.map` below; each entry is then guarded individually in `annotateRules`.
  const toRuleArray = (raw: unknown): ConfigOverride[] => (Array.isArray(raw) ? (raw as ConfigOverride[]) : []);
  const globalRules = toRuleArray(readGlobalConfig().overrides);
  const projectRules = toRuleArray(readProjectConfig(contextDir).overrides);
  const rules: ExplainRule[] = [
    ...annotateRules('global', globalRules, ctx, fields),
    ...annotateRules('project', projectRules, ctx, fields),
  ];
  return { contextDir, repoRoot, branch: git.branch, remotes: git.remotes, fields, rules };
}

/**
 * Annotate one scope's rules: ✓/✗ from `matchWhen` (warn-skip a throwing rule as ✗,
 * mirroring `resolveOverrides`), the static tier `tag`, and the fields the rule
 * actually wins — derived from the resolved `fields` provenance (scope + ruleIndex),
 * NOT recomputed, so it agrees with reality (incl. out-specified / suppressed rules).
 */
function annotateRules(
  scope: 'global' | 'project',
  rules: ConfigOverride[],
  ctx: OverrideContext,
  fields: ExplainField[]
): ExplainRule[] {
  return rules.map((rule, ruleIndex) => {
    // A hand-edited entry can be null / non-object; render it ✗ (catch-all) rather than
    // dereference `.when`/`.id` (mirrors resolveOverrides' warn-skip; indices preserved).
    const r = rule as unknown;
    const safe = r !== null && typeof r === 'object' && !Array.isArray(r);
    const when = (safe ? (rule.when ?? {}) : {}) as WhenClause;
    let matched = false;
    if (safe) {
      try {
        matched = matchWhen(when, ctx).matched;
      } catch {
        // A rule with an unsupported key / invalid glob never matches (the resolver
        // warn-skips it); render it ✗ rather than crashing explain.
        matched = false;
      }
    }
    const winsFields = fields
      .filter(
        (f) => f.location.type === 'override' && f.location.scope === scope && f.location.ruleIndex === ruleIndex
      )
      .map((f) => f.key);
    return {
      label: ruleLabel(safe ? rule.id : undefined, ruleIndex),
      scope,
      ruleIndex,
      when,
      matched,
      tag: specificityTag(when),
      winsFields,
    };
  });
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
    // Note guards the RESOLVED block (no field came from an override) — which is NOT the
    // same as "no rule matched": a rule can match (✓ in the `rules:` section below) yet
    // win no field (out-specified, or a global rule suppressed by repo top-level config).
    // Word it by VALUE so it never contradicts a ✓ rule in the section that follows.
    lines.push('(no override rule supplied a value for this context)');
  }
  // M31 (4b, lite): the all-rules annotated section. ✓/✗ is `matchWhen` (no drift);
  // each rule echoes its compact `when` beside the `context:` block above so a ✗
  // mismatch is self-evident — no per-facet prose reason (deferred).
  lines.push('rules:');
  if (data.rules.length === 0) {
    lines.push('  (none)');
  } else {
    for (const rule of data.rules) {
      const mark = rule.matched ? '✓' : '✗';
      const scopeLabel = rule.scope === 'project' ? 'repo' : 'global';
      const wins = rule.winsFields.length > 0 ? `  wins ${rule.winsFields.join(',')}` : '';
      lines.push(
        `  ${mark} ${rule.label} [${scopeLabel}/${rule.tag}] when ${JSON.stringify(rule.when)}${wins}`
      );
    }
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
            ? {
                scope: field.location.scope,
                ruleIndex: field.location.ruleIndex,
                when: field.location.when,
                // M31: the winning rule's label as a `config ov` selector (Q5).
                ...(field.location.ruleId !== undefined ? { ruleId: field.location.ruleId } : {}),
              }
            : {}),
        },
      ])
    ),
    // M31 (4b): every override rule (both scopes), annotated ✓/✗ for this context.
    rules: data.rules.map((rule) => ({
      label: rule.label,
      scope: rule.scope,
      ruleIndex: rule.ruleIndex,
      when: rule.when,
      matched: rule.matched,
      tag: rule.tag,
      winsFields: rule.winsFields,
    })),
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
