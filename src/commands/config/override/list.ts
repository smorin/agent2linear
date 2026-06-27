/**
 * `config override list` (M31 Phase 1).
 *
 * A context-INDEPENDENT inventory of every override rule (design Q6): identical
 * output regardless of cwd/branch (no git, no resolution). With no scope flag it
 * lists BOTH scopes, labeled by scope; with `--global`/`--project` it lists that
 * scope only. Rules print in scope→file (array) order — the rules' real on-disk
 * order, which is also M29's declaration-order tie-break. Each row carries a static
 * specificity tag (a hint, not a sort key).
 */

import { readConfigForScope } from '../../../lib/config.js';
import { formatListJSON } from '../../../lib/output.js';
import type { ConfigOverride } from '../../../lib/types.js';
import { redactRuleSecrets, ruleLabel, serializeRule, specificityTag } from './shared.js';

interface OverrideListOptions {
  global?: boolean;
  project?: boolean;
  json?: boolean;
}

type ListScope = 'global' | 'project';

/** Determine which scopes to list: a flag selects one; no flag ⇒ both. */
function scopesToList(options: OverrideListOptions): ListScope[] {
  if (options.project && !options.global) return ['project'];
  if (options.global && !options.project) return ['global'];
  return ['global', 'project'];
}

/** Whether a raw overrides[] entry is a usable rule object (hand-edited configs can hold junk). */
function isRuleObject(rule: unknown): rule is ConfigOverride {
  return rule !== null && typeof rule === 'object' && !Array.isArray(rule);
}

/** Compact one-line summary of the values a rule sets (secret-named values masked). */
function valueSummary(rule: ConfigOverride): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(redactRuleSecrets(rule))) {
    if (key === 'id' || key === 'when') continue;
    if (key === 'aliases') {
      parts.push('aliases');
      continue;
    }
    parts.push(`${key}=${String(value)}`);
  }
  return parts.length > 0 ? parts.join(', ') : '(none)';
}

export function runOverrideList(options: OverrideListOptions = {}): void {
  const scopes = scopesToList(options);

  if (options.json) {
    const records: Array<Record<string, unknown>> = [];
    for (const scope of scopes) {
      const rules = readConfigForScope(scope).overrides ?? [];
      rules.forEach((rule, index) => {
        if (!isRuleObject(rule)) return; // skip hand-edited junk rather than crash
        records.push({ scope, ...serializeRule(rule, index), tag: specificityTag(rule.when) });
      });
    }
    console.log(formatListJSON(records));
    return;
  }

  let any = false;
  for (const scope of scopes) {
    const rules = readConfigForScope(scope).overrides ?? [];
    console.log(`\n${scope} overrides:`);
    if (rules.length === 0) {
      console.log('  (none)');
      continue;
    }
    any = true;
    rules.forEach((rule, index) => {
      if (!isRuleObject(rule)) return; // skip hand-edited junk rather than crash
      const label = ruleLabel(rule.id, index);
      const tag = specificityTag(rule.when);
      console.log(`  ${label} [${tag}]`);
      console.log(`    when: ${JSON.stringify(rule.when)}`);
      console.log(`    sets: ${valueSummary(rule)}`);
    });
  }
  if (!any) {
    console.log('');
  }
}
