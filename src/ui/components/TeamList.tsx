import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { Team } from '../../lib/linear-client.js';

interface TeamListProps {
  teams: Team[];
  onSelect: (team: Team) => void;
  onCancel: () => void;
}

interface SelectItem {
  key?: string;
  label: string;
  value: Team;
}

export function TeamList({ teams, onSelect, onCancel: _onCancel }: TeamListProps) {
  const [searchTerm] = useState('');

  // Convert teams to select items
  const items: SelectItem[] = teams.map(team => ({
    key: team.id,
    label: `${team.name} (${team.id})`,
    value: team,
  }));

  // Filter items based on search term
  const filteredItems = searchTerm
    ? items.filter(item => item.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : items;

  const handleSelect = (item: SelectItem) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select a team:</Text>
      </Box>

      {filteredItems.length === 0 ? (
        <Box>
          <Text color="yellow">No teams found</Text>
        </Box>
      ) : (
        <SelectInput items={filteredItems} onSelect={handleSelect} />
      )}

      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to cancel</Text>
      </Box>
    </Box>
  );
}
