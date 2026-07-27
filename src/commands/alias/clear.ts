import * as readline from 'readline';

import { clearAliases,normalizeEntityType } from '../../lib/aliases.js';
import { requireInteractiveInput } from '../../lib/interaction-policy.js';
import { showError, showInfo,showSuccess } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';

interface ClearAliasOptions {
  global?: boolean;
  project?: boolean;
  yes?: boolean;
  dryRun?: boolean;
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function clearAliasCommand(
  type: string,
  options: ClearAliasOptions = {}
) {
  // Normalize the type
  const normalizedType = normalizeEntityType(type);
  if (!normalizedType) {
    showError(`Invalid entity type: "${type}"`, 'Valid types: initiative, team, project, project-status, issue-template, project-template, member, user, issue-label, project-label, workflow-state');
    process.exit(1);
  }

  // Determine scope
  const { scope, label: scopeLabel } = getScopeInfo(options);

  // Preview mode
  if (options.dryRun) {
    console.log(`🔍 Previewing aliases to clear for ${normalizedType} (${scopeLabel})...\n`);

    const result = clearAliases(normalizedType, scope, { preview: true });

    if (!result.success) {
      showError(result.error ?? 'Unknown error');
      process.exit(1);
    }

    if (result.count === 0) {
      showInfo(`No ${normalizedType} aliases found in ${scopeLabel} config`);
    } else {
      console.log(`Would clear ${result.count} ${normalizedType} alias(es) from ${scopeLabel} config:\n`);
      if (result.aliases) {
        result.aliases.forEach((alias) => {
          console.log(`  - ${alias}`);
        });
      }
      console.log('');
      showInfo('Use without --dry-run to actually clear these aliases');
    }
    return;
  }

  // Get count for confirmation
  const previewResult = clearAliases(normalizedType, scope, { preview: true });

  if (!previewResult.success) {
    showError(previewResult.error ?? 'Unknown error');
    process.exit(1);
  }

  if (previewResult.count === 0) {
    showInfo(`No ${normalizedType} aliases found in ${scopeLabel} config`);
    return;
  }

  // Require confirmation unless explicit consent is supplied.
  if (!options.yes) {
    requireInteractiveInput('alias clear');
    console.log(`⚠️  About to clear ${previewResult.count} ${normalizedType} alias(es) from ${scopeLabel} config:\n`);
    if (previewResult.aliases) {
      previewResult.aliases.forEach((alias) => {
        console.log(`  - ${alias}`);
      });
    }
    console.log('');

    const confirmed = await confirm(`Are you sure you want to clear all ${normalizedType} aliases from ${scopeLabel} config?`);

    if (!confirmed) {
      console.log('\n❌ Clear operation cancelled\n');
      process.exit(0);
    }
  }

  // Perform the clear
  console.log(`\n🗑️  Clearing ${normalizedType} aliases from ${scopeLabel} config...`);

  try {
    const result = clearAliases(normalizedType, scope);

    if (!result.success) {
      showError(result.error ?? 'Unknown error');
      process.exit(1);
    }

    const details: Record<string, string> = {
      'Entity Type': normalizedType,
      'Aliases Cleared': String(result.count),
      'Scope': scopeLabel,
    };

    showSuccess('Aliases cleared successfully!', details);

    if (result.count > 0) {
      showInfo('Use "agent2linear alias list" to view remaining aliases');
    }
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
