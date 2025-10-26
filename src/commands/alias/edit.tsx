import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import {
  loadAliases,
  updateAliasId,
  renameAlias,
  removeAlias,
  addAlias,
} from '../../lib/aliases.js';
import type { AliasEntityType } from '../../lib/types.js';
import {
  validateInitiativeExists,
  validateTeamExists,
  getProjectById,
  getTemplateById,
  getAllInitiatives,
  getAllTeams,
  getAllProjects,
  getAllTemplates,
  type Initiative,
  type Team,
  type Project,
  type Template,
} from '../../lib/linear-client.js';

interface EditOptions {
  global?: boolean;
  project?: boolean;
}

type EditStep = 'scope' | 'type' | 'selectAlias' | 'action' | 'done';
type ActionType = 'keep' | 'changeId' | 'rename' | 'delete';

interface AliasInfo {
  alias: string;
  id: string;
  type: AliasEntityType;
  scope: 'global' | 'project';
}

function AliasEditor({ options }: { options: EditOptions }) {
  const [step, setStep] = useState<EditStep>('scope');
  const [scope, setScope] = useState<'global' | 'project' | null>(
    options.global ? 'global' : options.project ? 'project' : null
  );
  const [entityType, setEntityType] = useState<AliasEntityType | null>(null);
  const [selectedAlias, setSelectedAlias] = useState<AliasInfo | null>(null);

  // State for editing
  const [editingId, setEditingId] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [idError, setIdError] = useState('');

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState('');

  // State for adding new aliases
  const [addingAlias, setAddingAlias] = useState(false);
  const [addStep, setAddStep] = useState<'name' | 'selectEntity' | null>(null);
  const [newAliasName, setNewAliasName] = useState('');
  const [addAliasError, setAddAliasError] = useState('');

  // Entity selection for adding aliases (mirroring config/edit.tsx pattern)
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [loadingInitiatives, setLoadingInitiatives] = useState(false);
  const [initiativeError, setInitiativeError] = useState('');

  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [teamError, setTeamError] = useState('');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState('');

  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState('');

  // If scope is already determined, skip to type selection
  React.useEffect(() => {
    if (scope !== null && step === 'scope') {
      setStep('type');
    }
  }, [scope, step]);

  const handleScopeSelect = (item: { value: 'global' | 'project' }) => {
    setScope(item.value);
    setStep('type');
  };

  const handleTypeSelect = (item: { value: AliasEntityType }) => {
    setEntityType(item.value);
    setStep('selectAlias');
  };

  const handleAliasSelect = (item: { value: string }) => {
    if (!entityType || !scope) return;

    // Check if user selected "Add new alias"
    if (item.value === '__ADD_NEW__') {
      setAddingAlias(true);
      setAddStep('name');
      return;
    }

    // Get the ID for this alias
    const aliases = loadAliases();
    const key =
      entityType === 'initiative' ? 'initiatives' :
      entityType === 'team' ? 'teams' :
      entityType === 'project' ? 'projects' :
      entityType === 'issue-template' ? 'issueTemplates' :
      entityType === 'project-template' ? 'projectTemplates' :
      'projects'; // fallback
    const id = aliases[key][item.value];

    if (!id) {
      console.error(`\n❌ Error: Could not find ID for alias "${item.value}"\n`);
      process.exit(1);
    }

    setSelectedAlias({
      alias: item.value,
      id,
      type: entityType,
      scope,
    });
    setStep('action');
  };

  const handleActionSelect = (item: { value: ActionType }) => {
    if (item.value === 'keep') {
      // Go back to alias selection to edit another one
      setSelectedAlias(null);
      setStep('selectAlias');
    } else if (item.value === 'changeId') {
      setEditingId(true);
    } else if (item.value === 'rename') {
      setEditingName(true);
    } else if (item.value === 'delete') {
      handleDelete();
    }
  };

  const handleIdSubmit = async () => {
    if (!selectedAlias) return;

    if (!idInput.trim()) {
      setIdError('ID cannot be empty');
      return;
    }

    // Validate ID based on entity type
    try {
      let isValid = false;
      let entityName = '';

      if (selectedAlias.type === 'initiative') {
        const result = await validateInitiativeExists(idInput);
        isValid = result.valid;
        entityName = result.name || '';
        if (!isValid) {
          setIdError(result.error || 'Invalid initiative ID');
          return;
        }
      } else if (selectedAlias.type === 'team') {
        const result = await validateTeamExists(idInput);
        isValid = result.valid;
        entityName = result.name || '';
        if (!isValid) {
          setIdError(result.error || 'Invalid team ID');
          return;
        }
      } else if (selectedAlias.type === 'project') {
        const project = await getProjectById(idInput);
        if (!project) {
          setIdError('Project not found');
          return;
        }
        isValid = true;
        entityName = project.name;
      } else if (selectedAlias.type === 'issue-template' || selectedAlias.type === 'project-template') {
        const template = await getTemplateById(idInput);
        if (!template) {
          setIdError('Template not found');
          return;
        }
        // Validate template type matches
        const expectedType = selectedAlias.type === 'issue-template' ? 'issue' : 'project';
        if (template.type !== expectedType) {
          setIdError(`Template is a ${template.type} template, but alias is for ${expectedType} templates`);
          return;
        }
        isValid = true;
        entityName = template.name;
      }

      if (!isValid) {
        setIdError('Invalid entity ID');
        return;
      }

      // Update the alias
      const result = await updateAliasId(
        selectedAlias.type,
        selectedAlias.alias,
        idInput,
        selectedAlias.scope,
        { skipValidation: true } // We already validated
      );

      if (!result.success) {
        setIdError(result.error || 'Failed to update alias');
        return;
      }

      console.log(`\n✅ Alias updated successfully!`);
      console.log(`   Alias: ${selectedAlias.alias}`);
      console.log(`   Old ID: ${result.oldId}`);
      console.log(`   New ID: ${idInput}`);
      if (entityName) {
        console.log(`   Entity: ${entityName}`);
      }
      console.log(`   Scope: ${selectedAlias.scope}\n`);

      // Reset and go back to alias selection
      setEditingId(false);
      setIdInput('');
      setIdError('');
      setSelectedAlias(null);
      setStep('selectAlias');
    } catch (error) {
      setIdError(error instanceof Error ? error.message : 'Validation failed');
    }
  };

  const handleNameSubmit = () => {
    if (!selectedAlias) return;

    if (!nameInput.trim()) {
      setNameError('Alias name cannot be empty');
      return;
    }

    if (nameInput.includes(' ')) {
      setNameError('Alias cannot contain spaces');
      return;
    }

    // Rename the alias
    const result = renameAlias(
      selectedAlias.type,
      selectedAlias.alias,
      nameInput,
      selectedAlias.scope
    );

    if (!result.success) {
      setNameError(result.error || 'Failed to rename alias');
      return;
    }

    console.log(`\n✅ Alias renamed successfully!`);
    console.log(`   Old name: ${selectedAlias.alias}`);
    console.log(`   New name: ${nameInput}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Scope: ${selectedAlias.scope}\n`);

    // Reset and go back to alias selection
    setEditingName(false);
    setNameInput('');
    setNameError('');
    setSelectedAlias(null);
    setStep('selectAlias');
  };

  const handleDelete = () => {
    if (!selectedAlias) return;

    const result = removeAlias(
      selectedAlias.type,
      selectedAlias.alias,
      selectedAlias.scope
    );

    if (!result.success) {
      console.error(`\n❌ ${result.error}\n`);
      process.exit(1);
    }

    console.log(`\n✅ Alias deleted successfully!`);
    console.log(`   Alias: ${selectedAlias.alias}`);
    console.log(`   ID was: ${result.id}`);
    console.log(`   Scope: ${selectedAlias.scope}\n`);

    // Reset and go back to alias selection
    setSelectedAlias(null);
    setStep('selectAlias');
  };

  // Handler for empty state menu (Add new / Go back)
  const handleEmptyStateSelect = (item: { value: string }) => {
    if (item.value === 'add') {
      setAddingAlias(true);
      setAddStep('name');
    } else if (item.value === 'back') {
      setStep('type');
    }
  };

  // Handler for new alias name submit
  const handleNewAliasNameSubmit = async () => {
    if (!entityType || !scope) return;

    // Validate name
    if (!newAliasName.trim()) {
      setAddAliasError('Alias name cannot be empty');
      return;
    }

    if (newAliasName.includes(' ')) {
      setAddAliasError('Alias cannot contain spaces');
      return;
    }

    // Check if alias already exists
    const aliases = loadAliases();
    const key =
      entityType === 'initiative' ? 'initiatives' :
      entityType === 'team' ? 'teams' :
      entityType === 'project' ? 'projects' :
      entityType === 'issue-template' ? 'issueTemplates' :
      entityType === 'project-template' ? 'projectTemplates' :
      'projects'; // fallback
    const scopedAliases = Object.entries(aliases[key]).filter(([alias]) => {
      const location = aliases.locations[entityType as AliasEntityType]?.[alias];
      return location && location.type === scope;
    });

    const existingAlias = scopedAliases.find(([alias]) => alias === newAliasName);
    if (existingAlias) {
      setAddAliasError(`Alias "${newAliasName}" already exists in ${scope} scope`);
      return;
    }

    // Move to entity selection and fetch entities
    setAddAliasError('');
    setAddStep('selectEntity');

    // Fetch entities based on type (mirroring config/edit.tsx pattern)
    if (entityType === 'initiative') {
      setLoadingInitiatives(true);
      try {
        const data = await getAllInitiatives();
        setInitiatives(data);
        setLoadingInitiatives(false);
      } catch (error) {
        setInitiativeError(error instanceof Error ? error.message : 'Failed to fetch initiatives');
        setLoadingInitiatives(false);
      }
    } else if (entityType === 'team') {
      setLoadingTeams(true);
      try {
        const data = await getAllTeams();
        setTeams(data);
        setLoadingTeams(false);
      } catch (error) {
        setTeamError(error instanceof Error ? error.message : 'Failed to fetch teams');
        setLoadingTeams(false);
      }
    } else if (entityType === 'project') {
      setLoadingProjects(true);
      try {
        const data = await getAllProjects();
        setProjects(data);
        setLoadingProjects(false);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : 'Failed to fetch projects');
        setLoadingProjects(false);
      }
    } else if (entityType === 'issue-template') {
      setLoadingTemplates(true);
      try {
        const data = await getAllTemplates('issue');
        setTemplates(data);
        setLoadingTemplates(false);
      } catch (error) {
        setTemplateError(error instanceof Error ? error.message : 'Failed to fetch issue templates');
        setLoadingTemplates(false);
      }
    } else if (entityType === 'project-template') {
      setLoadingTemplates(true);
      try {
        const data = await getAllTemplates('project');
        setTemplates(data);
        setLoadingTemplates(false);
      } catch (error) {
        setTemplateError(error instanceof Error ? error.message : 'Failed to fetch project templates');
        setLoadingTemplates(false);
      }
    }
  };

  // Handler for entity selection in add flow
  const handleEntitySelect = async (item: { value: string }) => {
    if (!entityType || !scope) return;

    const entityId = item.value;

    // Add the alias
    try {
      const result = await addAlias(entityType, newAliasName, entityId, scope, {
        skipValidation: true, // Already fetched from Linear, so it exists
      });

      if (!result.success) {
        console.error(`\n❌ ${result.error}\n`);
        setAddAliasError(result.error || 'Failed to add alias');
        return;
      }

      console.log(`\n✅ Alias added successfully!`);
      console.log(`   Alias: ${newAliasName}`);
      console.log(`   ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} ID: ${entityId}`);
      if (result.entityName) {
        console.log(`   Name: ${result.entityName}`);
      }
      console.log(`   Scope: ${scope}\n`);

      // Reset add flow state and return to alias selection
      setAddingAlias(false);
      setAddStep(null);
      setNewAliasName('');
      setAddAliasError('');
      setInitiatives([]);
      setTeams([]);
      setProjects([]);
      setStep('selectAlias');
    } catch (error) {
      setAddAliasError(error instanceof Error ? error.message : 'Failed to add alias');
    }
  };

  if (step === 'done') {
    return null;
  }

  // Step 1: Select scope
  if (step === 'scope') {
    const scopeItems = [
      { label: 'Global (~/.config/linear-create/aliases.json)', value: 'global' as const },
      { label: 'Project (.linear-create/aliases.json)', value: 'project' as const },
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Select alias scope to edit:</Text>
        <SelectInput items={scopeItems} onSelect={handleScopeSelect} />
      </Box>
    );
  }

  // Step 2: Select entity type
  if (step === 'type') {
    const typeItems = [
      { label: 'Initiative aliases', value: 'initiative' as const },
      { label: 'Team aliases', value: 'team' as const },
      { label: 'Project aliases', value: 'project' as const },
      { label: 'Issue Template aliases', value: 'issue-template' as const },
      { label: 'Project Template aliases', value: 'project-template' as const },
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Select entity type:</Text>
        <SelectInput items={typeItems} onSelect={handleTypeSelect} />
        <Text dimColor>(Press Ctrl+C to cancel)</Text>
      </Box>
    );
  }

  // Add alias flow (name input + entity selection) - Check BEFORE selectAlias step
  if (addingAlias && entityType && scope) {
    // Step 1: Name input
    if (addStep === 'name') {
      return (
        <Box flexDirection="column">
          <Text bold>Add new {entityType} alias</Text>
          <Text dimColor>Scope: {scope}</Text>
          {addAliasError && <Text color="red">{addAliasError}</Text>}
          <Text>Enter alias name:</Text>
          <TextInput
            value={newAliasName}
            placeholder="e.g., backend, frontend, api"
            onChange={setNewAliasName}
            onSubmit={handleNewAliasNameSubmit}
          />
          <Text dimColor>(Press Enter to continue, Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    // Step 2: Entity selection
    if (addStep === 'selectEntity') {
      // Show loading state
      if (loadingInitiatives || loadingTeams || loadingProjects || loadingTemplates) {
        return (
          <Box>
            <Text>🔄 Loading {entityType}s...</Text>
          </Box>
        );
      }

      // Show error if fetch failed
      if (initiativeError || teamError || projectError || templateError) {
        const error = initiativeError || teamError || projectError || templateError;
        return (
          <Box flexDirection="column">
            <Text color="red">❌ Error: {error}</Text>
            <Text dimColor>(Press Ctrl+C to exit)</Text>
          </Box>
        );
      }

      // Build entity list based on type (mirroring config/edit.tsx pattern)
      let entityItems: Array<{ label: string; value: string }> = [];

      if (entityType === 'initiative' && initiatives.length > 0) {
        entityItems = initiatives.map(init => ({
          label: `${init.name} (${init.id})`,
          value: init.id,
        }));
      } else if (entityType === 'team' && teams.length > 0) {
        entityItems = teams.map(team => ({
          label: `${team.name} (${team.id})`,
          value: team.id,
        }));
      } else if (entityType === 'project' && projects.length > 0) {
        entityItems = projects.map(proj => ({
          label: `${proj.name} (${proj.id})`,
          value: proj.id,
        }));
      } else if ((entityType === 'issue-template' || entityType === 'project-template') && templates.length > 0) {
        entityItems = templates.map(tmpl => ({
          label: `${tmpl.name} (${tmpl.id})`,
          value: tmpl.id,
        }));
      }

      if (entityItems.length === 0) {
        return (
          <Box flexDirection="column">
            <Text color="yellow">⚠️  No {entityType}s found in your Linear workspace.</Text>
            <Text dimColor>(Press Ctrl+C to exit)</Text>
          </Box>
        );
      }

      return (
        <Box flexDirection="column">
          <Text bold>Select {entityType} for alias "{newAliasName}":</Text>
          <SelectInput items={entityItems} onSelect={handleEntitySelect} />
          <Text dimColor>(Press Ctrl+C to cancel)</Text>
        </Box>
      );
    }
  }

  // Step 3: Select alias to edit
  if (step === 'selectAlias') {
    if (!entityType || !scope) return null;

    const aliases = loadAliases();
    const key =
      entityType === 'initiative' ? 'initiatives' :
      entityType === 'team' ? 'teams' :
      entityType === 'project' ? 'projects' :
      entityType === 'issue-template' ? 'issueTemplates' :
      entityType === 'project-template' ? 'projectTemplates' :
      'projects'; // fallback
    const typeAliases = aliases[key];
    const locations = aliases.locations[entityType as AliasEntityType];

    // Filter by scope
    const scopedAliases = Object.entries(typeAliases).filter(([alias]) => {
      const location = locations?.[alias];
      return location && location.type === scope;
    });

    if (scopedAliases.length === 0) {
      // Empty state: offer to add new or go back
      const emptyStateItems = [
        { label: '➕ Add new alias', value: 'add' },
        { label: '← Go back to type selection', value: 'back' },
      ];

      return (
        <Box flexDirection="column">
          <Text color="yellow">⚠️  No {entityType} aliases found in {scope} scope.</Text>
          <Text bold>What would you like to do?</Text>
          <SelectInput items={emptyStateItems} onSelect={handleEmptyStateSelect} />
          <Text dimColor>(Press Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    // Build alias list with "Add new" option at the end
    const aliasItems = [
      ...scopedAliases.map(([alias, id]) => ({
        label: `${alias} → ${id}`,
        value: alias,
      })),
      { label: '➕ Add new alias...', value: '__ADD_NEW__' },
    ];

    return (
      <Box flexDirection="column">
        <Text bold>Select alias to edit ({scope} {entityType}):</Text>
        <SelectInput items={aliasItems} onSelect={handleAliasSelect} />
        <Text dimColor>(Press Ctrl+C to cancel)</Text>
      </Box>
    );
  }

  // Step 4: Choose action for selected alias
  if (step === 'action') {
    if (!selectedAlias) return null;

    // If editing ID
    if (editingId) {
      return (
        <Box flexDirection="column">
          <Text bold>Enter new ID for "{selectedAlias.alias}":</Text>
          <Text dimColor>Current ID: {selectedAlias.id}</Text>
          {idError && <Text color="red">{idError}</Text>}
          <TextInput
            value={idInput}
            placeholder={`Enter new ${selectedAlias.type} ID`}
            onChange={setIdInput}
            onSubmit={handleIdSubmit}
          />
          <Text dimColor>(Press Enter to save, Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    // If renaming alias
    if (editingName) {
      return (
        <Box flexDirection="column">
          <Text bold>Enter new name for alias:</Text>
          <Text dimColor>Current name: {selectedAlias.alias}</Text>
          <Text dimColor>Points to: {selectedAlias.id}</Text>
          {nameError && <Text color="red">{nameError}</Text>}
          <TextInput
            value={nameInput}
            placeholder="Enter new alias name"
            onChange={setNameInput}
            onSubmit={handleNameSubmit}
          />
          <Text dimColor>(Press Enter to save, Ctrl+C to cancel)</Text>
        </Box>
      );
    }

    // Action selection
    const actionItems = [
      { label: `Keep "${selectedAlias.alias}" (edit another)`, value: 'keep' as const },
      { label: `Change ID (currently: ${selectedAlias.id})`, value: 'changeId' as const },
      { label: `Rename alias (currently: ${selectedAlias.alias})`, value: 'rename' as const },
      { label: `Delete alias "${selectedAlias.alias}"`, value: 'delete' as const },
    ];

    return (
      <Box flexDirection="column">
        <Text bold>What would you like to do with "{selectedAlias.alias}"?</Text>
        <SelectInput items={actionItems} onSelect={handleActionSelect} />
        <Text dimColor>(Press Ctrl+C to cancel)</Text>
      </Box>
    );
  }

  return null;
}

export async function editAlias(options: EditOptions = {}) {
  render(<AliasEditor options={options} />);
}
