import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { Member } from '../../lib/linear-client.js';
import { getAliasesForId } from '../../lib/aliases.js';

interface MemberListProps {
  members: Member[];
  onSelect?: (member: Member) => void;
  onCancel?: () => void;
}

export function MemberList({ members, onSelect, onCancel }: MemberListProps) {
  const [filterText] = useState('');

  const items = members
    .filter(member => {
      if (!filterText) return true;
      const searchText = filterText.toLowerCase();
      return (
        member.name.toLowerCase().includes(searchText) ||
        member.email.toLowerCase().includes(searchText)
      );
    })
    .map(member => {
      const aliases = getAliasesForId('member', member.id);
      const aliasText = aliases.length > 0 ? ` [${aliases.map(a => `@${a}`).join(', ')}]` : '';
      const statusBadges = [
        !member.active ? '✗ Inactive' : '',
        member.admin ? '⭐ Admin' : '',
      ].filter(Boolean).join(' ');

      return {
        label: `${member.name} (${member.email})${statusBadges ? ` ${statusBadges}` : ''}${aliasText}`,
        value: member,
      };
    });

  const handleSelect = (item: { label: string; value: Member }) => {
    if (onSelect) {
      onSelect(item.value);
    }
  };

  if (members.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No members found.</Text>
        <Text dimColor>Try using --org-wide to see all organization members.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Select a member (use arrow keys):</Text>
      </Box>
      <SelectInput items={items} onSelect={handleSelect} />
      {onCancel && (
        <Box marginTop={1}>
          <Text dimColor>Press Ctrl+C to cancel</Text>
        </Box>
      )}
    </Box>
  );
}
