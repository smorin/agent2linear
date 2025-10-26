import React, { useEffect, useState } from 'react';
import { render, Box, Text } from 'ink';
import { getAllTemplates, type Template } from '../../lib/linear-client.js';
import { openInBrowser } from '../../lib/browser.js';
import { formatListTSV, formatListJSON } from '../../lib/output.js';
import { getAliasesForId } from '../../lib/aliases.js';

interface ListOptions {
  interactive?: boolean;
  web?: boolean;
  format?: 'tsv' | 'json';
}

function App({ options: _options, typeFilter }: { options: ListOptions; typeFilter?: 'issue' | 'project' }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAllTemplates(typeFilter)
      .then(data => {
        setTemplates(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to fetch templates');
        setLoading(false);
      });
  }, [typeFilter]);

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
        <Text>🔄 Loading templates...</Text>
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

  if (templates.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color="yellow">No templates found in your Linear workspace.</Text>
        <Text dimColor>Create templates at linear.app to get started.</Text>
      </Box>
    );
  }

  // Group by type
  const issueTemplates = templates.filter(t => t.type === 'issue');
  const projectTemplates = templates.filter(t => t.type === 'project');

  return (
    <Box flexDirection="column">
      {issueTemplates.length > 0 && (
        <>
          <Text bold>Issue Templates ({issueTemplates.length}):</Text>
          <Box marginTop={1} flexDirection="column">
            {issueTemplates.map(template => {
              const aliases = getAliasesForId('issue-template', template.id);
              return (
                <Box key={template.id}>
                  <Text>
                    <Text color="cyan">{template.id}</Text>
                    {' - '}
                    <Text bold>{template.name}</Text>
                    {template.description && <Text dimColor> - {template.description}</Text>}
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
        </>
      )}

      {projectTemplates.length > 0 && (
        <>
          <Box marginTop={issueTemplates.length > 0 ? 2 : 0}>
            <Text bold>Project Templates ({projectTemplates.length}):</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {projectTemplates.map(template => {
              const aliases = getAliasesForId('project-template', template.id);
              return (
                <Box key={template.id}>
                  <Text>
                    <Text color="cyan">{template.id}</Text>
                    {' - '}
                    <Text bold>{template.name}</Text>
                    {template.description && <Text dimColor> - {template.description}</Text>}
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
        </>
      )}

      <Box marginTop={1}>
        <Text dimColor>💡 Tip: Use "linear-create config set defaultProjectTemplate &lt;id&gt;" to save a default</Text>
      </Box>
    </Box>
  );
}

export async function listTemplates(typeFilter?: string, options: ListOptions = {}) {
  // Normalize type filter
  let normalizedType: 'issue' | 'project' | undefined;
  if (typeFilter) {
    const normalized = typeFilter.toLowerCase();
    if (normalized === 'issue' || normalized === 'issues') {
      normalizedType = 'issue';
    } else if (normalized === 'project' || normalized === 'projects') {
      normalizedType = 'project';
    } else {
      console.error(`❌ Invalid template type: "${typeFilter}"`);
      console.error('   Valid types: issue, issues, project, projects');
      process.exit(1);
    }
  }

  // Handle --web flag: open Linear in browser
  if (options.web) {
    try {
      console.log('🌐 Opening Linear in your browser...');
      await openInBrowser('https://linear.app/settings/templates');
      console.log('✓ Browser opened. View your templates in Linear.');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error opening browser:', error instanceof Error ? error.message : 'Unknown error');
      console.error('   Please visit https://linear.app/settings/templates manually.');
      process.exit(1);
    }
    return;
  }

  if (options.interactive) {
    // Interactive mode: display with Ink
    render(<App options={options} typeFilter={normalizedType} />);
  } else {
    // Non-interactive mode (default): print list to stdout
    try {
      const templates = await getAllTemplates(normalizedType);

      if (templates.length === 0) {
        console.log('No templates found in your Linear workspace.');
        console.log('Create templates at linear.app/settings/templates to get started.');
        return;
      }

      // Add aliases to each template
      const templatesWithAliases = templates.map(template => {
        const aliasType = template.type === 'issue' ? 'issue-template' : 'project-template';
        return {
          ...template,
          aliases: getAliasesForId(aliasType as 'issue-template' | 'project-template', template.id)
        };
      });

      // Handle format option
      if (options.format === 'json') {
        // JSON format: flat list with all fields
        console.log(formatListJSON(templatesWithAliases));
      } else if (options.format === 'tsv') {
        // TSV format: flat list with standardized fields
        console.log(formatListTSV(templatesWithAliases, ['id', 'name', 'type', 'description', 'aliases']));
      } else {
        // Default behavior: grouped by type with aliases
        const issueTemplates = templatesWithAliases.filter(t => t.type === 'issue');
        const projectTemplates = templatesWithAliases.filter(t => t.type === 'project');

        if (issueTemplates.length > 0) {
          console.log(`Issue Templates (${issueTemplates.length}):`);
          console.log('ID\t\t\t\tName\t\t\tDescription\t\tAliases');
          issueTemplates.forEach(template => {
            const aliasDisplay = template.aliases.length > 0
              ? template.aliases.map(a => `@${a}`).join(', ')
              : '(none)';
            console.log(`${template.id}\t${template.name}\t${template.description || ''}\t\t${aliasDisplay}`);
          });
          console.log('');
        }

        if (projectTemplates.length > 0) {
          console.log(`Project Templates (${projectTemplates.length}):`);
          console.log('ID\t\t\t\tName\t\t\tDescription\t\tAliases');
          projectTemplates.forEach(template => {
            const aliasDisplay = template.aliases.length > 0
              ? template.aliases.map(a => `@${a}`).join(', ')
              : '(none)';
            console.log(`${template.id}\t${template.name}\t${template.description || ''}\t\t${aliasDisplay}`);
          });
          console.log('');
        }

        console.log('💡 Tip: Use "linear-create config set defaultProjectTemplate <id>" to save a default');
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch templates'}`);
      process.exit(1);
    }
  }
}
