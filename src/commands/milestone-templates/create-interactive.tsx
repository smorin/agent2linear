import React, { useState } from 'react';
import { render, Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { createMilestoneTemplate } from '../../lib/milestone-templates.js';
import { getScopeInfo } from '../../lib/scope.js';
import type { MilestoneTemplate, MilestoneDefinition } from '../../lib/types.js';

interface CreateInteractiveOptions {
  global?: boolean;
  project?: boolean;
}

interface MilestoneFormData extends MilestoneDefinition {
  id: number;
}

interface TemplateCreatorProps {
  options: CreateInteractiveOptions;
  onExit: (code: number) => void;
}

const TemplateCreator: React.FC<TemplateCreatorProps> = ({ options, onExit }) => {
  const [step, setStep] = useState<'name' | 'description' | 'milestone-name' | 'milestone-date' | 'milestone-description' | 'add-more' | 'confirm'>('name');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [milestones, setMilestones] = useState<MilestoneFormData[]>([]);
  const [currentMilestone, setCurrentMilestone] = useState<MilestoneFormData>({ id: 0, name: '' });
  const [error, setError] = useState('');

  const { scope, label: scopeLabel } = getScopeInfo(options);

  const handleSubmit = async () => {
    if (milestones.length === 0) {
      setError('At least one milestone is required');
      return;
    }

    const template: MilestoneTemplate = {
      name: templateName,
      milestones: milestones.map(({ id: _id, ...m }) => m),
    };

    if (templateDescription) {
      template.description = templateDescription;
    }

    const result = createMilestoneTemplate(templateName, template, scope);

    if (!result.success) {
      setError(result.error || 'Failed to create template');
      return;
    }

    console.log('\n✅ Milestone template created successfully!\n');
    console.log(`   Template: ${templateName}`);
    console.log(`   Milestones: ${milestones.length}`);
    console.log(`   Scope: ${scopeLabel}\n`);
    console.log('💡 Usage:');
    console.log(`   $ linear-create project create --milestone-template ${templateName}`);
    console.log(`   $ linear-create project add-milestones <project-id> --template ${templateName}`);
    console.log(`   $ linear-create config set defaultMilestoneTemplate ${templateName}\n`);

    onExit(0);
  };

  const addMilestone = () => {
    if (!currentMilestone.name) {
      setError('Milestone name is required');
      return;
    }

    setMilestones([...milestones, currentMilestone]);
    setCurrentMilestone({ id: currentMilestone.id + 1, name: '' });
    setStep('add-more');
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🔨 Create Milestone Template ({scopeLabel})
        </Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {step === 'name' && (
        <Box flexDirection="column">
          <Text>Template name (identifier):</Text>
          <TextInput
            value={templateName}
            onChange={setTemplateName}
            onSubmit={() => {
              if (templateName.trim()) {
                setError('');
                setStep('description');
              } else {
                setError('Template name is required');
              }
            }}
          />
          <Box marginTop={1}>
            <Text dimColor>Example: basic-sprint, product-launch</Text>
          </Box>
        </Box>
      )}

      {step === 'description' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Template name: <Text color="green">{templateName}</Text></Text>
          </Box>
          <Text>Template description (optional, press Enter to skip):</Text>
          <TextInput
            value={templateDescription}
            onChange={setTemplateDescription}
            onSubmit={() => {
              setError('');
              setStep('milestone-name');
            }}
          />
        </Box>
      )}

      {step === 'milestone-name' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Template: <Text color="green">{templateName}</Text></Text>
            {milestones.length > 0 && (
              <Text> ({milestones.length} milestone{milestones.length > 1 ? 's' : ''} added)</Text>
            )}
          </Box>
          <Text>Milestone #{milestones.length + 1} name:</Text>
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
          <Box marginTop={1}>
            <Text dimColor>Example: Planning & Research, Development</Text>
          </Box>
        </Box>
      )}

      {step === 'milestone-date' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Milestone: <Text color="green">{currentMilestone.name}</Text></Text>
          </Box>
          <Text>Target date (optional, press Enter to skip):</Text>
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
          <Box marginBottom={1}>
            <Text>Milestone: <Text color="green">{currentMilestone.name}</Text></Text>
            {currentMilestone.targetDate && (
              <Text> (target: {currentMilestone.targetDate})</Text>
            )}
          </Box>
          <Text>Description (optional, press Enter to skip):</Text>
          <TextInput
            value={currentMilestone.description || ''}
            onChange={(value) => setCurrentMilestone({ ...currentMilestone, description: value })}
            onSubmit={() => {
              addMilestone();
            }}
          />
          <Box marginTop={1}>
            <Text dimColor>Supports markdown. Use \n for newlines.</Text>
          </Box>
        </Box>
      )}

      {step === 'add-more' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>✓ Milestone added: <Text color="green">{milestones[milestones.length - 1].name}</Text></Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>Total milestones: {milestones.length}</Text>
          </Box>
          <Text>Add another milestone? (y/n):</Text>
          <TextInput
            value=""
            onChange={() => {}}
            onSubmit={(value) => {
              const answer = value.toLowerCase();
              if (answer === 'y' || answer === 'yes') {
                setError('');
                setStep('milestone-name');
              } else {
                setStep('confirm');
              }
            }}
          />
        </Box>
      )}

      {step === 'confirm' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Template Summary:</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>  Name: <Text color="green">{templateName}</Text></Text>
          </Box>
          {templateDescription && (
            <Box marginBottom={1}>
              <Text>  Description: {templateDescription}</Text>
            </Box>
          )}
          <Box marginBottom={1}>
            <Text>  Scope: {scopeLabel}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text bold>  Milestones ({milestones.length}):</Text>
          </Box>
          {milestones.map((m, i) => (
            <Box key={m.id} marginLeft={2} marginBottom={1}>
              <Text>
                {i + 1}. <Text color="cyan">{m.name}</Text>
                {m.targetDate && <Text dimColor> ({m.targetDate})</Text>}
                {m.description && <Text dimColor> - {m.description}</Text>}
              </Text>
            </Box>
          ))}
          <Box marginTop={1}>
            <Text>Create this template? (y/n):</Text>
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

export function createTemplateInteractive(options: CreateInteractiveOptions = {}) {
  render(<TemplateCreator options={options} onExit={(code) => process.exit(code)} />);
}
