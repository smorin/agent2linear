import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { Member } from '../../lib/linear-client.js';

interface MemberSelectorProps {
  members: Member[];
  onSelect: (member: Member) => void;
  onCancel: () => void;
}

export function MemberSelector({ members, onSelect, onCancel: _onCancel }: MemberSelectorProps) {
  const items = members.map(member => {
    const statusText = !member.active ? ' [Inactive]' : '';
    return {
      key: member.id,
      label: `${member.name} (${member.email}) - ${member.id}${statusText}`,
      value: member,
    };
  });

  const handleSelect = (item: { value: Member }) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select member:</Text>
      </Box>
      <SelectInput items={items} onSelect={handleSelect} />
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to cancel</Text>
      </Box>
    </Box>
  );
}
