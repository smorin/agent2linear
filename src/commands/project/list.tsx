import React from 'react';
import { render, Box, Text } from 'ink';
import type { Command } from 'commander';
import { getAllProjects } from '../../lib/linear-client.js';
import { getEntityCache } from '../../lib/entity-cache.js';
import { showError } from '../../lib/output.js';
import { getConfig } from '../../lib/config.js';
import { resolveAlias } from '../../lib/aliases.js';
import type { ProjectListFilters, ProjectListItem } from '../../lib/types.js';

// ========================================
// HELPER: Build filters from options with smart defaults
// ========================================
async function buildDefaultFilters(options: any): Promise<ProjectListFilters> {
  const config = getConfig();
  const filters: ProjectListFilters = {};

  // ========================================
  // LEAD FILTER (default: current user)
  // ========================================
  if (!options.allLeads) {
    if (options.lead) {
      // Explicit lead specified - resolve it
      const leadId = resolveAlias('member', options.lead);
      filters.leadId = leadId;
    } else {
      // Default: current user is the lead (cached)
      const cache = getEntityCache();
      const currentUser = await cache.getCurrentUser();
      filters.leadId = currentUser.id;
    }
  }
  // If --all-leads: don't set leadId filter (show all leads)

  // ========================================
  // TEAM FILTER (default: config.defaultTeam)
  // ========================================
  if (!options.allTeams) {
    const teamId = options.team || config.defaultTeam;
    if (teamId) {
      filters.teamId = resolveAlias('team', teamId);
    }
  }
  // If --all-teams: don't set teamId filter (show all teams)

  // ========================================
  // INITIATIVE FILTER (default: config.defaultInitiative)
  // ========================================
  if (!options.allInitiatives) {
    const initiativeId = options.initiative || config.defaultInitiative;
    if (initiativeId) {
      filters.initiativeId = resolveAlias('initiative', initiativeId);
    }
  }
  // If --all-initiatives: don't set initiativeId filter (show all initiatives)

  // ========================================
  // EXPLICIT FILTERS (no defaults, only if specified)
  // ========================================

  if (options.status) {
    filters.statusId = resolveAlias('project-status', options.status);
  }

  if (options.priority !== undefined) {
    const priority = parseInt(options.priority, 10);
    if (isNaN(priority) || priority < 0 || priority > 4) {
      throw new Error('Priority must be a number between 0 (None) and 4 (Low)');
    }
    filters.priority = priority;
  }

  if (options.member) {
    // Can be comma-separated list
    const members = options.member.split(',').map((m: string) => m.trim());
    filters.memberIds = members.map((m: string) => resolveAlias('member', m));
  }

  if (options.label) {
    // Can be comma-separated list
    const labels = options.label.split(',').map((l: string) => l.trim());
    filters.labelIds = labels.map((l: string) => resolveAlias('project-label', l));
  }

  // Date range filters
  if (options.startAfter) {
    filters.startDateAfter = options.startAfter;
  }
  if (options.startBefore) {
    filters.startDateBefore = options.startBefore;
  }
  if (options.targetAfter) {
    filters.targetDateAfter = options.targetAfter;
  }
  if (options.targetBefore) {
    filters.targetDateBefore = options.targetBefore;
  }

  // Search query
  if (options.search) {
    filters.search = options.search;
  }

  return filters;
}

// ========================================
// HELPER: Apply dependency filters (client-side)
// ========================================
function applyDependencyFilters(
  projects: ProjectListItem[],
  options: {
    hasDependencies?: boolean;
    withoutDependencies?: boolean;
    dependsOnOthers?: boolean;
    blocksOthers?: boolean;
  }
): ProjectListItem[] {
  let filtered = projects;

  // Filter: has any dependencies
  if (options.hasDependencies) {
    filtered = filtered.filter(p =>
      (p.dependsOnCount || 0) + (p.blocksCount || 0) > 0
    );
  }

  // Filter: without dependencies
  if (options.withoutDependencies) {
    filtered = filtered.filter(p =>
      (p.dependsOnCount || 0) + (p.blocksCount || 0) === 0
    );
  }

  // Filter: depends on others
  if (options.dependsOnOthers) {
    filtered = filtered.filter(p => (p.dependsOnCount || 0) > 0);
  }

  // Filter: blocks others
  if (options.blocksOthers) {
    filtered = filtered.filter(p => (p.blocksCount || 0) > 0);
  }

  return filtered;
}

// ========================================
// HELPER: Format content preview
// ========================================
function formatContentPreview(project: ProjectListItem): string {
  // Prefer description over content
  const text = project.description || project.content || '';

  if (!text) return '';

  // Remove markdown formatting, newlines
  const cleaned = text
    .replace(/[#*_~`]/g, '')  // Remove markdown syntax
    .replace(/\n+/g, ' ')      // Replace newlines with spaces
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .trim();

  // Truncate to 60 chars
  return cleaned.length > 60
    ? cleaned.substring(0, 57) + '...'
    : cleaned;
}

// ========================================
// HELPER: Format table output
// ========================================
function formatTableOutput(projects: ProjectListItem[], showDependencies = false): void {
  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  // Header - tab-separated (with optional dependency columns)
  if (showDependencies) {
    console.log('ID\tTitle\tStatus\tTeam\tLead\tDeps-On\tBlocks\tPreview');
  } else {
    console.log('ID\tTitle\tStatus\tTeam\tLead\tPreview');
  }

  // Rows - tab-separated with full ID and Title (no truncation)
  for (const project of projects) {
    const id = project.id;
    const title = project.name;
    const status = (project.status?.name || project.state || '').substring(0, 11);
    const team = (project.team?.name || '').substring(0, 14);
    const lead = (project.lead?.name || '').substring(0, 19);
    const preview = formatContentPreview(project);

    if (showDependencies) {
      const depsOn = project.dependsOnCount !== undefined ? project.dependsOnCount.toString() : '0';
      const blocks = project.blocksCount !== undefined ? project.blocksCount.toString() : '0';
      console.log(
        `${id}\t${title}\t${status}\t${team}\t${lead}\t${depsOn}\t${blocks}\t${preview}`
      );
    } else {
      console.log(
        `${id}\t${title}\t${status}\t${team}\t${lead}\t${preview}`
      );
    }
  }

  console.log(`\nTotal: ${projects.length} project${projects.length !== 1 ? 's' : ''}`);
}

// ========================================
// HELPER: Format JSON output
// ========================================
function formatJSONOutput(projects: ProjectListItem[]): void {
  console.log(JSON.stringify(projects, null, 2));
}

// ========================================
// HELPER: Format TSV output
// ========================================
function formatTSVOutput(projects: ProjectListItem[], showDependencies = false): void {
  // Headers (with optional dependency columns)
  if (showDependencies) {
    console.log('ID\tTitle\tStatus\tTeam\tLead\tDeps-On\tBlocks\tPreview');
  } else {
    console.log('ID\tTitle\tStatus\tTeam\tLead\tPreview');
  }

  // Rows
  for (const project of projects) {
    const status = project.status?.name || project.state || '';
    const team = project.team?.name || '';
    const lead = project.lead?.name || '';
    const preview = formatContentPreview(project);

    if (showDependencies) {
      const depsOn = project.dependsOnCount !== undefined ? project.dependsOnCount.toString() : '0';
      const blocks = project.blocksCount !== undefined ? project.blocksCount.toString() : '0';
      console.log(
        `${project.id}\t${project.name}\t${status}\t${team}\t${lead}\t${depsOn}\t${blocks}\t${preview}`
      );
    } else {
      console.log(
        `${project.id}\t${project.name}\t${status}\t${team}\t${lead}\t${preview}`
      );
    }
  }
}

// ========================================
// INK COMPONENT: Interactive list
// ========================================
interface ProjectListProps {
  filters: ProjectListFilters;
  format?: string;
}

function ProjectList({ filters }: ProjectListProps): React.ReactElement {
  const [projects, setProjects] = React.useState<ProjectListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchProjects() {
      try {
        setLoading(true);
        const projectList = await getAllProjects(filters);
        setProjects(projectList);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  if (loading) {
    return <Text>Loading projects...</Text>;
  }

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (projects.length === 0) {
    return <Text color="yellow">No projects found matching your filters.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text bold underline>Projects ({projects.length})</Text>
      <Text> </Text>

      {projects.map((project) => (
        <Box key={project.id} flexDirection="column" marginBottom={1}>
          <Text>
            <Text bold color="cyan">{project.name}</Text>
            {' '}
            <Text dimColor>({project.id.substring(0, 8)}...)</Text>
          </Text>

          <Text>
            Status: <Text color="green">{project.status?.name || project.state}</Text>
            {' | '}
            Team: <Text color="blue">{project.team?.name || 'N/A'}</Text>
            {' | '}
            Lead: <Text color="magenta">{project.lead?.name || 'N/A'}</Text>
          </Text>

          {(project.description || project.content) && (
            <Text dimColor>{formatContentPreview(project)}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
}

// ========================================
// COMMAND REGISTRATION
// ========================================
export function listProjectsCommand(program: Command): void {
  program
    .command('list')
    .alias('ls')
    .description('List projects with smart defaults and filtering')

    // Filter options
    .option('-t, --team <id>', 'Filter by team (default: config.defaultTeam)')
    .option('-i, --initiative <id>', 'Filter by initiative (default: config.defaultInitiative)')
    .option('-s, --status <id>', 'Filter by project status')
    .option('-p, --priority <number>', 'Filter by priority (0-4)')
    .option('-l, --lead <id>', 'Filter by project lead (default: current user)')
    .option('-m, --member <id>', 'Filter by member (comma-separated for multiple)')
    .option('--label <id>', 'Filter by label (comma-separated for multiple)')
    .option('--search <query>', 'Search in project name, description, or content')

    // Date range filters
    .option('--start-after <date>', 'Filter projects starting after date (YYYY-MM-DD)')
    .option('--start-before <date>', 'Filter projects starting before date (YYYY-MM-DD)')
    .option('--target-after <date>', 'Filter projects targeting after date (YYYY-MM-DD)')
    .option('--target-before <date>', 'Filter projects targeting before date (YYYY-MM-DD)')

    // Override flags
    .option('--all-leads', 'Show projects with any lead (overrides default: current user)')
    .option('--all-teams', 'Show projects from all teams (overrides default team)')
    .option('--all-initiatives', 'Show projects from all initiatives (overrides default initiative)')

    // Pagination options (M21.1)
    .option('--limit <number>', 'Maximum number of results to return (default: 50, max: 250)', '50')
    .option('--all', 'Fetch all matching projects across all pages (may be slow)')

    // Output format
    .option('-f, --format <type>', 'Output format: table (default), json, tsv', 'table')
    .option('-I, --interactive', 'Interactive mode with Ink UI')
    .option('-w, --web', 'Open in web browser')

    // M23: Dependency display and filters
    .option('--show-dependencies', 'Show dependency counts (depends-on/blocks)')
    .option('--has-dependencies', 'Filter: show only projects with any dependencies')
    .option('--without-dependencies', 'Filter: show only projects with no dependencies')
    .option('--depends-on-others', 'Filter: show only projects that depend on others')
    .option('--blocks-others', 'Filter: show only projects that block others')

    .action(async (options) => {
      try {
        // M23: Validate conflicting dependency filters
        if (options.hasDependencies && options.withoutDependencies) {
          showError(
            'Conflicting filters',
            'Cannot use --has-dependencies and --without-dependencies together'
          );
          process.exit(1);
        }

        // Build filters with smart defaults
        const filters = await buildDefaultFilters(options);

        // Add pagination options (M21.1)
        const limit = parseInt(options.limit, 10);
        if (isNaN(limit) || limit < 1) {
          throw new Error('Limit must be a positive number');
        }
        filters.limit = limit;
        filters.fetchAll = options.all || false;

        // M23: Add dependency fetching flag
        // Fetch dependencies if: showing them OR filtering by them
        const needsDependencies = options.showDependencies ||
                                 options.hasDependencies ||
                                 options.withoutDependencies ||
                                 options.dependsOnOthers ||
                                 options.blocksOthers;
        filters.includeDependencies = needsDependencies;

        // Web mode - open in browser
        if (options.web) {
          // TODO: Implement web browser opening
          // For now, just show error
          showError('Web mode not yet implemented');
          process.exit(1);
        }

        // Non-interactive formats - handle synchronously before Ink
        if (options.format !== 'table' && !options.interactive) {
          let projects = await getAllProjects(filters);

          // M23: Apply dependency filters (client-side)
          projects = applyDependencyFilters(projects, {
            hasDependencies: options.hasDependencies,
            withoutDependencies: options.withoutDependencies,
            dependsOnOthers: options.dependsOnOthers,
            blocksOthers: options.blocksOthers,
          });

          if (options.format === 'json') {
            formatJSONOutput(projects);
          } else if (options.format === 'tsv') {
            formatTSVOutput(projects, options.showDependencies);
          } else {
            // Default: table
            formatTableOutput(projects, options.showDependencies);
          }

          process.exit(0);
        }

        // Handle table format without interactive
        if (options.format === 'table' && !options.interactive) {
          let projects = await getAllProjects(filters);

          // M23: Apply dependency filters (client-side)
          projects = applyDependencyFilters(projects, {
            hasDependencies: options.hasDependencies,
            withoutDependencies: options.withoutDependencies,
            dependsOnOthers: options.dependsOnOthers,
            blocksOthers: options.blocksOthers,
          });

          formatTableOutput(projects, options.showDependencies);
          process.exit(0);
        }

        // Interactive mode with Ink UI
        render(<ProjectList filters={filters} format={options.format} />);

      } catch (error: any) {
        showError(error.message);
        process.exit(1);
      }
    });
}
