import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { Initiative } from '../../lib/linear-client.js';
import { getAliasesForId } from '../../lib/aliases.js';

interface InitiativeListProps {
  initiatives: Initiative[];
  onSelect: (initiative: Initiative) => void;
  onCancel: () => void;
}

interface SelectItem {
  key?: string;
  label: string;
  value: Initiative;
}

export function InitiativeList({ initiatives, onSelect, onCancel: _onCancel }: InitiativeListProps) {
  const [searchTerm] = useState('');

  // Convert initiatives to select items
  const items: SelectItem[] = initiatives.map(initiative => {
    const aliases = getAliasesForId('initiative', initiative.id);
    const aliasText = aliases.length > 0 ? ` [aliases: ${aliases.map(a => `@${a}`).join(', ')}]` : '';
    return {
      key: initiative.id,
      label: `${initiative.name} (${initiative.id})${aliasText}`,
      value: initiative,
    };
  });

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
        <Text bold>Select an initiative:</Text>
      </Box>

      {filteredItems.length === 0 ? (
        <Box>
          <Text color="yellow">No initiatives found</Text>
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
