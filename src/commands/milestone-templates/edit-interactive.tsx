import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { getMilestoneTemplate, updateMilestoneTemplate } from '../../lib/milestone-templates.js';
import { getScopeInfo } from '../../lib/scope.js';
import type { MilestoneTemplate, MilestoneDefinition } from '../../lib/types.js';

interface EditInteractiveOptions {
  global?: boolean;
  project?: boolean;
}

interface MilestoneFormData extends MilestoneDefinition {
  id: number;
}

interface TemplateEditorProps {
  templateName: string;
  options: EditInteractiveOptions;
  onExit: (code: number) => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ templateName, options, onExit }) => {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'menu' | 'description' | 'milestone-select' | 'milestone-name' | 'milestone-date' | 'milestone-description' | 'add-milestone-name' | 'add-milestone-date' | 'add-milestone-description' | 'confirm'>('menu');
  const [templateDescription, setTemplateDescription] = useState('');
  const [milestones, setMilestones] = useState<MilestoneFormData[]>([]);
  const [editIndex, setEditIndex] = useState(-1);
  const [currentMilestone, setCurrentMilestone] = useState<MilestoneFormData>({ id: 0, name: '' });
  const [error, setError] = useState('');
  const [scope, setScope] = useState<'global' | 'project'>('global');
  const [scopeLabel, setScopeLabel] = useState('');

  React.useEffect(() => {
    // Load existing template
    const existing = getMilestoneTemplate(templateName);
    if (!existing) {
      setError(`Template "${templateName}" not found`);
      setTimeout(() => onExit(1), 2000);
      return;
    }

    // Determine scope
    let targetScope: 'global' | 'project';
    let targetScopeLabel: string;

    if (options.global || options.project) {
      const scopeInfo = getScopeInfo(options);
      targetScope = scopeInfo.scope;
      targetScopeLabel = scopeInfo.label;

      // Verify template exists in this scope
      if (existing.source !== targetScope) {
        setError(`Template "${templateName}" exists in ${existing.source} scope, not ${targetScope}`);
        setTimeout(() => onExit(1), 2000);
        return;
      }
    } else {
      // Use detected scope
      targetScope = existing.source;
      targetScopeLabel = existing.source === 'global' ? 'Global' : 'Project';
    }

    setScope(targetScope);
    setScopeLabel(targetScopeLabel);
    setTemplateDescription(existing.template.description || '');
    setMilestones(existing.template.milestones.map((m, i) => ({ ...m, id: i })));
    setLoading(false);
  }, [templateName, options, onExit]);

  const handleSubmit = async () => {
    const template: MilestoneTemplate = {
      name: templateName,
      milestones: milestones.map(({ id: _id, ...m }) => m),
    };

    if (templateDescription) {
      template.description = templateDescription;
    }

    const result = updateMilestoneTemplate(templateName, template, scope);

    if (!result.success) {
      setError(result.error || 'Failed to update template');
      return;
    }

    console.log('\n✅ Milestone template updated successfully!\n');
    console.log(`   Template: ${templateName}`);
    console.log(`   Milestones: ${milestones.length}`);
    console.log(`   Scope: ${scopeLabel}\n`);

    onExit(0);
  };

  const addNewMilestone = () => {
    if (!currentMilestone.name) {
      setError('Milestone name is required');
      return;
    }

    setMilestones([...milestones, { ...currentMilestone, id: milestones.length }]);
    setCurrentMilestone({ id: 0, name: '' });
    setStep('menu');
  };

  const updateExistingMilestone = () => {
    const updated = [...milestones];
    updated[editIndex] = currentMilestone;
    setMilestones(updated);
    setEditIndex(-1);
    setStep('menu');
  };

  // Reserved for future milestone deletion feature
  // const deleteMilestone = (index: number) => {
  //   const updated = milestones.filter((_, i) => i !== index);
  //   setMilestones(updated.map((m, i) => ({ ...m, id: i })));
  // };

  if (loading) {
    return (
      <Box padding={1}>
        <Text>Loading template...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1}>
        <Text color="red">❌ {error}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ✏️  Edit Milestone Template: {templateName} ({scopeLabel})
        </Text>
      </Box>

      {step === 'menu' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Current template:</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  Description: {templateDescription || <Text dimColor>(none)</Text>}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>  Milestones ({milestones.length}):</Text>
          </Box>
          {milestones.map((m, i) => (
            <Box key={m.id} marginLeft={2} marginBottom={1}>
              <Text>
                {i + 1}. <Text color="cyan">{m.name}</Text>
                {m.targetDate && <Text dimColor> ({m.targetDate})</Text>}
              </Text>
            </Box>
          ))}
          <Box marginTop={1} marginBottom={1}>
            <Text bold>What would you like to do?</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  1. Edit template description</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  2. Edit a milestone</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  3. Add a milestone</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  4. Delete a milestone</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  5. Save and exit</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  6. Cancel</Text>
          </Box>
          <TextInput
            value=""
            onChange={() => {}}
            onSubmit={(value) => {
              setError('');
              switch (value) {
                case '1':
                  setStep('description');
                  break;
                case '2':
                  setStep('milestone-select');
                  break;
                case '3':
                  setCurrentMilestone({ id: milestones.length, name: '' });
                  setStep('add-milestone-name');
                  break;
                case '4':
                  if (milestones.length === 0) {
                    setError('No milestones to delete');
                  } else {
                    setStep('milestone-select');
                  }
                  break;
                case '5':
                  setStep('confirm');
                  break;
                case '6':
                  console.log('\n❌ Cancelled\n');
                  onExit(0);
                  break;
                default:
                  setError('Invalid option. Please enter 1-6.');
              }
            }}
          />
        </Box>
      )}

      {step === 'description' && (
        <Box flexDirection="column">
          <Text>Template description (current: {templateDescription || 'none'}):</Text>
          <TextInput
            value={templateDescription}
            onChange={setTemplateDescription}
            onSubmit={() => {
              setError('');
              setStep('menu');
            }}
          />
        </Box>
      )}

      {step === 'milestone-select' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Select milestone number (1-{milestones.length}):</Text>
          </Box>
          {milestones.map((m, i) => (
            <Box key={m.id} marginBottom={1}>
              <Text>
                {i + 1}. <Text color="cyan">{m.name}</Text>
                {m.targetDate && <Text dimColor> ({m.targetDate})</Text>}
              </Text>
            </Box>
          ))}
          <TextInput
            value=""
            onChange={() => {}}
            onSubmit={(value) => {
              const num = parseInt(value, 10);
              if (num > 0 && num <= milestones.length) {
                setError('');
                setEditIndex(num - 1);
                setCurrentMilestone({ ...milestones[num - 1] });
                setStep('milestone-name');
              } else {
                setError(`Please enter a number between 1 and ${milestones.length}`);
              }
            }}
          />
        </Box>
      )}

      {step === 'milestone-name' && (
        <Box flexDirection="column">
          <Text>Milestone name (current: {milestones[editIndex].name}):</Text>
          <TextInput
            value={currentMilestone.name}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, name: value })}
            onSubmit={() => {
              if (currentMilestone.name.trim()) {
                setError('');
                setStep('milestone-date');
              } else {
                setError('Milestone name is required');
              }
            }}
          />
        </Box>
      )}

      {step === 'milestone-date' && (
        <Box flexDirection="column">
          <Text>Target date (current: {milestones[editIndex].targetDate || 'none'}):</Text>
          <TextInput
            value={currentMilestone.targetDate || ''}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, targetDate: value })}
            onSubmit={() => {
              setError('');
              setStep('milestone-description');
            }}
          />
          <Box marginTop={1}>
            <Text dimColor>Examples: +7d, +2w, +1m, 2025-12-31</Text>
          </Box>
        </Box>
      )}

      {step === 'milestone-description' && (
        <Box flexDirection="column">
          <Text>Description (current: {milestones[editIndex].description || 'none'}):</Text>
          <TextInput
            value={currentMilestone.description || ''}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, description: value })}
            onSubmit={() => {
              updateExistingMilestone();
            }}
          />
        </Box>
      )}

      {step === 'add-milestone-name' && (
        <Box flexDirection="column">
          <Text>New milestone name:</Text>
          <TextInput
            value={currentMilestone.name}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, name: value })}
            onSubmit={() => {
              if (currentMilestone.name.trim()) {
                setError('');
                setStep('add-milestone-date');
              } else {
                setError('Milestone name is required');
              }
            }}
          />
        </Box>
      )}

      {step === 'add-milestone-date' && (
        <Box flexDirection="column">
          <Text>Target date (optional):</Text>
          <TextInput
            value={currentMilestone.targetDate || ''}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, targetDate: value })}
            onSubmit={() => {
              setError('');
              setStep('add-milestone-description');
            }}
          />
          <Box marginTop={1}>
            <Text dimColor>Examples: +7d, +2w, +1m, 2025-12-31</Text>
          </Box>
        </Box>
      )}

      {step === 'add-milestone-description' && (
        <Box flexDirection="column">
          <Text>Description (optional):</Text>
          <TextInput
            value={currentMilestone.description || ''}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, description: value })}
            onSubmit={() => {
              addNewMilestone();
            }}
          />
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Save changes?</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>Template: <Text color="green">{templateName}</Text></Text>
          </Box>
          <Box marginBottom={1}>
            <Text>Milestones: {milestones.length}</Text>
          </Box>
          <TextInput
            value=""
            onChange={() => {}}
            onSubmit={(value) => {
              const answer = value.toLowerCase();
              if (answer === 'y' || answer === 'yes') {
                handleSubmit();
              } else {
                console.log('\n❌ Cancelled\n');
                onExit(0);
              }
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export function editTemplateInteractive(templateName: string, options: EditInteractiveOptions = {}) {
  render(<TemplateEditor templateName={templateName} options={options} onExit={(code) => process.exit(code)} />);
}
