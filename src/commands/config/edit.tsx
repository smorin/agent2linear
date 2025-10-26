import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {
  getConfig,
  setConfigValue,
  unsetConfigValue,
  maskApiKey,
} from '../../lib/config.js';
import {
  validateApiKey,
  validateInitiativeExists,
  validateTeamExists,
  getAllInitiatives,
  getAllTeams,
  getAllTemplates,
  getTemplateById,
  type Initiative,
  type Team,
  type Template,
} from '../../lib/linear-client.js';
import { getScopeInfo } from '../../lib/scope.js';

interface EditOptions {
  global?: boolean;
  project?: boolean;
  key?: string;
  value?: string;
}

// Interactive mode component
type EditStep = 'scope' | 'apiKey' | 'initiative' | 'team' | 'issueTemplate' | 'projectTemplate' | 'done';

interface ConfigState {
  scope: 'global' | 'project' | null;
  apiKey: string | null;
  defaultInitiative: string | null;
  defaultTeam: string | null;
  defaultIssueTemplate: string | null;
  defaultProjectTemplate: string | null;
}

function ConfigEditor({ options }: { options: EditOptions }) {
  const [step, setStep] = useState<EditStep>('scope');
  const [scope, setScope] = useState<'global' | 'project' | null>(
    options.global ? 'global' : options.project ? 'project' : null
  );
  const [config] = useState(() => getConfig());
  const [changes, setChanges] = useState<Partial<ConfigState>>({});

  // Current entity names (fetched on mount)
  const [currentInitiativeName, setCurrentInitiativeName] = useState<string | null>(null);
  const [currentTeamName, setCurrentTeamName] = useState<string | null>(null);
  const [currentIssueTemplateName, setCurrentIssueTemplateName] = useState<string | null>(null);
  const [currentProjectTemplateName, setCurrentProjectTemplateName] = useState<string | null>(null);
  const [loadingNames, setLoadingNames] = useState(false);

  // API Key editing
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');

  // Initiative selection
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loadingInitiatives, setLoadingInitiatives] = useState(false);
  const [initiativeError, setInitiativeError] = useState('');

  // Team selection
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamError, setTeamError] = useState('');

  // Issue Template selection
  const [issueTemplates, setIssueTemplates] = useState<Template[]>([]);
  const [loadingIssueTemplates, setLoadingIssueTemplates] = useState(false);
  const [issueTemplateError, setIssueTemplateError] = useState('');

  // Project Template selection
  const [projectTemplates, setProjectTemplates] = useState<Template[]>([]);
  const [loadingProjectTemplates, setLoadingProjectTemplates] = useState(false);
  const [projectTemplateError, setProjectTemplateError] = useState('');

  // If scope is already determined, skip to next step
  React.useEffect(() => {
    if (scope !== null && step === 'scope') {
      setStep('apiKey');
    }
  }, [scope, step]);

  // Fetch current initiative, team, and template names on mount
  React.useEffect(() => {
    const fetchCurrentNames = async () => {
      setLoadingNames(true);

      // Fetch initiative name if set
      if (config.defaultInitiative) {
        try {
          const result = await validateInitiativeExists(config.defaultInitiative);
          if (result.valid && result.name) {
            setCurrentInitiativeName(result.name);
          }
        } catch (error) {
          // Silently fail - will show just ID
          console.error('Failed to fetch initiative name:', error);
        }
      }

      // Fetch team name if set
      if (config.defaultTeam) {
        try {
          const result = await validateTeamExists(config.defaultTeam);
          if (result.valid && result.name) {
            setCurrentTeamName(result.name);
          }
        } catch (error) {
          // Silently fail - will show just ID
          console.error('Failed to fetch team name:', error);
        }
      }

      // Fetch issue template name if set
      if (config.defaultIssueTemplate) {
        try {
          const template = await getTemplateById(config.defaultIssueTemplate);
          if (template) {
            setCurrentIssueTemplateName(template.name);
          }
        } catch (error) {
          // Silently fail - will show just ID
          console.error('Failed to fetch issue template name:', error);
        }
      }

      // Fetch project template name if set
      if (config.defaultProjectTemplate) {
        try {
          const template = await getTemplateById(config.defaultProjectTemplate);
          if (template) {
            setCurrentProjectTemplateName(template.name);
          }
        } catch (error) {
          // Silently fail - will show just ID
          console.error('Failed to fetch project template name:', error);
        }
      }

      setLoadingNames(false);
    };

    fetchCurrentNames();
  }, []); // Run once on mount

  const handleScopeSelect = (item: { value: 'global' | 'project' }) => {
    setScope(item.value);
    setStep('apiKey');
  };

  const handleApiKeyAction = (item: { value: string }) => {
    if (item.value === 'keep') {
      setStep('initiative');
    } else if (item.value === 'change') {
      setEditingApiKey(true);
    } else if (item.value === 'clear') {
      setChanges({ ...changes, apiKey: null });
      setStep('initiative');
    }
  };

  const handleApiKeySubmit = async () => {
    if (!apiKeyInput.trim()) {
      setApiKeyError('API key cannot be empty');
      return;
    }

    if (!apiKeyInput.startsWith('lin_api_')) {
      setApiKeyError('API keys should start with "lin_api_"');
      return;
    }

    // Validate API key
    try {
      const isValid = await validateApiKey(apiKeyInput);
      if (!isValid) {
        setApiKeyError('Invalid API key or cannot connect to Linear');
        return;
      }
    } catch (error) {
      setApiKeyError(error instanceof Error ? error.message : 'Validation failed');
      return;
    }

    setChanges({ ...changes, apiKey: apiKeyInput });
    setEditingApiKey(false);
    setApiKeyError('');
    setStep('initiative');
  };

  const handleInitiativeAction = async (item: { value: string }) => {
    if (item.value === 'keep') {
      setStep('team');
    } else if (item.value === 'change') {
      setLoadingInitiatives(true);
      try {
        const data = await getAllInitiatives();
        setInitiatives(data);
        setLoadingInitiatives(false);
      } catch (error) {
        setInitiativeError(error instanceof Error ? error.message : 'Failed to fetch initiatives');
        setLoadingInitiatives(false);
      }
    } else if (item.value === 'clear') {
      const newChanges = { ...changes, defaultInitiative: null };
      setChanges(newChanges);
      setStep('team');
    } else {
      // Selected an initiative
      const newChanges = { ...changes, defaultInitiative: item.value };
      setChanges(newChanges);
      setStep('team');
    }
  };

  const handleTeamAction = async (item: { value: string }) => {
    if (item.value === 'keep') {
      setStep('issueTemplate');
    } else if (item.value === 'change') {
      setLoadingTeams(true);
      try {
        const data = await getAllTeams();
        setTeams(data);
        setLoadingTeams(false);
      } catch (error) {
        setTeamError(error instanceof Error ? error.message : 'Failed to fetch teams');
        setLoadingTeams(false);
      }
    } else if (item.value === 'clear') {
      const newChanges = { ...changes, defaultTeam: null };
      setChanges(newChanges);
      setStep('issueTemplate');
    } else {
      // Selected a team
      const newChanges = { ...changes, defaultTeam: item.value };
      setChanges(newChanges);
      setStep('issueTemplate');
    }
  };

  const handleIssueTemplateAction = async (item: { value: string }) => {
    if (item.value === 'keep') {
      setStep('projectTemplate');
    } else if (item.value === 'change') {
      setLoadingIssueTemplates(true);
      try {
        const data = await getAllTemplates('issue');
        setIssueTemplates(data);
        setLoadingIssueTemplates(false);
      } catch (error) {
        setIssueTemplateError(error instanceof Error ? error.message : 'Failed to fetch issue templates');
        setLoadingIssueTemplates(false);
      }
    } else if (item.value === 'clear') {
      const newChanges = { ...changes, defaultIssueTemplate: null };
      setChanges(newChanges);
      setStep('projectTemplate');
    } else {
      // Selected an issue template
      const newChanges = { ...changes, defaultIssueTemplate: item.value };
      setChanges(newChanges);
      setStep('projectTemplate');
    }
  };

  const handleProjectTemplateAction = async (item: { value: string }) => {
    if (item.value === 'keep') {
      await saveChanges(changes);
    } else if (item.value === 'change') {
      setLoadingProjectTemplates(true);
      try {
        const data = await getAllTemplates('project');
        setProjectTemplates(data);
        setLoadingProjectTemplates(false);
      } catch (error) {
        setProjectTemplateError(error instanceof Error ? error.message : 'Failed to fetch project templates');
        setLoadingProjectTemplates(false);
      }
    } else if (item.value === 'clear') {
      const newChanges = { ...changes, defaultProjectTemplate: null };
      setChanges(newChanges);
      await saveChanges(newChanges);
    } else {
      // Selected a project template
      const newChanges = { ...changes, defaultProjectTemplate: item.value };
      setChanges(newChanges);
      await saveChanges(newChanges);
    }
  };

  const saveChanges = async (changesToSave: Partial<ConfigState>) => {
    if (!scope) return;

    try {
      // Save changes
      if (changesToSave.apiKey !== undefined) {
        if (changesToSave.apiKey === null) {
          unsetConfigValue('apiKey', scope);
        } else {
          setConfigValue('apiKey', changesToSave.apiKey, scope);
        }
      }
      if (changesToSave.defaultInitiative !== undefined) {
        if (changesToSave.defaultInitiative === null) {
          unsetConfigValue('defaultInitiative', scope);
        } else {
          setConfigValue('defaultInitiative', changesToSave.defaultInitiative, scope);
        }
      }
      if (changesToSave.defaultTeam !== undefined) {
        if (changesToSave.defaultTeam === null) {
          unsetConfigValue('defaultTeam', scope);
        } else {
          setConfigValue('defaultTeam', changesToSave.defaultTeam, scope);
        }
      }
      if (changesToSave.defaultIssueTemplate !== undefined) {
        if (changesToSave.defaultIssueTemplate === null) {
          unsetConfigValue('defaultIssueTemplate', scope);
        } else {
          setConfigValue('defaultIssueTemplate', changesToSave.defaultIssueTemplate, scope);
        }
      }
      if (changesToSave.defaultProjectTemplate !== undefined) {
        if (changesToSave.defaultProjectTemplate === null) {
          unsetConfigValue('defaultProjectTemplate', scope);
        } else {
          setConfigValue('defaultProjectTemplate', changesToSave.defaultProjectTemplate, scope);
        }
      }

      const { label: scopeLabel } = getScopeInfo({ global: scope === 'global', project: scope === 'project' });
      console.log(`\n✅ Configuration updated (${scopeLabel})\n`);
      setStep('done');
      process.exit(0);
    } catch (error) {
      console.error(`\n❌ Error saving config: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
      process.exit(1);
    }
  };

  if (step === 'done') {
    return null;
  }

  // Step 1: Select scope
  if (step === 'scope') {
    const scopeItems = [
      { label: 'Global (~/.config/linear-create/config.json)', value: 'global' as const },
      { label: 'Project (.linear-create/config.json)', value: 'project' as const },
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Configuration scope for this session:</Text>
        <SelectInput items={scopeItems} onSelect={handleScopeSelect} />
      </Box>
    );
  }

  // Step 2: API Key
  if (step === 'apiKey') {
    // Show loading state while fetching current entity names
    if (loadingNames) {
      return (
        <Box>
          <Text>🔄 Loading current configuration...</Text>
        </Box>
      );
    }

    if (editingApiKey) {
      return (
        <Box flexDirection="column">
          <Text bold>Enter new API key:</Text>
          {apiKeyError && <Text color="red">{apiKeyError}</Text>}
          <TextInput
            value={apiKeyInput}
            placeholder="lin_api_xxxxxxxxxxxxxxxxxxxxx"
            onChange={setApiKeyInput}
            onSubmit={handleApiKeySubmit}
          />
          <Text dimColor>Paste your full API key from https://linear.app/settings/api</Text>
          <Text dimColor>(Press Enter to save, Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    const currentApiKey = config.apiKey ? maskApiKey(config.apiKey) : 'Not set';
    const apiKeyItems = [
      { label: `Keep current (${currentApiKey})`, value: 'keep' },
      { label: 'Change API key', value: 'change' },
      ...(config.apiKey ? [{ label: 'Clear API key', value: 'clear' }] : []),
    ];

    return (
      <Box flexDirection="column">
        <Text bold>API Key:</Text>
        <SelectInput items={apiKeyItems} onSelect={handleApiKeyAction} />
      </Box>
    );
  }

  // Step 3: Default Initiative
  if (step === 'initiative') {
    if (loadingInitiatives) {
      return (
        <Box>
          <Text>🔄 Loading initiatives...</Text>
        </Box>
      );
    }

    if (initiativeError) {
      return (
        <Box>
          <Text color="red">❌ Error: {initiativeError}</Text>
        </Box>
      );
    }

    if (initiatives.length > 0) {
      const initiativeItems = initiatives.map(init => ({
        label: `${init.name} (${init.id})`,
        value: init.id,
      }));

      return (
        <Box flexDirection="column">
          <Text bold>Select initiative:</Text>
          <SelectInput items={initiativeItems} onSelect={handleInitiativeAction} />
          <Text dimColor>(Press Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    const currentInitiative = config.defaultInitiative
      ? currentInitiativeName
        ? `${currentInitiativeName} (${config.defaultInitiative})`
        : config.defaultInitiative // Fallback if name fetch failed
      : 'Not set';
    const initiativeItems = [
      { label: `Keep current (${currentInitiative})`, value: 'keep' },
      { label: 'Change default initiative', value: 'change' },
      ...(config.defaultInitiative ? [{ label: 'Clear default initiative', value: 'clear' }] : []),
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Default Initiative:</Text>
        <SelectInput items={initiativeItems} onSelect={handleInitiativeAction} />
      </Box>
    );
  }

  // Step 4: Default Team
  if (step === 'team') {
    if (loadingTeams) {
      return (
        <Box>
          <Text>🔄 Loading teams...</Text>
        </Box>
      );
    }

    if (teamError) {
      return (
        <Box>
          <Text color="red">❌ Error: {teamError}</Text>
        </Box>
      );
    }

    if (teams.length > 0) {
      const teamItems = teams.map(team => ({
        label: `${team.name} (${team.id})`,
        value: team.id,
      }));

      return (
        <Box flexDirection="column">
          <Text bold>Select team:</Text>
          <SelectInput items={teamItems} onSelect={handleTeamAction} />
          <Text dimColor>(Press Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    const currentTeam = config.defaultTeam
      ? currentTeamName
        ? `${currentTeamName} (${config.defaultTeam})`
        : config.defaultTeam // Fallback if name fetch failed
      : 'Not set';
    const teamItems = [
      { label: `Keep current (${currentTeam})`, value: 'keep' },
      { label: 'Change default team', value: 'change' },
      ...(config.defaultTeam ? [{ label: 'Clear default team', value: 'clear' }] : []),
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Default Team:</Text>
        <SelectInput items={teamItems} onSelect={handleTeamAction} />
      </Box>
    );
  }

  // Step 5: Default Issue Template
  if (step === 'issueTemplate') {
    if (loadingIssueTemplates) {
      return (
        <Box>
          <Text>🔄 Loading issue templates...</Text>
        </Box>
      );
    }

    if (issueTemplateError) {
      return (
        <Box>
          <Text color="red">❌ Error: {issueTemplateError}</Text>
        </Box>
      );
    }

    if (issueTemplates.length > 0) {
      const templateItems = issueTemplates.map(template => ({
        label: `${template.name} (${template.id})`,
        value: template.id,
      }));

      return (
        <Box flexDirection="column">
          <Text bold>Select issue template:</Text>
          <SelectInput items={templateItems} onSelect={handleIssueTemplateAction} />
          <Text dimColor>(Press Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    const currentIssueTemplate = config.defaultIssueTemplate
      ? currentIssueTemplateName
        ? `${currentIssueTemplateName} (${config.defaultIssueTemplate})`
        : config.defaultIssueTemplate // Fallback if name fetch failed
      : 'Not set';
    const issueTemplateItems = [
      { label: `Keep current (${currentIssueTemplate})`, value: 'keep' },
      { label: 'Change default issue template', value: 'change' },
      ...(config.defaultIssueTemplate ? [{ label: 'Clear default issue template', value: 'clear' }] : []),
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Default Issue Template:</Text>
        <SelectInput items={issueTemplateItems} onSelect={handleIssueTemplateAction} />
      </Box>
    );
  }

  // Step 6: Default Project Template
  if (step === 'projectTemplate') {
    if (loadingProjectTemplates) {
      return (
        <Box>
          <Text>🔄 Loading project templates...</Text>
        </Box>
      );
    }

    if (projectTemplateError) {
      return (
        <Box>
          <Text color="red">❌ Error: {projectTemplateError}</Text>
        </Box>
      );
    }

    if (projectTemplates.length > 0) {
      const templateItems = projectTemplates.map(template => ({
        label: `${template.name} (${template.id})`,
        value: template.id,
      }));

      return (
        <Box flexDirection="column">
          <Text bold>Select project template:</Text>
          <SelectInput items={templateItems} onSelect={handleProjectTemplateAction} />
          <Text dimColor>(Press Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    const currentProjectTemplate = config.defaultProjectTemplate
      ? currentProjectTemplateName
        ? `${currentProjectTemplateName} (${config.defaultProjectTemplate})`
        : config.defaultProjectTemplate // Fallback if name fetch failed
      : 'Not set';
    const projectTemplateItems = [
      { label: `Keep current (${currentProjectTemplate})`, value: 'keep' },
      { label: 'Change default project template', value: 'change' },
      ...(config.defaultProjectTemplate ? [{ label: 'Clear default project template', value: 'clear' }] : []),
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Default Project Template:</Text>
        <SelectInput items={projectTemplateItems} onSelect={handleProjectTemplateAction} />
      </Box>
    );
  }

  return null;
}

export async function editConfig(options: EditOptions = {}) {
  // Interactive mode only
  render(<ConfigEditor options={options} />);
}
