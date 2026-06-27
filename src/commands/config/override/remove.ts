/**
 * `config override remove <selector>` (alias `rm`) (M31 Phase 3).
 *
 * Delete one override rule, addressed by `<label>` or `#<index>` within the selected
 * scope (default `--global`). Splices the array and writes; `--json` emits the
 * removed rule record as a bare object (the single-fetch convention). No `--dry-run`
 * (deletion is a single explicit action).
 */

import { readConfigForScope, writeConfigForScope } from '../../../lib/config.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { getScopeInfo } from '../../../lib/scope.js';
import { resolveSelector, serializeRule } from './shared.js';

interface OverrideRemoveOptions {
  global?: boolean;
  project?: boolean;
  json?: boolean;
}

export function runOverrideRemove(selector: string, options: OverrideRemoveOptions = {}): void {
  try {
    const { scope, label: scopeLabel } = getScopeInfo(options);

    const cfg = readConfigForScope(scope);
    const rules = cfg.overrides ?? [];
    const found = resolveSelector(rules, selector);
    if (!found) {
      throw new Error(`override rule "${selector}" not found in ${scopeLabel} config`);
    }

    const record = serializeRule(found.rule, found.index);
    rules.splice(found.index, 1);
    cfg.overrides = rules;
    writeConfigForScope(scope, cfg);

    if (options.json) {
      console.log(JSON.stringify(record, null, 2));
      return;
    }

    showSuccess('Override rule removed!', { Label: String(record.label), Scope: scopeLabel });
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
