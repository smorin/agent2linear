import {
  getConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
  hasGlobalConfig,
  hasProjectConfig,
  maskApiKey,
} from '../../lib/config.js';
import {
  getTemplateById,
  validateInitiativeExists,
  validateTeamExists,
} from '../../lib/linear-client.js';
import { getMilestoneTemplate } from '../../lib/milestone-templates.js';
import { getPrompt } from '../../lib/prompts.js';
import type { ConfigLocation } from '../../lib/types.js';
import { resolveActiveProfile } from '../../lib/workspace-resolver.js';

/** Human-readable source label for a resolved config value (incl. profile name). */
function sourceLabelFor(source: ConfigLocation, profileName: string | undefined): string {
  switch (source.type) {
    case 'env':
      return 'environment variable';
    case 'override': {
      // M29: which override rule supplied the value (scope + the `when` clause). M31:
      // also name the winning rule by its label (`ruleId`), else `#<ruleIndex>`.
      const selector = source.ruleId ?? (source.ruleIndex !== undefined ? `#${source.ruleIndex}` : undefined);
      const scopeWord = source.scope === 'project' ? 'repo' : 'global';
      const selectorPart = selector ? ` ${selector}` : '';
      return `${scopeWord} override${selectorPart} (when ${JSON.stringify(source.when)})`;
    }
    case 'project':
      return 'project config';
    case 'profile':
      return profileName ? `profile '${profileName}'` : 'profile';
    default:
      return 'global config';
  }
}

export async function listConfig() {
  const config = getConfig();
  const activeProfile = resolveActiveProfile();

  console.log('\n📋 Linear Create Configuration\n');

  // Show config file paths
  console.log('Configuration Files:');
  console.log(
    `  Global:  ${getGlobalConfigPath()} ${hasGlobalConfig() ? '✓' : '(not found)'}`
  );
  console.log(
    `  Project: ${getProjectConfigPath()} ${hasProjectConfig() ? '✓' : '(not found)'}`
  );
  console.log();

  // Show API Key
  console.log('API Key:');
  if (config.apiKey) {
    const source = config.locations.apiKey;
    const sourceLabel = sourceLabelFor(source, activeProfile);
    console.log(`  ${maskApiKey(config.apiKey)} (from ${sourceLabel})`);
  } else {
    console.log('  Not configured');
    console.log('  💡 Set LINEAR_API_KEY environment variable or add to config file');
  }
  console.log();

  // Show Default Initiative
  console.log('Default Initiative:');
  if (config.defaultInitiative) {
    const source = config.locations.defaultInitiative;
    const sourceLabel = sourceLabelFor(source, activeProfile);

    // Fetch initiative name with validation
    let displayValue = config.defaultInitiative;
    if (config.apiKey) {
      try {
        const result = await validateInitiativeExists(config.defaultInitiative);
        if (result.valid && result.name) {
          displayValue = `${result.name} (${config.defaultInitiative})`;
        } else {
          displayValue = `${config.defaultInitiative} (not found)`;
        }
      } catch (error) {
        // If validation fails, mark as invalid
        displayValue = `${config.defaultInitiative} (invalid ID)`;
      }
    } else {
      // Can't validate without API key
      displayValue = `${config.defaultInitiative} (cannot validate - API key not configured)`;
    }

    console.log(`  ${displayValue} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
    console.log('  💡 Use "agent2linear initiatives list" to select one');
  }
  console.log();

  // Show Default Team
  console.log('Default Team:');
  if (config.defaultTeam) {
    const source = config.locations.defaultTeam;
    const sourceLabel = sourceLabelFor(source, activeProfile);

    // Fetch team name with validation
    let displayValue = config.defaultTeam;
    if (config.apiKey) {
      try {
        const result = await validateTeamExists(config.defaultTeam);
        if (result.valid && result.name) {
          displayValue = `${result.name} (${config.defaultTeam})`;
        } else {
          displayValue = `${config.defaultTeam} (not found)`;
        }
      } catch (error) {
        // If validation fails, mark as invalid
        displayValue = `${config.defaultTeam} (invalid ID)`;
      }
    } else {
      // Can't validate without API key
      displayValue = `${config.defaultTeam} (cannot validate - API key not configured)`;
    }

    console.log(`  ${displayValue} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
  }
  console.log();

  // Show Default Issue Template
  console.log('Default Issue Template:');
  if (config.defaultIssueTemplate) {
    const source = config.locations.defaultIssueTemplate;
    const sourceLabel = sourceLabelFor(source, activeProfile);

    // Fetch template name with validation
    let displayValue = config.defaultIssueTemplate;
    if (config.apiKey) {
      try {
        const template = await getTemplateById(config.defaultIssueTemplate);
        if (template) {
          displayValue = `${template.name} (${config.defaultIssueTemplate})`;
        } else {
          displayValue = `${config.defaultIssueTemplate} (not found)`;
        }
      } catch (error) {
        // If validation fails, mark as invalid
        displayValue = `${config.defaultIssueTemplate} (invalid ID)`;
      }
    } else {
      // Can't validate without API key
      displayValue = `${config.defaultIssueTemplate} (cannot validate - API key not configured)`;
    }

    console.log(`  ${displayValue} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
    console.log('  💡 Use "agent2linear templates list issues" to browse');
  }
  console.log();

  // Show Default Project Template
  console.log('Default Project Template:');
  if (config.defaultProjectTemplate) {
    const source = config.locations.defaultProjectTemplate;
    const sourceLabel = sourceLabelFor(source, activeProfile);

    // Fetch template name with validation
    let displayValue = config.defaultProjectTemplate;
    if (config.apiKey) {
      try {
        const template = await getTemplateById(config.defaultProjectTemplate);
        if (template) {
          displayValue = `${template.name} (${config.defaultProjectTemplate})`;
        } else {
          displayValue = `${config.defaultProjectTemplate} (not found)`;
        }
      } catch (error) {
        // If validation fails, mark as invalid
        displayValue = `${config.defaultProjectTemplate} (invalid ID)`;
      }
    } else {
      // Can't validate without API key
      displayValue = `${config.defaultProjectTemplate} (cannot validate - API key not configured)`;
    }

    console.log(`  ${displayValue} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
    console.log('  💡 Use "agent2linear templates list projects" to browse');
  }
  console.log();

  // Show Default Milestone Template
  console.log('Default Milestone Template:');
  if (config.defaultMilestoneTemplate) {
    const source = config.locations.defaultMilestoneTemplate;
    const sourceLabel = sourceLabelFor(source, activeProfile);

    // Fetch milestone template with validation
    let displayValue = config.defaultMilestoneTemplate;
    try {
      const result = getMilestoneTemplate(config.defaultMilestoneTemplate);
      if (result) {
        const templateName = result.template.name || config.defaultMilestoneTemplate;
        displayValue = `${templateName} (${config.defaultMilestoneTemplate}, ${result.source})`;
      } else {
        displayValue = `${config.defaultMilestoneTemplate} (not found)`;
      }
    } catch (error) {
      // If validation fails, mark as invalid
      displayValue = `${config.defaultMilestoneTemplate} (invalid template)`;
    }

    console.log(`  ${displayValue} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
    console.log('  💡 Use "agent2linear milestone-templates list" to browse');
  }
  console.log();

  // Show Default Prompt (M30) — a local prompt name; no API call needed.
  console.log('Default Prompt:');
  if (config.defaultPrompt) {
    const source = config.locations.defaultPrompt;
    const sourceLabel = sourceLabelFor(source, activeProfile);

    let displayValue = config.defaultPrompt;
    try {
      const result = getPrompt(config.defaultPrompt);
      if (result) {
        displayValue = `${config.defaultPrompt} (${result.source})`;
      } else {
        displayValue = `${config.defaultPrompt} (not found)`;
      }
    } catch (error) {
      displayValue = `${config.defaultPrompt} (invalid prompt)`;
    }

    console.log(`  ${displayValue} (from ${sourceLabel})`);
  } else {
    console.log('  Not set');
    console.log('  💡 Use "agent2linear prompt list" to browse');
  }
  console.log();
}
