import { Box, render, Text } from 'ink';
import React, { useEffect, useState } from 'react';

import { getAliasesForId } from '../../lib/aliases.js';
import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';
import { isAuthenticationError } from '../../lib/cli-error.js';
import { getConfig } from '../../lib/config.js';
import { requireInteractiveInput } from '../../lib/interaction-policy.js';
import { getAllMembers, type Member } from '../../lib/linear-client.js';
import { filterColumns,formatListJSON, formatListTSV } from '../../lib/output.js';

interface ListOptions {
  interactive?: boolean;
  web?: boolean;
  format?: 'tsv' | 'json';
  team?: string;
  orgWide?: boolean;
  name?: string;
  email?: string;
  active?: boolean;
  inactive?: boolean;
  admin?: boolean;
  columns?: string;
}

function App({ options }: { options: ListOptions }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMembers() {
      try {
        const config = getConfig();
        let teamId = options.team;

        // Use default team if not specified and not org-wide
        if (!options.orgWide && !teamId) {
          teamId = config.defaultTeam;
        }

        // Resolve team alias if provided
        if (teamId) {
          teamId = resolveAlias('team', teamId);
        }

        const data = await getAllMembers({
          teamId: options.orgWide ? undefined : teamId,
          activeOnly: options.active,
          inactiveOnly: options.inactive,
          adminOnly: options.admin,
          nameFilter: options.name,
          emailFilter: options.email,
        });

        setMembers(data);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch members');
        setLoading(false);
      }
    }

    fetchMembers();
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      // In non-interactive mode with Ink, just display and exit
      process.exit(0);
    } else if (error) {
      process.exit(1);
    }
  }, [loading, error]);

  if (loading) {
    return (
      <Box>
        <Text>🔄 Loading members...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">❌ Error: {error}</Text>
      </Box>
    );
  }

  if (members.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No members found.</Text>
        {!options.orgWide && (
          <Text dimColor>Try using --org-wide to see all organization members.</Text>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold>
        {options.orgWide ? 'Organization members' : 'Team members'} ({members.length}):
      </Text>
      <Box marginTop={1} flexDirection="column">
        {members.map(member => {
          const aliases = getAliasesForId('member', member.id);
          return (
            <Box key={member.id}>
              <Text>
                <Text color="cyan">{member.id}</Text>
                {' - '}
                <Text bold>{member.name}</Text>
                {' '}
                <Text dimColor>({member.email})</Text>
                {!member.active && <Text color="red"> [Inactive]</Text>}
                {member.admin && <Text color="yellow"> [Admin]</Text>}
                {aliases.length > 0 && (
                  <>
                    {' '}
                    <Text dimColor>[aliases: {aliases.map(a => `@${a}`).join(', ')}]</Text>
                  </>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>💡 Tip: Use "agent2linear alias add member &lt;alias&gt; &lt;id&gt;" to create member aliases</Text>
      </Box>
    </Box>
  );
}

export async function listMembers(options: ListOptions = {}) {
  // Handle --web flag: open Linear in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear in your browser...');
      await openInBrowser('https://linear.app/settings/members');
      console.log('✓ Browser opened. View your members in Linear.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Please visit https://linear.app/settings/members manually.');
      process.exit(1);
    }
    return;
  }

  if (options.interactive) {
    requireInteractiveInput('members list');
    // Interactive mode: display with Ink
    render(<App options={options} />);
  } else {
    // Non-interactive mode (default): print list to stdout
    try {
      const config = getConfig();
      let teamId = options.team;

      // Use default team if not specified and not org-wide
      if (!options.orgWide && !teamId) {
        teamId = config.defaultTeam;
      }

      // Resolve team alias if provided
      if (teamId) {
        const resolved = resolveAlias('team', teamId);
        if (resolved !== teamId) {
          console.log(`📎 Resolved team alias "${teamId}" to ${resolved}`);
        }
        teamId = resolved;
      }

      const members = await getAllMembers({
        teamId: options.orgWide ? undefined : teamId,
        activeOnly: options.active,
        inactiveOnly: options.inactive,
        adminOnly: options.admin,
        nameFilter: options.name,
        emailFilter: options.email,
      });

      if (members.length === 0) {
        console.log('No members found.');
        if (!options.orgWide) {
          console.log('Try using --org-wide to see all organization members.');
        }
        return;
      }

      // Add aliases to each member
      const membersWithAliases = members.map(member => ({
        ...member,
        aliases: getAliasesForId('member', member.id),
        activeStatus: member.active ? 'Active' : 'Inactive',
        adminStatus: member.admin ? 'Admin' : 'User',
      }));

      // Handle --columns option
      if (options.columns) {
        const cols = options.columns.split(',').map(c => c.trim());
        const flattened = membersWithAliases.map(m => ({
          id: m.id,
          name: m.name,
          email: m.email,
          active: m.activeStatus,
          admin: m.adminStatus,
          aliases: m.aliases.map(a => `@${a}`).join(', ') || '(none)',
        }));
        const filtered = filterColumns(flattened, cols);

        if (options.format === 'json') {
          console.log(JSON.stringify(filtered, null, 2));
        } else {
          console.log(cols.join('\t'));
          for (const row of filtered) {
            console.log(cols.map(c => String(row[c] ?? '')).join('\t'));
          }
        }
        return;
      }

      // Handle format option
      if (options.format === 'json') {
        console.log(formatListJSON(membersWithAliases));
      } else if (options.format === 'tsv') {
        console.log(formatListTSV(membersWithAliases, ['id', 'name', 'email', 'activeStatus', 'adminStatus', 'aliases']));
      } else {
        // Default behavior: formatted output with aliases column
        console.log(options.orgWide ? 'Organization members:' : 'Team members:');
        console.log('ID\t\t\t\tName\t\t\tEmail\t\t\tStatus\tRole\tAliases');
        membersWithAliases.forEach(member => {
          const aliasDisplay = member.aliases.length > 0
            ? member.aliases.map(a => `@${a}`).join(', ')
            : '(none)';
          const statusDisplay = member.active ? '✓ Active' : '✗ Inactive';
          const roleDisplay = member.admin ? 'Admin' : 'User';
          console.log(`${member.id}\t${member.name}\t${member.email}\t${statusDisplay}\t${roleDisplay}\t${aliasDisplay}`);
        });
        console.log('\n💡 Tip: Use "agent2linear alias add member <alias> <id>" to create member aliases');
      }
    } catch (error) {
      if (isAuthenticationError(error)) throw error;
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch members'}`);
      process.exit(1);
    }
  }
}
