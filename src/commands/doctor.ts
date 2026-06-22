import { existsSync } from 'fs';

import { getAliasesForType } from '../lib/aliases.js';
import { getApiKey,getConfig, getProjectConfigPath, readProjectConfig } from '../lib/config.js';
import { getEntityCache } from '../lib/entity-cache.js';
import { isTrackedByGit } from '../lib/git-remote.js';
import { getCurrentUser,testConnection } from '../lib/linear-client.js';
import type { AliasEntityType } from '../lib/types.js';
import { resolveActiveWorkspace } from '../lib/workspace-resolver.js';
import { getGlobalWorkspacesPath, getProjectWorkspacesPath } from '../lib/workspaces.js';

/**
 * Run diagnostic checks on the agent2linear environment
 */
export async function doctorCommand() {
  console.log('\n🩺 agent2linear Doctor\n');

  let passed = 0;
  let failed = 0;

  // 1. API Key check. getApiKey() THROWS when resolution is denied (exclusion /
  // no-match policy / ambiguity guard); treat that as "no key configured" so
  // doctor still runs and reports the denial in the Active-workspace section below.
  let apiKey: string | undefined;
  try {
    apiKey = getApiKey();
  } catch {
    apiKey = undefined;
  }
  if (apiKey) {
    console.log('  ✓ API key configured');
    passed++;
  } else {
    console.log('  ✗ API key not configured');
    console.log('    Run: agent2linear config set apiKey <your-key>');
    console.log('    Or set LINEAR_API_KEY environment variable');
    failed++;
  }

  // 2. API connectivity
  if (apiKey) {
    const result = await testConnection();
    if (result.success) {
      const user = await getCurrentUser();
      console.log(`  ✓ API connection OK (${user.name})`);
      passed++;
    } else {
      console.log(`  ✗ API connection failed: ${result.error}`);
      failed++;
    }
  } else {
    console.log('  ✗ API connection (skipped - no API key)');
    failed++;
  }

  // 3. Configuration
  const config = getConfig();
  console.log();
  console.log('Configuration:');

  if (config.defaultTeam) {
    console.log(`  ✓ Default team: ${config.defaultTeam}`);
    passed++;
  } else {
    console.log('  - Default team: not set');
  }

  if (config.defaultInitiative) {
    console.log(`  ✓ Default initiative: ${config.defaultInitiative}`);
    passed++;
  } else {
    console.log('  - Default initiative: not set');
  }

  if (config.defaultProject) {
    console.log(`  ✓ Default project: ${config.defaultProject}`);
  } else {
    console.log('  - Default project: not set');
  }

  // 3b. Active workspace + resolution source (M28)
  console.log();
  console.log('Active workspace:');
  const resolution = resolveActiveWorkspace();
  if (resolution.denied) {
    console.log(`  ⚠️  No workspace resolved: ${resolution.denied.reason}`);
  } else {
    const activeName =
      resolution.name ?? (resolution.source === 'flag' ? '(ad-hoc)' : '(default/legacy)');
    console.log(`  ${activeName} · source: ${resolution.source}`);
  }

  // 3c. Secrets hygiene (R6): never let a key get committed
  console.log();
  console.log('Secrets hygiene:');
  let hygieneOk = true;
  for (const secretsFile of [getGlobalWorkspacesPath(), getProjectWorkspacesPath()]) {
    if (existsSync(secretsFile) && isTrackedByGit(secretsFile)) {
      console.log(`  ⚠️  Secrets file is tracked by git: ${secretsFile}`);
      hygieneOk = false;
    }
  }
  if (readProjectConfig().apiKey) {
    console.log(`  ⚠️  Raw apiKey in project config: ${getProjectConfigPath()}`);
    console.log('     Move it out: agent2linear workspace add <name> --api-key -');
    hygieneOk = false;
  }
  if (hygieneOk) {
    console.log('  ✓ No secrets-hygiene issues detected');
  } else {
    // A committed/committable key is a real failure — don't let the summary
    // below report "All checks passed" while a secret is exposed.
    failed++;
  }

  // 4. Cache
  console.log();
  console.log('Cache:');
  const cache = getEntityCache();
  const stats = cache.getStats();
  const cacheEnabled = config.enableEntityCache !== false;
  console.log(`  ${cacheEnabled ? '✓' : '✗'} Entity cache: ${cacheEnabled ? 'enabled' : 'disabled'}`);
  console.log(`  TTL: ${config.entityCacheMinTTL || config.projectCacheMinTTL || 60} minutes`);
  console.log(`  Teams cached: ${stats.teams.count}, Initiatives: ${stats.initiatives.count}, Members: ${stats.members.count}`);

  // 5. Aliases
  console.log();
  console.log('Aliases:');
  const aliasTypes: AliasEntityType[] = [
    'team', 'initiative', 'project', 'member', 'workflow-state',
    'issue-label', 'project-label', 'project-status', 'cycle',
  ];
  let totalAliases = 0;
  for (const type of aliasTypes) {
    const count = getAliasesForType(type).length;
    totalAliases += count;
    if (count > 0) {
      console.log(`  ${type}: ${count}`);
    }
  }
  console.log(`  Total: ${totalAliases} aliases`);

  // Summary
  console.log();
  if (failed === 0) {
    console.log(`✅ All checks passed (${passed} passed)`);
  } else {
    console.log(`⚠️  ${passed} passed, ${failed} failed`);
  }
  console.log();
}
