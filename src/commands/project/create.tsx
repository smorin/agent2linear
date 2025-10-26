import React, { useState, useEffect } from 'react';
import { render, Box, Text } from 'ink';
import { ProjectForm } from '../../ui/components/ProjectForm.js';
import {
  createProject,
  getProjectByName,
  validateInitiativeExists,
  validateTeamExists,
  getTemplateById,
  getCurrentUser,
  getMemberById,
  type ProjectCreateInput,
  type ProjectResult,
} from '../../lib/linear-client.js';
import { getConfig } from '../../lib/config.js';
import { openInBrowser } from '../../lib/browser.js';
import { resolveAlias } from '../../lib/aliases.js';
import { resolveProjectStatusId } from '../../lib/status-cache.js';

interface CreateOptions {
  title?: string;
  description?: string;
  state?: 'planned' | 'started' | 'paused' | 'completed' | 'canceled';
  initiative?: string;
  team?: string;
  template?: string;
  interactive?: boolean;
  web?: boolean;
  // Additional fields
  status?: string;
  content?: string;
  icon?: string;
  color?: string;
  lead?: string;
  noLead?: boolean;
  labels?: string;
  convertedFrom?: string;
  startDate?: string;
  startDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  targetDate?: string;
  targetDateResolution?: 'month' | 'quarter' | 'halfYear' | 'year';
  priority?: number;
  members?: string;
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
      console.error('For all options, see:');
      console.error('  linear-create project create --help\n');
      process.exit(1);
    }

    const title = options.title.trim();

    // Validate title length
    if (title.length < 3) {
      console.error('❌ Error: Title must be at least 3 characters');
      process.exit(1);
    }

    // Get config for defaults
    const config = getConfig();
    let initiativeId = options.initiative || config.defaultInitiative;
    let teamId = options.team || config.defaultTeam;
    let templateId = options.template || config.defaultProjectTemplate;

    // Resolve aliases if provided
    if (initiativeId) {
      const resolvedInitiative = resolveAlias('initiative', initiativeId);
      if (resolvedInitiative !== initiativeId) {
        console.log(`📎 Resolved initiative alias "${initiativeId}" to ${resolvedInitiative}`);
        initiativeId = resolvedInitiative;
      }
    }

    if (teamId) {
      const resolvedTeam = resolveAlias('team', teamId);
      if (resolvedTeam !== teamId) {
        console.log(`📎 Resolved team alias "${teamId}" to ${resolvedTeam}`);
        teamId = resolvedTeam;
      }
    }

    // Resolve template alias if provided
    if (templateId) {
      const resolvedTemplate = resolveAlias('project-template', templateId);
      if (resolvedTemplate !== templateId) {
        console.log(`📎 Resolved project template alias "${templateId}" to ${resolvedTemplate}`);
        templateId = resolvedTemplate;
      }
    }

    // Validate template if provided
    if (templateId) {
      console.log(`🔍 Validating template: ${templateId}...`);
      const template = await getTemplateById(templateId);
      if (!template) {
        console.error(`❌ Template not found: ${templateId}`);
        console.error('   Use "linear-create templates list projects" to see available templates');
        process.exit(1);
      }
      if (template.type !== 'project') {
        console.error(`❌ Template type mismatch: "${template.name}" is a ${template.type} template, not a project template`);
        process.exit(1);
      }
      console.log(`   ✓ Template found: ${template.name}`);
    }

    // Resolve status if provided
    let statusId = options.status;
    if (statusId) {
      console.log(`🔍 Resolving status "${statusId}"...`);

      // Try alias first
      const aliasResolved = resolveAlias('project-status', statusId);

      if (aliasResolved !== statusId) {
        // Alias was found
        statusId = aliasResolved;
        console.log(`   ✓ Resolved alias: ${options.status} → ${statusId}`);
      } else {
        // Try name or ID lookup
        const resolved = await resolveProjectStatusId(statusId);
        if (resolved) {
          if (resolved === statusId) {
            console.log(`   ✓ Using status ID: ${statusId}`);
          } else {
            statusId = resolved;
            console.log(`   ✓ Found status by name: "${options.status}"`);
          }
        } else {
          console.error(`❌ Status not found: "${statusId}"`);
          console.error('   Use "linear-create project-status list" to see available statuses');
          process.exit(1);
        }
      }
    }

    // Validate team is provided (REQUIRED) - check this before doing expensive API calls
    if (!teamId) {
      console.error('❌ Error: Team is required for project creation\n');
      console.error('Please specify a team using one of these options:\n');
      console.error('  1. Use --team flag:');
      console.error(`     $ linear-create proj new --title "${title}" --team team_xxx\n`);
      console.error('  2. Set a default team:');
      console.error('     $ linear-create teams select');
      console.error('     $ linear-create config set defaultTeam team_xxx\n');
      console.error('  3. List available teams:');
      console.error('     $ linear-create teams list\n');
      process.exit(1);
    }

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

    // Validate team
    console.log(`🔍 Validating team: ${teamId}...`);
    const teamCheck = await validateTeamExists(teamId);
    if (!teamCheck.valid) {
      console.error(`❌ ${teamCheck.error}`);
      process.exit(1);
    }
    console.log(`   ✓ Team found: ${teamCheck.name}`);

    console.log('🔍 Checking for duplicate project name...');

    // Check for duplicates
    const exists = await getProjectByName(title);
    if (exists) {
      console.error(`❌ Error: A project named "${title}" already exists`);
      console.error('   Please choose a different name');
      process.exit(1);
    }

    console.log('\n🚀 Creating project...');

    // Parse comma-separated fields
    const labelIds = options.labels
      ? options.labels.split(',').map(id => id.trim()).filter(id => id.length > 0)
      : undefined;

    // Resolve and validate member aliases
    let memberIds: string[] | undefined;
    if (options.members) {
      const rawMembers = options.members.split(',').map(id => id.trim()).filter(id => id.length > 0);

      // Resolve all aliases
      const resolvedMembers = rawMembers.map(id => {
        const resolved = resolveAlias('member', id);
        if (resolved !== id) {
          console.log(`📎 Resolved member alias "${id}" to ${resolved}`);
        }
        return resolved;
      });

      // Validate all members exist
      console.log(`🔍 Validating ${resolvedMembers.length} project member(s)...`);
      for (const memberId of resolvedMembers) {
        try {
          const member = await getMemberById(memberId);
          if (!member) {
            console.error(`❌ Member not found: ${memberId}`);
            process.exit(1);
          }
          console.log(`   ✓ Member found: ${member.name}`);
        } catch (error) {
          console.error(`❌ Member not found: ${memberId}`);
          if (error instanceof Error && error.message) {
            console.error(`   Error: ${error.message}`);
          }
          process.exit(1);
        }
      }

      memberIds = resolvedMembers;
    }

    // Determine project lead
    let leadId: string | undefined;

    if (options.lead) {
      // Explicit lead specified - resolve alias and validate
      const resolvedLead = resolveAlias('member', options.lead);
      if (resolvedLead !== options.lead) {
        console.log(`📎 Resolved member alias "${options.lead}" to ${resolvedLead}`);
      }

      // Validate member exists
      console.log(`🔍 Validating lead member: ${resolvedLead}...`);
      try {
        const member = await getMemberById(resolvedLead);
        if (!member) {
          console.error(`❌ Member not found: ${resolvedLead}`);
          process.exit(1);
        }
        console.log(`   ✓ Member found: ${member.name}`);
        leadId = resolvedLead;
      } catch (error) {
        console.error(`❌ Member not found: ${resolvedLead}`);
        if (error instanceof Error && error.message) {
          console.error(`   Error: ${error.message}`);
        }
        process.exit(1);
      }
    } else if (options.noLead === true) {
      // Explicit no-lead specified - don't assign a lead
      leadId = undefined;
    } else {
      // Check config setting for auto-assign
      const config = getConfig();
      if (config.defaultAutoAssignLead !== false) {  // Default is true
        try {
          const currentUser = await getCurrentUser();
          leadId = currentUser.id;
          console.log(`👤 Auto-assigning lead to: ${currentUser.name}`);
        } catch (error) {
          console.warn(`⚠️  Warning: Could not auto-assign lead: ${error instanceof Error ? error.message : 'Unknown error'}`);
          console.warn('   Continuing without lead assignment.');
          leadId = undefined;
        }
      }
    }

    // Create the project
    const projectData: ProjectCreateInput = {
      name: title,
      description: options.description,
      state: options.state || 'planned',
      initiativeId,
      teamId,
      templateId,
      // Additional fields
      statusId,
      content: options.content,
      icon: options.icon,
      color: options.color,
      leadId,
      labelIds,
      convertedFromIssueId: options.convertedFrom,
      startDate: options.startDate,
      startDateResolution: options.startDateResolution,
      targetDate: options.targetDate,
      targetDateResolution: options.targetDateResolution,
      priority: options.priority,
      memberIds,
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

        // Auto-assign lead if not already set and config allows
        const finalProjectData = { ...projectData };
        if (!finalProjectData.leadId && config.defaultAutoAssignLead !== false) {
          try {
            const currentUser = await getCurrentUser();
            finalProjectData.leadId = currentUser.id;
          } catch {
            // Silently continue without lead if user fetch fails
          }
        }

        // Create the project
        const projectResult = await createProject(finalProjectData);
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
