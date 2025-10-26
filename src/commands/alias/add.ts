import React from 'react';
import { render } from 'ink';
import { addAlias, normalizeEntityType } from '../../lib/aliases.js';
import { showSuccess, showError, showInfo } from '../../lib/output.js';
import { getScopeInfo } from '../../lib/scope.js';
import { getMemberByEmail, searchMembers, type Member } from '../../lib/linear-client.js';
import { MemberSelector } from '../../ui/components/MemberSelector.js';

interface AddAliasOptions {
  global?: boolean;
  project?: boolean;
  skipValidation?: boolean;
  email?: string;
  name?: string;
  interactive?: boolean;
}

export async function addAliasCommand(
  type: string,
  alias: string,
  id: string | undefined,
  options: AddAliasOptions = {}
) {
  // Normalize the type
  const normalizedType = normalizeEntityType(type);
  if (!normalizedType) {
    showError(`Invalid entity type: "${type}"`, 'Valid types: initiative, team, project');
    process.exit(1);
  }

  // Handle email/name lookup for members
  if (options.email || options.name) {
    if (normalizedType !== 'member') {
      showError('--email and --name flags are only valid for member/user type');
      process.exit(1);
    }

    if (options.email && options.name) {
      showError('Cannot use both --email and --name. Choose one.');
      process.exit(1);
    }

    console.log(`🔍 Adding alias "${alias}" for member...`);

    let memberId: string | undefined;

    if (options.email) {
      console.log(`   Looking up members with email containing "${options.email}"...`);

      // Try exact match first
      const exactMatch = await getMemberByEmail(options.email);
      if (exactMatch) {
        console.log(`   ✓ Found member: ${exactMatch.name} (${exactMatch.id})`);
        memberId = exactMatch.id;
      } else {
        // Fall back to partial search
        const matches = await searchMembers({ emailFilter: options.email });

        if (matches.length === 0) {
          showError(`No members found matching email: ${options.email}`);
          showInfo('Use "linear-create members list" to see all members');
          process.exit(1);
        } else if (matches.length === 1) {
          console.log(`   ✓ Found 1 match: ${matches[0].name} (${matches[0].email})`);
          memberId = matches[0].id;
        } else {
          // Multiple matches
          if (!options.interactive) {
            showError(`Multiple members found (${matches.length} matches). Please be more specific or use --interactive to select.\n`);
            console.log('Matching members:');
            matches.forEach(m => {
              console.log(`  - ${m.name} (${m.email}) - ${m.id}`);
            });
            showInfo(`Tip: Use --interactive flag to select from list:\n   $ linear-create alias add member ${alias} --email ${options.email} --interactive`);
            process.exit(1);
          } else {
            // Interactive selection
            console.log(`   Found ${matches.length} matches:\n`);
            memberId = await selectMemberInteractive(matches);
          }
        }
      }
    } else if (options.name) {
      console.log(`   Looking up members with name containing "${options.name}"...`);

      const matches = await searchMembers({ nameFilter: options.name });

      if (matches.length === 0) {
        showError(`No members found matching name: ${options.name}`);
        showInfo('Use "linear-create members list" to see all members');
        process.exit(1);
      } else if (matches.length === 1) {
        console.log(`   ✓ Found 1 match: ${matches[0].name} (${matches[0].email})`);
        memberId = matches[0].id;
      } else {
        // Multiple matches
        if (!options.interactive) {
          showError(`Multiple members found (${matches.length} matches). Please be more specific or use --interactive to select.\n`);
          console.log('Matching members:');
          matches.forEach(m => {
            console.log(`  - ${m.name} (${m.email}) - ${m.id}`);
          });
          showInfo(`Tip: Use --interactive flag to select from list:\n   $ linear-create alias add member ${alias} --name "${options.name}" --interactive`);
          process.exit(1);
        } else {
          // Interactive selection
          console.log(`   Found ${matches.length} matches:\n`);
          memberId = await selectMemberInteractive(matches);
        }
      }
    }

    id = memberId; // Override ID with looked-up member ID
  }

  // Validate ID is provided
  if (!id) {
    showError('Missing identifier. Provide one of:\n' +
      '   - ID: linear-create alias add <type> <alias> <id>\n' +
      '   - Email (member only): linear-create alias add member <alias> --email <email>\n' +
      '   - Name (member only): linear-create alias add member <alias> --name "<name>"');
    process.exit(1);
  }

  // Determine scope
  const { scope, label: scopeLabel } = getScopeInfo(options);

  console.log(`🔍 Adding alias "${alias}" for ${normalizedType}...`);

  if (!options.skipValidation) {
    console.log(`   Validating ${normalizedType} ID: ${id}...`);
  }

  try {
    const result = await addAlias(normalizedType, alias, id, scope, {
      skipValidation: options.skipValidation,
    });

    if (!result.success) {
      showError(result.error ?? 'Unknown error');
      process.exit(1);
    }

    const details: Record<string, string> = {
      'Alias': alias,
      [`${normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)} ID`]: id
    };

    if (result.entityName) {
      details['Name'] = result.entityName;
    }

    details['Scope'] = scopeLabel;

    showSuccess('Alias added successfully!', details);
    showInfo(`Use this alias in place of the ${normalizedType} ID in any command`);
  } catch (error) {
    showError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Show interactive member selection and return selected member ID
 */
async function selectMemberInteractive(members: Member[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let selectedMember: Member | undefined;

    const onSelect = (member: Member) => {
      selectedMember = member;
      console.log(`\n   ✓ Selected: ${member.name} (${member.id})`);
      // Don't call process.exit here, just resolve the promise
      setImmediate(() => {
        resolve(member.id);
      });
    };

    const onCancel = () => {
      reject(new Error('Selection cancelled'));
    };

    // Render the selector
    const { unmount } = render(React.createElement(MemberSelector, { members, onSelect, onCancel }));

    // Clean up after selection
    setTimeout(() => {
      if (selectedMember) {
        unmount();
      }
    }, 100);
  });
}
