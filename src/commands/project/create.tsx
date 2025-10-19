import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { ProjectForm } from '../../ui/components/ProjectForm.js';
import {
  createProject,
  getProjectByName,
  validateInitiativeExists,
  validateTeamExists,
  type ProjectCreateInput,
  type ProjectResult,
} from '../../lib/linear-client.js';
import { getConfig } from '../../lib/config.js';
import { openInBrowser } from '../../lib/browser.js';

interface CreateOptions {
  title?: string;
  description?: string;
  state?: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  initiative?: string;
  team?: string;
  interactive?: boolean;
  web?: boolean;
}

// Non-interactive mode
async function createProjectNonInteractive(options: CreateOptions) {
  try {
    // Validate required fields
    if (!options.title) {
      console.error('❌ Error: --title is required\n');
      console.error('Provide the title:');
      console.error('  linear-create proj create --title "My Project"\n');
      console.error('Or use interactive mode:');
      console.error('  linear-create proj create --interactive\n');
      process.exit(1);
    }

    const title = options.title.trim();

    // Validate title length
    if (title.length < 3) {
      console.error('❌ Error: Title must be at least 3 characters');
      process.exit(1);
    }

    console.log('🔍 Checking for duplicate project name...');

    // Check for duplicates
    const exists = await getProjectByName(title);
    if (exists) {
      console.error(`❌ Error: A project named "${title}" already exists`);
      console.error('   Please choose a different name');
      process.exit(1);
    }

    // Get config for defaults
    const config = getConfig();
    const initiativeId = options.initiative || config.defaultInitiative;
    const teamId = options.team || config.defaultTeam;

    // Validate initiative if provided
    if (initiativeId) {
      console.log(`🔍 Validating initiative: ${initiativeId}...`);
      const initiativeCheck = await validateInitiativeExists(initiativeId);
      if (!initiativeCheck.valid) {
        console.error(`❌ ${initiativeCheck.error}`);
        process.exit(1);
      }
      console.log(`   ✓ Initiative found: ${initiativeCheck.name}`);
    }

    // Validate team if provided
    if (teamId) {
      console.log(`🔍 Validating team: ${teamId}...`);
      const teamCheck = await validateTeamExists(teamId);
      if (!teamCheck.valid) {
        console.error(`❌ ${teamCheck.error}`);
        process.exit(1);
      }
      console.log(`   ✓ Team found: ${teamCheck.name}`);
    }

    console.log('\n🚀 Creating project...');

    // Create the project
    const projectData: ProjectCreateInput = {
      name: title,
      description: options.description,
      state: options.state || 'planned',
      initiativeId,
      teamId,
    };

    const result = await createProject(projectData);

    // Display success message
    displaySuccess(result);
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Interactive mode component
function App({ options: _options }: { options: CreateOptions }) {
  const [projectData, setProjectData] = useState<ProjectCreateInput | null>(null);
  const [result, setResult] = useState<ProjectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [config] = useState(() => getConfig());

  const defaultInitiative = config.defaultInitiative
    ? { id: config.defaultInitiative, name: 'Default Initiative' }
    : undefined;

  const defaultTeam = config.defaultTeam
    ? { id: config.defaultTeam, name: 'Default Team' }
    : undefined;

  useEffect(() => {
    if (!projectData) return;

    async function create() {
      if (!projectData) return; // Additional null check for TypeScript

      try {
        setChecking(true);

        // Check for duplicates
        const exists = await getProjectByName(projectData.name);
        if (exists) {
          setError(`A project named "${projectData.name}" already exists. Please choose a different name.`);
          setChecking(false);
          process.exit(1);
          return;
        }

        // Create the project
        const projectResult = await createProject(projectData);
        setResult(projectResult);
        setChecking(false);

        // Exit after showing success
        setTimeout(() => process.exit(0), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setChecking(false);
        process.exit(1);
      }
    }

    create();
  }, [projectData]);

  if (error) {
    return (
      <Box>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (checking) {
    return (
      <Box>
        <Text>🔍 Checking for duplicates and creating project...</Text>
      </Box>
    );
  }

  if (result) {
    return (
      <Box flexDirection="column">
        <Text color="green" bold>✅ Project created successfully!</Text>
        <Box marginTop={1}>
          <Text>   Name: {result.name}</Text>
        </Box>
        <Box>
          <Text>   ID: {result.id}</Text>
        </Box>
        <Box>
          <Text>   URL: {result.url}</Text>
        </Box>
        <Box>
          <Text>   State: {result.state}</Text>
        </Box>
        {result.initiative && (
          <Box>
            <Text>   Initiative: {result.initiative.name}</Text>
          </Box>
        )}
        {result.team && (
          <Box>
            <Text>   Team: {result.team.name}</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <ProjectForm
      onSubmit={setProjectData}
      defaultInitiative={defaultInitiative}
      defaultTeam={defaultTeam}
    />
  );
}

function displaySuccess(result: ProjectResult) {
  console.log('\n✅ Project created successfully!');
  console.log(`   Name: ${result.name}`);
  console.log(`   ID: ${result.id}`);
  console.log(`   URL: ${result.url}`);
  console.log(`   State: ${result.state}`);

  if (result.initiative) {
    console.log(`   Initiative: ${result.initiative.name}`);
  }

  if (result.team) {
    console.log(`   Team: ${result.team.name}`);
  }

  console.log('');
}

export async function createProjectCommand(options: CreateOptions = {}) {
  // Handle --web flag: open Linear in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear in your browser...');
      await openInBrowser('https://linear.app/');
      console.log('✓ Browser opened. Create your project in Linear.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Please visit https://linear.app/ manually.');
      process.exit(1);
    }
    return;
  }

  // Determine if interactive mode (opt-in with --interactive flag)
  const isInteractive = options.interactive === true;

  if (isInteractive) {
    // Interactive mode with Ink
    render(<App options={options} />);
  } else {
    // Non-interactive mode (default)
    await createProjectNonInteractive(options);
  }
}
