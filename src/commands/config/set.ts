import { isAuthenticationError } from '../../lib/cli-error.js';
import { CONFIG_KEY_CHOICES, type ConfigKey,isValidConfigKey, setConfigValue } from '../../lib/config.js';
import {
  getTemplateById,
  validateApiKey,
  validateInitiativeExists,
  validateTeamExists,
} from '../../lib/linear-client.js';
import { getMilestoneTemplate } from '../../lib/milestone-templates.js';
import { showError,showSuccess, showValidated } from '../../lib/output.js';
import { getPrompt } from '../../lib/prompts.js';
import { getScopeInfo } from '../../lib/scope.js';

interface SetConfigOptions {
  global?: boolean;
  project?: boolean;
}

// Human-readable label per config key for success messages. Typed as a full
// Record so adding a new ConfigKey forces adding its label (compile-time guard).
const KEY_LABELS: Record<ConfigKey, string> = {
  apiKey: 'API Key',
  defaultInitiative: 'Default Initiative',
  defaultTeam: 'Default Team',
  defaultProject: 'Default Project',
  defaultIssueTemplate: 'Default Issue Template',
  defaultProjectTemplate: 'Default Project Template',
  defaultMilestoneTemplate: 'Default Milestone Template',
  defaultPrompt: 'Default Prompt',
  projectCacheMinTTL: 'Project Cache Min TTL',
  defaultAutoAssignLead: 'Default Auto-Assign Lead',
  entityCacheMinTTL: 'Entity Cache Min TTL',
  enableEntityCache: 'Enable Entity Cache',
  enablePersistentCache: 'Enable Persistent Cache',
  enableSessionCache: 'Enable Session Cache',
  enableBatchFetching: 'Enable Batch Fetching',
  prewarmCacheOnCreate: 'Prewarm Cache On Create',
  defaultProfile: 'Default Profile',
  noMatchPolicy: 'No-Match Policy',
  confirmAutoDetectedWrites: 'Confirm Auto-Detected Writes',
};

export async function setConfig(key: string, value: string, options: SetConfigOptions) {
  // Validate key
  if (!isValidConfigKey(key)) {
    showError(
      `Invalid configuration key: ${key}`,
      `Valid keys are: ${CONFIG_KEY_CHOICES.join(', ')}`
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
    } else if (key === 'defaultProject') {
      // Validate project exists (M15.1)
      const { getProjectById } = await import('../../lib/linear-client.js');
      const project = await getProjectById(value);
      if (!project) {
        showError(
          `Project not found: ${value}`,
          'Use "agent2linear project list" to see available projects'
        );
        process.exit(1);
      }
      console.log(`   ✓ Project found: ${project.name}`);
    } else if (key === 'defaultIssueTemplate' || key === 'defaultProjectTemplate') {
      // Validate template exists
      const template = await getTemplateById(value);
      if (!template) {
        showError(
          `Template not found: ${value}`,
          'Use "agent2linear templates list" to see available templates'
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
          'Use "agent2linear milestone-templates list" to see available templates'
        );
        process.exit(1);
      }

      console.log(`   ✓ Milestone template found: ${result.template.name || value} (${result.source})`);
    } else if (key === 'defaultPrompt') {
      // Validate prompt exists in local prompts store (M30)
      const result = getPrompt(value);
      if (!result) {
        showError(
          `Prompt not found: ${value}`,
          'Use "agent2linear prompt list" to see available prompts'
        );
        process.exit(1);
      }

      console.log(`   ✓ Prompt found: ${value} (${result.source})`);
    }

    // Save configuration
    setConfigValue(key as ConfigKey, value, scope);

    // Success message
    const keyLabel = KEY_LABELS[key as ConfigKey];

    showSuccess(`${keyLabel} saved to ${scopeLabel} config`);

    if (key === 'apiKey') {
      console.log(`   Use 'agent2linear config list' to view your configuration`);
    }
  } catch (error) {
    if (isAuthenticationError(error)) throw error;
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
