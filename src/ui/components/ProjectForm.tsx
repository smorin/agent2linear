import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import type { ProjectCreateInput } from '../../lib/linear-client.js';

type Step = 'title' | 'description' | 'state' | 'complete';

interface ProjectFormProps {
  onSubmit: (data: ProjectCreateInput) => void;
  defaultInitiative?: { id: string; name: string };
  defaultTeam?: { id: string; name: string };
}

const STATE_OPTIONS = [
  { key: 'planned', label: 'Planned', value: 'planned' },
  { key: 'started', label: 'Started', value: 'started' },
  { key: 'paused', label: 'Paused', value: 'paused' },
  { key: 'completed', label: 'Completed', value: 'completed' },
  { key: 'canceled', label: 'Canceled', value: 'canceled' },
];

export function ProjectForm({ onSubmit, defaultInitiative, defaultTeam }: ProjectFormProps) {
  const [step, setStep] = useState<Step>('title');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleTitleSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setError('Title must be at least 3 characters');
      return;
    }
    setError(null);
    setTitle(trimmed);
    setStep('description');
  };

  const handleDescriptionSubmit = (value: string) => {
    setDescription(value.trim());
    setStep('state');
  };

  const handleStateSelect = (item: { value: string }) => {
    setStep('complete');

    // Submit the form
    const projectData: ProjectCreateInput = {
      name: title,
      description: description || undefined,
      state: item.value as ProjectCreateInput['state'],
      initiativeId: defaultInitiative?.id,
      teamId: defaultTeam?.id,
    };

    onSubmit(projectData);
  };

  if (step === 'complete') {
    return (
      <Box>
        <Text>Creating project...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Create a new Linear project</Text>
      </Box>

      {error && (
        <Box marginBottom={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      {step === 'title' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Project title (minimum 3 characters):</Text>
          </Box>
          <Box>
            <Text color="cyan">&gt; </Text>
            <TextInput value={title} onChange={setTitle} onSubmit={handleTitleSubmit} />
          </Box>
        </Box>
      )}

      {step === 'description' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text dimColor>Title: {title}</Text>
          </Box>
          <Box marginBottom={1}>
            <Text>Description (optional, press Enter to skip):</Text>
          </Box>
          <Box>
            <Text color="cyan">&gt; </Text>
            <TextInput value={description} onChange={setDescription} onSubmit={handleDescriptionSubmit} />
          </Box>
        </Box>
      )}

      {step === 'state' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text dimColor>Title: {title}</Text>
            {description && <Text dimColor>Description: {description}</Text>}
          </Box>
          <Box marginBottom={1}>
            <Text>Select project state:</Text>
          </Box>
          <SelectInput items={STATE_OPTIONS} onSelect={handleStateSelect} />
        </Box>
      )}

      {defaultInitiative && (
        <Box marginTop={1}>
          <Text dimColor>Will be linked to: {defaultInitiative.name}</Text>
        </Box>
      )}

      {defaultTeam && (
        <Box>
          <Text dimColor>Team: {defaultTeam.name}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to cancel</Text>
      </Box>
    </Box>
  );
}
