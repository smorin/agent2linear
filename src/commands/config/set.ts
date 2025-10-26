import { isValidConfigKey, setConfigValue, type ConfigKey } from '../../lib/config.js';
import {
  validateApiKey,
  validateInitiativeExists,
  validateTeamExists,
  getTemplateById,
} from '../../lib/linear-client.js';
import { getMilestoneTemplate } from '../../lib/milestone-templates.js';
import { showValidated, showSuccess, showError } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';

interface SetConfigOptions {
  global?: boolean;
  project?: boolean;
}

export async function setConfig(key: string, value: string, options: SetConfigOptions) {
  // Validate key
  if (!isValidConfigKey(key)) {
    showError(
      `Invalid configuration key: ${key}`,
      'Valid keys are: apiKey, defaultInitiative, defaultTeam, defaultIssueTemplate, defaultProjectTemplate'
    );
    process.exit(1);
  }

  // Determine scope (default to global)
  const { scope, label: scopeLabel } = getScopeInfo(options);

  // Validate value based on key type
  console.log(`🔍 Validating ${key}...`);

  try {
    if (key === 'apiKey') {
      // Validate API key format
      if (!value.startsWith('lin_api_')) {
        showError('Invalid API key format. API keys should start with "lin_api_"');
        process.exit(1);
      }

      // Validate API key by testing connection
      console.log('   Testing API connection...');
      const isValid = await validateApiKey(value);
      if (!isValid) {
        showError('API key validation failed. The key is invalid or cannot connect to Linear.');
        process.exit(1);
      }
      console.log('   ✓ API key is valid');
    } else if (key === 'defaultInitiative') {
      // Validate initiative exists
      const result = await validateInitiativeExists(value);
      if (!result.valid) {
        showError(result.error ?? 'Initiative validation failed');
        process.exit(1);
      }
      showValidated('initiative', result.name ?? 'Unknown');
    } else if (key === 'defaultTeam') {
      // Validate team exists
      const result = await validateTeamExists(value);
      if (!result.valid) {
        showError(result.error ?? 'Team validation failed');
        process.exit(1);
      }
      showValidated('team', result.name ?? 'Unknown');
    } else if (key === 'defaultIssueTemplate' || key === 'defaultProjectTemplate') {
      // Validate template exists
      const template = await getTemplateById(value);
      if (!template) {
        showError(
          `Template not found: ${value}`,
          'Use "linear-create templates list" to see available templates'
        );
        process.exit(1);
      }

      // Validate template type matches the config key
      const expectedType = key === 'defaultIssueTemplate' ? 'issue' : 'project';
      if (template.type !== expectedType) {
        showError(`Template type mismatch: ${template.name} is a ${template.type} template, not an ${expectedType} template`);
        process.exit(1);
      }

      console.log(`   ✓ Template found: ${template.name} (${template.type})`);
    } else if (key === 'defaultMilestoneTemplate') {
      // Validate milestone template exists in local templates
      const result = getMilestoneTemplate(value);
      if (!result) {
        showError(
          `Milestone template not found: ${value}`,
          'Use "linear-create milestone-templates list" to see available templates'
        );
        process.exit(1);
      }

      console.log(`   ✓ Milestone template found: ${result.template.name || value} (${result.source})`);
    }

    // Save configuration
    setConfigValue(key as ConfigKey, value, scope);

    // Success message
    const keyLabel =
      key === 'apiKey'
        ? 'API Key'
        : key === 'defaultInitiative'
          ? 'Default Initiative'
          : key === 'defaultTeam'
            ? 'Default Team'
            : key === 'defaultIssueTemplate'
              ? 'Default Issue Template'
              : key === 'defaultProjectTemplate'
                ? 'Default Project Template'
                : 'Default Milestone Template';

    showSuccess(`${keyLabel} saved to ${scopeLabel} config`);

    if (key === 'apiKey') {
      console.log(`   Use 'linear-create config list' to view your configuration`);
    }
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
