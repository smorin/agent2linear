import React, { useState, useEffect } from 'react';
import { render, Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {
	getConfig,
	setConfigValue,
	hasGlobalConfig,
	hasProjectConfig,
	getGlobalConfigPath,
	getProjectConfigPath,
	maskApiKey,
} from '../lib/config.js';
import {
	validateApiKey,
	getAllTeams,
	getAllInitiatives,
	type Team,
	type Initiative,
} from '../lib/linear-client.js';
import { WalkthroughScreen } from '../components/setup/WalkthroughScreen.js';
import { syncWorkflowStateAliasesCore } from './workflow-states/sync-aliases.js';
import { syncProjectStatusAliases } from './project-status/sync-aliases.js';
import { syncMemberAliasesCore } from './members/sync-aliases.js';

type SetupStep =
	| 'welcome'
	| 'existing-config'
	| 'scope-selection'
	| 'api-key-guide'
	| 'api-key-choice'
	| 'config-source-choice'
	| 'api-key-entry'
	| 'env-key-missing'
	| 'env-key-invalid'
	| 'validation-failed'
	| 'team-selection'
	| 'initiative-selection'
	| 'alias-setup'
	| 'walkthrough-1'
	| 'walkthrough-2'
	| 'walkthrough-3'
	| 'walkthrough-4'
	| 'walkthrough-5'
	| 'walkthrough-6'
	| 'walkthrough-7'
	| 'completion';

interface AliasOptions {
	workflowStates: boolean;
	projectStatuses: boolean;
	members: boolean;
}

function SetupWizard() {
	const [step, setStep] = useState<SetupStep>('welcome');
	const [scope, setScope] = useState<'global' | 'project' | null>(null);
	const [apiKey, setApiKey] = useState('');
	const [apiKeyInput, setApiKeyInput] = useState('');
	const [apiKeyError, setApiKeyError] = useState('');
	const [validatingApiKey, setValidatingApiKey] = useState(false);
	const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
	const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
	const [selectedAliases, setSelectedAliases] = useState<string[]>([]);
	const [creatingAliases, setCreatingAliases] = useState(false);

	// Teams data
	const [teams, setTeams] = useState<Team[]>([]);
	const [loadingTeams, setLoadingTeams] = useState(false);
	const [teamsError, setTeamsError] = useState('');

	// Initiatives data
	const [initiatives, setInitiatives] = useState<Initiative[]>([]);
	const [loadingInitiatives, setLoadingInitiatives] = useState(false);
	const [initiativesError, setInitiativesError] = useState('');

	// Check for existing config on mount
	useEffect(() => {
		const hasGlobal = hasGlobalConfig();
		const hasProject = hasProjectConfig();

		if (hasGlobal || hasProject) {
			// Full config exists - show message and wait for user to exit
			setStep('existing-config');
		}
		// Don't auto-validate env key - let user choose in api-key-choice screen
	}, []);

	// Handle input across different screens
	useInput((input, key) => {
		if (step === 'existing-config' && key.return) {
			process.exit(0);
		} else if (step === 'env-key-missing' && key.return) {
			process.exit(0);
		} else if (step === 'env-key-invalid' && key.return) {
			process.exit(1);
		} else if (step === 'validation-failed' && key.return) {
			process.exit(1);
		} else if (step === 'welcome' && key.return) {
			setStep('scope-selection');
		} else if (step === 'api-key-guide' && key.return) {
			setStep('api-key-choice');
		} else if (step.startsWith('walkthrough-') && key.return) {
			handleWalkthroughNext();
		} else if (step === 'completion' && key.return) {
			process.exit(0);
		}
	});

	const handleWalkthroughNext = () => {
		const walkthroughNumber = parseInt(step.split('-')[1] || '1');
		if (walkthroughNumber < 7) {
			setStep(`walkthrough-${walkthroughNumber + 1}` as SetupStep);
		} else {
			setStep('completion');
		}
	};

	const handleScopeSelect = async (item: { value: 'global' | 'project' }) => {
		setScope(item.value);
		// Always proceed to api-key-guide to give user the choice
		setStep('api-key-guide');
	};

	const handleApiKeyChoice = async (item: { value: 'config' | 'env' }) => {
		if (item.value === 'config') {
			// Check if env var exists - if so, offer to use it
			const envKey = process.env.LINEAR_API_KEY;
			if (envKey) {
				setStep('config-source-choice');
			} else {
				setStep('api-key-entry');
			}
		} else {
			// User chose environment variable
			const envKey = process.env.LINEAR_API_KEY;

			if (!envKey) {
				// No env key set - show error screen
				setStep('env-key-missing');
				return;
			}

			// Validate the env key
			setValidatingApiKey(true);
			try {
				const isValid = await validateApiKey(envKey);
				if (!isValid) {
					setApiKeyError('Invalid API key in LINEAR_API_KEY environment variable');
					setValidatingApiKey(false);
					setStep('env-key-invalid');
					return;
				}

				// Valid key - save to state and continue
				setApiKey(envKey);
				setValidatingApiKey(false);

				// Load teams
				setLoadingTeams(true);
				try {
					const teamsData = await getAllTeams();
					setTeams(teamsData);
					setLoadingTeams(false);
					setStep('team-selection');
				} catch (err) {
					setTeamsError(err instanceof Error ? err.message : 'Failed to fetch teams');
					setLoadingTeams(false);
				}
			} catch (error) {
				setApiKeyError(
					error instanceof Error ? error.message : 'Validation failed'
				);
				setValidatingApiKey(false);
				setStep('validation-failed');
			}
		}
	};

	const handleConfigSourceChoice = async (item: { value: 'use-env' | 'manual' }) => {
		if (item.value === 'manual') {
			// User wants to enter manually
			setStep('api-key-entry');
		} else {
			// User wants to use env var value for config
			const envKey = process.env.LINEAR_API_KEY;
			if (!envKey) {
				// Shouldn't happen, but handle gracefully
				setStep('api-key-entry');
				return;
			}

			// Validate the env key
			setValidatingApiKey(true);
			try {
				const isValid = await validateApiKey(envKey);
				if (!isValid) {
					setApiKeyError('Invalid API key in LINEAR_API_KEY environment variable');
					setValidatingApiKey(false);
					setStep('env-key-invalid');
					return;
				}

				// Valid key - save to config file
				if (scope) {
					setConfigValue('apiKey', envKey, scope);
				}
				setApiKey(envKey);
				setValidatingApiKey(false);

				// Load teams
				setLoadingTeams(true);
				try {
					const teamsData = await getAllTeams();
					setTeams(teamsData);
					setLoadingTeams(false);
					setStep('team-selection');
				} catch (err) {
					setTeamsError(err instanceof Error ? err.message : 'Failed to fetch teams');
					setLoadingTeams(false);
				}
			} catch (error) {
				setApiKeyError(
					error instanceof Error ? error.message : 'Validation failed'
				);
				setValidatingApiKey(false);
				setStep('validation-failed');
			}
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

		setValidatingApiKey(true);
		setApiKeyError('');

		try {
			const isValid = await validateApiKey(apiKeyInput);
			if (!isValid) {
				setApiKeyError('Invalid API key or cannot connect to Linear');
				setValidatingApiKey(false);
				return;
			}

			// Save API key
			if (scope) {
				setConfigValue('apiKey', apiKeyInput, scope);
				setApiKey(apiKeyInput);
			}

			setValidatingApiKey(false);

			// Load teams
			setLoadingTeams(true);
			try {
				const teamsData = await getAllTeams();
				setTeams(teamsData);
				setLoadingTeams(false);
				setStep('team-selection');
			} catch (err) {
				setTeamsError(err instanceof Error ? err.message : 'Failed to fetch teams');
				setLoadingTeams(false);
			}
		} catch (error) {
			setApiKeyError(
				error instanceof Error ? error.message : 'Validation failed'
			);
			setValidatingApiKey(false);
		}
	};

	const handleTeamSelect = async (teamId: string) => {
		if (teamId === 'skip') {
			// User chose to skip setting a default team
			// Don't set selectedTeam or save to config
			// Still load initiatives (org-wide initiatives)
			setLoadingInitiatives(true);
			try {
				const initiativesData = await getAllInitiatives();
				setInitiatives(initiativesData);
				setLoadingInitiatives(false);
				setStep('initiative-selection');
			} catch (err) {
				setInitiativesError(
					err instanceof Error ? err.message : 'Failed to fetch initiatives'
				);
				setLoadingInitiatives(false);
				// Still proceed even if initiatives fail
				setStep('alias-setup');
			}
			return;
		}

		const team = teams.find(t => t.id === teamId);
		if (!team) return;

		setSelectedTeam(team);

		// Save team to config
		if (scope) {
			setConfigValue('defaultTeam', team.id, scope);
		}

		// Load initiatives
		setLoadingInitiatives(true);
		try {
			const initiativesData = await getAllInitiatives();
			setInitiatives(initiativesData);
			setLoadingInitiatives(false);
			setStep('initiative-selection');
		} catch (err) {
			setInitiativesError(
				err instanceof Error ? err.message : 'Failed to fetch initiatives'
			);
			setLoadingInitiatives(false);
			// Still proceed even if initiatives fail
			setStep('alias-setup');
		}
	};

	const handleInitiativeSelect = (item: { value: string }) => {
		if (item.value === 'skip') {
			setStep('alias-setup');
			return;
		}

		const initiative = initiatives.find(i => i.id === item.value);
		if (initiative) {
			setSelectedInitiative(initiative);
			if (scope) {
				setConfigValue('defaultInitiative', initiative.id, scope);
			}
		}
		setStep('alias-setup');
	};

	const handleAliasComplete = async (selectedKeys: string[]) => {
		setSelectedAliases(selectedKeys); // Store for completion screen
		const hasAnySelected = selectedKeys.length > 0;

		if (!hasAnySelected) {
			setStep('walkthrough-1');
			return;
		}

		setCreatingAliases(true);

		try {
			// Create selected aliases
			if (selectedKeys.includes('workflowStates') && selectedTeam) {
				await syncWorkflowStateAliasesCore({
					team: selectedTeam.id,
					global: scope === 'global'
				});
			}
			if (selectedKeys.includes('projectStatuses')) {
				await syncProjectStatusAliases({
					global: scope === 'global'
				});
			}
			if (selectedKeys.includes('members')) {
				await syncMemberAliasesCore({
					global: scope === 'global'
				});
			}
		} catch (error) {
			// Silently continue even if alias creation fails
			console.error('Failed to create some aliases:', error);
		}

		setCreatingAliases(false);
		setStep('walkthrough-1');
	};

	// Welcome screen
	if (step === 'welcome') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="cyan">
					🚀 Welcome to linear-create!
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>
					This setup wizard will guide you through configuring linear-create
					for your Linear workspace.
				</Text>
				<Box flexDirection="column" marginTop={1}>
					<Text>We'll help you:</Text>
					<Box marginLeft={2}>
						<Text>• Connect your Linear API key</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• Select your default team</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• Configure optional defaults</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• Learn about key commands</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to continue]
					</Text>
				</Box>
			</Box>
		);
	}

	// Existing config detected
	if (step === 'existing-config') {
		const config = getConfig();
		const hasGlobal = hasGlobalConfig();
		const hasProject = hasProjectConfig();
		const globalPath = getGlobalConfigPath();
		const projectPath = getProjectConfigPath();

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="yellow">
					⚠️  Configuration Already Exists
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>
					It looks like linear-create is already configured on this system.
				</Text>
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Found configuration files:</Text>
					{hasGlobal && (
						<Box marginLeft={2}>
							<Text color="cyan">• {globalPath}</Text>
						</Box>
					)}
					{hasProject && (
						<Box marginLeft={2}>
							<Text color="cyan">• {projectPath}</Text>
						</Box>
					)}
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Text>Current configuration:</Text>
					{config.apiKey && (
						<Box marginLeft={2}>
							<Text>• API Key: {maskApiKey(config.apiKey)}</Text>
						</Box>
					)}
					{config.defaultTeam && (
						<Box marginLeft={2}>
							<Text>• Default Team: {config.defaultTeam}</Text>
						</Box>
					)}
					{config.defaultInitiative && (
						<Box marginLeft={2}>
							<Text>• Default Initiative: {config.defaultInitiative}</Text>
						</Box>
					)}
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Text color="cyan">To reconfigure, use:</Text>
					<Box marginLeft={2}>
						<Text color="green">$ linear-create config edit</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to exit]
					</Text>
				</Box>
			</Box>
		);
	}

	// Scope selection
	if (step === 'scope-selection') {
		const scopeItems = [
			{
				label: 'Global (~/.config/linear-create/)',
				value: 'global' as const,
			},
			{
				label: 'Project (.linear-create/)',
				value: 'project' as const,
			},
		];

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Configuration Scope</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>Where should we save your configuration?</Text>
				<Box flexDirection="column" marginTop={1}>
					<Text color="gray">
						• Global: Used for all projects (recommended for most users)
					</Text>
					<Text color="gray">
						• Project: Only for this project directory
					</Text>
				</Box>
				<Box marginTop={1}>
					<SelectInput items={scopeItems} onSelect={handleScopeSelect} />
				</Box>
			</Box>
		);
	}

	// API key guide
	if (step === 'api-key-guide') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="cyan">
					🔑 Getting Your Linear API Key
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Box flexDirection="column">
					<Text bold>Steps to get your API key:</Text>
					<Box marginLeft={2} marginTop={1}>
						<Text>1. Visit: </Text>
						<Text color="blue" underline>
							https://linear.app/settings/api
						</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>2. Click "Create new API key"</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>3. Give it a name (e.g., "linear-create CLI")</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>4. Copy the key (starts with "lin_api_")</Text>
					</Box>
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Configuration options:</Text>
					<Box marginLeft={2} marginTop={1}>
						<Text color="yellow">📁 Config File (what we'll use)</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="gray" dimColor>
							• Saved securely in your {scope} config
						</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="gray" dimColor>
							• Persists across terminal sessions
						</Text>
					</Box>
					<Box marginLeft={2} marginTop={1}>
						<Text color="cyan">🌍 Environment Variable</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="gray" dimColor>
							• Set LINEAR_API_KEY in your shell
						</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="gray" dimColor>
							• Better for CI/CD or shared machines
						</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="gray" dimColor>
							• You can set this up manually after setup
						</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to continue]
					</Text>
				</Box>
			</Box>
		);
	}

	// API key choice
	if (step === 'api-key-choice') {
		const envKey = process.env.LINEAR_API_KEY;
		const hasEnvKey = !!envKey;

		const choices = [
			{
				label: 'Enter API key now (save to config file)',
				value: 'config' as const,
			},
			{
				label: `Use LINEAR_API_KEY environment variable${hasEnvKey ? ' ✓ detected' : ' (not set)'}`,
				value: 'env' as const,
			},
		];

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="cyan">
					How do you want to provide your API key?
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>Choose your preferred method:</Text>
				<Box flexDirection="column" marginTop={1}>
					<Text color="gray">
						• Config file: Saved locally, persists across sessions
					</Text>
					<Text color="gray">
						• Environment variable: Better for CI/CD, doesn't write to disk
					</Text>
				</Box>
				<Box marginTop={1}>
					<SelectInput items={choices} onSelect={handleApiKeyChoice} />
				</Box>
			</Box>
		);
	}

	// Config source choice (when env var exists but user chose config file)
	if (step === 'config-source-choice') {
		const envKey = process.env.LINEAR_API_KEY;
		const maskedEnvKey = envKey ? maskApiKey(envKey) : '';

		const choices = [
			{
				label: `Use LINEAR_API_KEY value (${maskedEnvKey})`,
				value: 'use-env' as const,
			},
			{
				label: 'Enter a different API key manually',
				value: 'manual' as const,
			},
		];

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="cyan">
					Config File Source
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>
					You chose to save to a config file, but LINEAR_API_KEY environment variable is already set.
				</Text>
				<Box marginTop={1}>
					<Text>Would you like to:</Text>
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Text color="gray">
						• Use the existing env var value and save it to config
					</Text>
					<Text color="gray">
						• Enter a different key manually
					</Text>
				</Box>
				<Box marginTop={1}>
					<SelectInput items={choices} onSelect={handleConfigSourceChoice} />
				</Box>
			</Box>
		);
	}

	// API key entry
	if (step === 'api-key-entry') {
		if (validatingApiKey) {
			return (
				<Box>
					<Text>🔄 Validating API key...</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Enter Your API Key</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				{apiKeyError && (
					<Text color="red">❌ {apiKeyError}</Text>
				)}
				<Box>
					<Text color="gray">API Key: </Text>
					<TextInput
						value={apiKeyInput}
						placeholder="lin_api_xxxxxxxxxxxxxxxxxxxxx"
						onChange={setApiKeyInput}
						onSubmit={handleApiKeySubmit}
					/>
				</Box>
				<Text color="gray" dimColor>
					(Press Enter to validate, Ctrl+C to cancel)
				</Text>
			</Box>
		);
	}

	// Team selection
	if (step === 'team-selection') {
		if (loadingTeams) {
			return (
				<Box>
					<Text>🔄 Loading teams...</Text>
				</Box>
			);
		}

		if (teamsError) {
			return (
				<Box>
					<Text color="red">❌ Error: {teamsError}</Text>
				</Box>
			);
		}

		if (teams.length === 0) {
			return (
				<Box flexDirection="column">
					<Text color="yellow">
						No teams found in your Linear workspace.
					</Text>
					<Text color="gray" dimColor>
						Create one at linear.app to get started.
					</Text>
				</Box>
			);
		}

		const teamItems = [
			{ label: '(Skip - set later)', value: 'skip' },
			...teams.map(team => ({
				label: team.name,
				value: team.id,
			})),
		];

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Select Default Team</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>Choose your primary team (you can change this later):</Text>
				<Box marginTop={1}>
					<SelectInput
						items={teamItems}
						onSelect={item => handleTeamSelect(item.value)}
					/>
				</Box>
			</Box>
		);
	}

	// Initiative selection
	if (step === 'initiative-selection') {
		if (loadingInitiatives) {
			return (
				<Box>
					<Text>🔄 Loading initiatives...</Text>
				</Box>
			);
		}

		if (initiativesError) {
			// Show error but allow continue
			return (
				<Box flexDirection="column" gap={1}>
					<Text color="yellow">
						⚠️  Could not load initiatives: {initiativesError}
					</Text>
					<Text color="gray">Continuing without setting default initiative...</Text>
				</Box>
			);
		}

		const initiativeItems = [
			{ label: '(Skip - set later)', value: 'skip' },
			...initiatives.map(init => ({
				label: init.name,
				value: init.id,
			})),
		];

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold>Select Default Initiative (Optional)</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>
					Choose a default initiative or skip:
				</Text>
				<Box marginTop={1}>
					<SelectInput items={initiativeItems} onSelect={handleInitiativeSelect} />
				</Box>
			</Box>
		);
	}

	// Alias setup
	if (step === 'alias-setup') {
		if (creatingAliases) {
			return (
				<Box>
					<Text>🔄 Creating aliases...</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="cyan">
					🏷️  Starter Aliases (Optional)
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>
					Aliases let you use friendly names instead of IDs:
				</Text>
				<Box marginLeft={2} marginTop={1}>
					<Text color="green">
						$ linear-create project create --team engineering
					</Text>
				</Box>
				<Box marginLeft={2}>
					<Text color="gray" dimColor>
						instead of: --team team_abc123...
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text bold>
						Select aliases to create (↑↓ to navigate, Space to toggle, Enter to continue):
					</Text>
				</Box>
				<AliasSetupInput onComplete={handleAliasComplete} />
			</Box>
		);
	}

	// Walkthrough screens
	if (step === 'walkthrough-1') {
		return (
			<WalkthroughScreen
				title="Project Creation"
				icon="📋"
				description={`Projects are the primary way to organize work in Linear. Use linear-create to quickly create projects from the command line.`}
				examples={[
					'linear-create project create --title "My Project"',
					'linear-create project create --title "Q2 Initiative" --team engineering',
					'linear-create project create --interactive',
				]}
				currentStep={1}
				totalSteps={7}
				footer="[Press Enter to continue]"
			/>
		);
	}

	if (step === 'walkthrough-2') {
		return (
			<WalkthroughScreen
				title="Alias System"
				icon="🏷️"
				description={`Aliases let you use memorable names instead of Linear IDs. Create aliases for teams, members, templates, labels, and more.`}
				examples={[
					'linear-create alias add team engineering team_abc123',
					'linear-create alias list',
					'linear-create workflow-states sync-aliases --team engineering',
				]}
				currentStep={2}
				totalSteps={7}
				footer="[Press Enter to continue]"
			/>
		);
	}

	if (step === 'walkthrough-3') {
		return (
			<WalkthroughScreen
				title="Templates"
				icon="📝"
				description={`Templates help you create consistent projects and issues. Browse available templates and set defaults for quick project creation.`}
				examples={[
					'linear-create templates list',
					'linear-create config set defaultProjectTemplate template_xxx',
					'linear-create project create --template my-template',
				]}
				currentStep={3}
				totalSteps={7}
				footer="[Press Enter to continue]"
			/>
		);
	}

	if (step === 'walkthrough-4') {
		return (
			<WalkthroughScreen
				title="Labels & Metadata"
				icon="🎨"
				description={`Manage project labels, issue labels, workflow states, icons, and colors. Keep your Linear workspace organized and consistent.`}
				examples={[
					'linear-create project-labels list',
					'linear-create issue-labels sync-aliases',
					'linear-create icons list --search rocket',
					'linear-create colors list',
				]}
				currentStep={4}
				totalSteps={7}
				footer="[Press Enter to continue]"
			/>
		);
	}

	if (step === 'walkthrough-5') {
		return (
			<WalkthroughScreen
				title="Configuration Management"
				icon="⚙️"
				description={`Your configuration is stored in ${scope === 'global' ? '~/.config/linear-create/' : '.linear-create/'}. You can edit it anytime or use config commands.`}
				examples={[
					'linear-create config edit',
					'linear-create config get',
					'linear-create config set defaultTeam team_xxx',
					'linear-create teams select',
				]}
				currentStep={5}
				totalSteps={7}
				footer="[Press Enter to continue]"
			/>
		);
	}

	if (step === 'walkthrough-6') {
		return (
			<WalkthroughScreen
				title="Common Workflows"
				icon="🔄"
				description={`Here are some common workflows to get you started with linear-create.`}
				examples={[
					'# Create a new project\nlinear-create project create --title "New Feature"',
					'# List all teams and select default\nlinear-create teams select',
					'# Sync workflow state aliases for easier reference\nlinear-create workflow-states sync-aliases',
				]}
				currentStep={6}
				totalSteps={7}
				footer="[Press Enter to continue]"
			/>
		);
	}

	if (step === 'walkthrough-7') {
		return (
			<WalkthroughScreen
				title="Help & Resources"
				icon="💡"
				description={`Need help? Use these commands to explore linear-create capabilities.`}
				examples={[
					'linear-create --help',
					'linear-create project --help',
					'linear-create config --help',
				]}
				currentStep={7}
				totalSteps={7}
				footer="[Press Enter to finish setup]"
			/>
		);
	}

	// Error screen: Environment key missing
	if (step === 'env-key-missing') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="yellow">
					⚠️  LINEAR_API_KEY Not Found
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text>
					You selected to use an environment variable, but LINEAR_API_KEY is not set.
				</Text>
				<Box flexDirection="column" marginTop={1}>
					<Text bold>To set your API key as an environment variable:</Text>
					<Box marginLeft={2} marginTop={1}>
						<Text color="green">
							export LINEAR_API_KEY="lin_api_xxxxxxxxxxxxx"
						</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text>
						Then run setup again. The wizard will detect your key automatically.
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to exit]
					</Text>
				</Box>
			</Box>
		);
	}

	// Error screen: Environment key invalid
	if (step === 'env-key-invalid') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="red">
					❌ Invalid API Key
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text color="red">
					{apiKeyError}
				</Text>
				<Box marginTop={1}>
					<Text>
						The LINEAR_API_KEY environment variable contains an invalid API key.
					</Text>
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Text bold>Please check:</Text>
					<Box marginLeft={2}>
						<Text>• The key starts with "lin_api_"</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• You copied the entire key</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• The key hasn't been revoked</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to exit]
					</Text>
				</Box>
			</Box>
		);
	}

	// Error screen: Validation failed
	if (step === 'validation-failed') {
		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="red">
					❌ Validation Failed
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Text color="red">
					{apiKeyError}
				</Text>
				<Box marginTop={1}>
					<Text>
						Could not validate your API key. This might be due to:
					</Text>
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Box marginLeft={2}>
						<Text>• Network connectivity issues</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• Linear API is temporarily unavailable</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>• Invalid API key format</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text>
						Please check your connection and try again.
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to exit]
					</Text>
				</Box>
			</Box>
		);
	}

	// Completion screen
	if (step === 'completion') {
		const aliasCount =
			(selectedAliases.includes('workflowStates') ? teams.length * 5 : 0) +
			(selectedAliases.includes('projectStatuses') ? 5 : 0) +
			(selectedAliases.includes('members') ? 10 : 0); // Rough estimate

		return (
			<Box flexDirection="column" gap={1}>
				<Text bold color="green">
					✅ Setup Complete!
				</Text>
				<Box>
					<Text color="gray">{'━'.repeat(50)}</Text>
				</Box>
				<Box flexDirection="column">
					<Text bold>Your configuration:</Text>
					<Box marginLeft={2}>
						<Text>📁 Scope: {scope === 'global' ? 'Global' : 'Project'} ({scope === 'global' ? '~/.config/linear-create/' : '.linear-create/'})</Text>
					</Box>
					<Box marginLeft={2}>
						<Text>🔑 API Key: {maskApiKey(apiKey)} ✓ valid</Text>
					</Box>
					{selectedTeam && (
						<Box marginLeft={2}>
							<Text>👥 Default Team: {selectedTeam.name}</Text>
						</Box>
					)}
					{selectedInitiative && (
						<Box marginLeft={2}>
							<Text>🎯 Default Initiative: {selectedInitiative.name}</Text>
						</Box>
					)}
					{aliasCount > 0 && (
						<Box marginLeft={2}>
							<Text>🏷️  Aliases Created: ~{aliasCount}</Text>
						</Box>
					)}
				</Box>
				<Box flexDirection="column" marginTop={1}>
					<Text bold color="cyan">
						🚀 Next Steps:
					</Text>
					<Box marginLeft={2} marginTop={1}>
						<Text>Create your first project:</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="green">
							$ linear-create project create --title "My First Project"
						</Text>
					</Box>
					<Box marginLeft={2} marginTop={1}>
						<Text>View all commands:</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="green">$ linear-create --help</Text>
					</Box>
					<Box marginLeft={2} marginTop={1}>
						<Text>Reconfigure later:</Text>
					</Box>
					<Box marginLeft={4}>
						<Text color="green">$ linear-create config edit</Text>
					</Box>
				</Box>
				<Box marginTop={1}>
					<Text bold>Happy building! 🎉</Text>
				</Box>
				<Box marginTop={1}>
					<Text color="gray" dimColor>
						[Press Enter to exit]
					</Text>
				</Box>
			</Box>
		);
	}

	return null;
}

// Component to handle alias selection input
function AliasSetupInput({
	onComplete,
}: {
	onComplete: (selectedKeys: string[]) => void;
}) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [selected, setSelected] = useState<Set<string>>(new Set());

	const items = [
		{ key: 'workflowStates', label: 'Workflow States (Todo, In Progress, Done, etc.)' },
		{ key: 'projectStatuses', label: 'Project Statuses (Planned, Started, Completed, etc.)' },
		{ key: 'members', label: 'Team Members (your teammates)' },
	];

	useInput((input, key) => {
		if (key.upArrow) {
			setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
		} else if (key.downArrow) {
			setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
		} else if (input === ' ') {
			// Space toggles current selection
			setSelected(prev => {
				const newSet = new Set(prev);
				const itemKey = items[selectedIndex].key;
				if (newSet.has(itemKey)) {
					newSet.delete(itemKey);
				} else {
					newSet.add(itemKey);
				}
				return newSet;
			});
		} else if (key.return) {
			// Enter submits
			onComplete(Array.from(selected));
		} else if (input === '1') {
			// Number shortcuts still work
			const itemKey = 'workflowStates';
			setSelected(prev => {
				const newSet = new Set(prev);
				newSet.has(itemKey) ? newSet.delete(itemKey) : newSet.add(itemKey);
				return newSet;
			});
		} else if (input === '2') {
			const itemKey = 'projectStatuses';
			setSelected(prev => {
				const newSet = new Set(prev);
				newSet.has(itemKey) ? newSet.delete(itemKey) : newSet.add(itemKey);
				return newSet;
			});
		} else if (input === '3') {
			const itemKey = 'members';
			setSelected(prev => {
				const newSet = new Set(prev);
				newSet.has(itemKey) ? newSet.delete(itemKey) : newSet.add(itemKey);
				return newSet;
			});
		}
	});

	return (
		<Box flexDirection="column" marginTop={1}>
			{items.map((item, idx) => (
				<Box key={item.key}>
					<Text color={idx === selectedIndex ? 'cyan' : undefined}>
						{idx === selectedIndex ? '❯ ' : '  '}
						{selected.has(item.key) ? '☑' : '☐'} {item.label}
					</Text>
				</Box>
			))}
		</Box>
	);
}

export function setup() {
	render(<SetupWizard />);
}
