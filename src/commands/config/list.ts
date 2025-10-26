import {
  getConfig,
  getGlobalConfigPath,
  getProjectConfigPath,
  hasGlobalConfig,
  hasProjectConfig,
  maskApiKey,
} from '../../lib/config.js';
import {
  validateInitiativeExists,
  validateTeamExists,
  getTemplateById,
} from '../../lib/linear-client.js';
import { getMilestoneTemplate } from '../../lib/milestone-templates.js';

export async function listConfig() {
  const config = getConfig();

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
    const sourceLabel =
      source.type === 'env'
        ? 'environment variable'
        : source.type === 'project'
          ? 'project config'
          : 'global config';
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
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';

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
    console.log('  💡 Use "linear-create initiatives list" to select one');
  }
  console.log();

  // Show Default Team
  console.log('Default Team:');
  if (config.defaultTeam) {
    const source = config.locations.defaultTeam;
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';

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
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';

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
    console.log('  💡 Use "linear-create templates list issues" to browse');
  }
  console.log();

  // Show Default Project Template
  console.log('Default Project Template:');
  if (config.defaultProjectTemplate) {
    const source = config.locations.defaultProjectTemplate;
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';

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
    console.log('  💡 Use "linear-create templates list projects" to browse');
  }
  console.log();

  // Show Default Milestone Template
  console.log('Default Milestone Template:');
  if (config.defaultMilestoneTemplate) {
    const source = config.locations.defaultMilestoneTemplate;
    const sourceLabel = source.type === 'project' ? 'project config' : 'global config';

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
    console.log('  💡 Use "linear-create milestone-templates list" to browse');
  }
  console.log();
}
