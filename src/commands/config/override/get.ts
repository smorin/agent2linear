/**
 * `config override get <selector>` (M31 Phase 1).
 *
 * Print one override rule in full (raw record) from the selected scope (default
 * `--global`). The selector is a label (matched against `rule.id`) or `#<index>`.
 * Label resolution is always WITHIN the selected scope (labels are unique per
 * scope, not globally). `--json` emits the single rule record as a bare object
 * (`{label,index,rule}`) — the single-fetch convention (`prompt get`,
 * `workspace current`); only `list` returns a JSON array.
 */

import { readConfigForScope } from '../../../lib/config.js';
import { showError } from '../../../lib/output.js';
import { getScopeInfo } from '../../../lib/scope.js';
import { redactRuleSecrets, resolveSelector, serializeRule } from './shared.js';

interface OverrideGetOptions {
  global?: boolean;
  project?: boolean;
  json?: boolean;
}

export function runOverrideGet(selector: string, options: OverrideGetOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);
    const rules = readConfigForScope(scope).overrides ?? [];
    const found = resolveSelector(rules, selector);
    if (!found) {
      throw new Error(`override rule "${selector}" not found in ${scopeLabel} config`);
    }

    if (options.json) {
      console.log(JSON.stringify(serializeRule(found.rule, found.index), null, 2));
      return;
    }

    // Human path also masks secret-named values (the resolver ignores them anyway).
    console.log(JSON.stringify(redactRuleSecrets(found.rule), null, 2));
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
