/**
 * M23: Project Dependency Management - List Command
 *
 * List all dependency relations for a project
 */

import { isAuthenticationError, NotFoundError } from '../../../lib/cli-error.js';
import { getLinearClient, getProjectRelations } from '../../../lib/linear-client.js';
import { showError } from '../../../lib/output.js';
import { getRelationDirection } from '../../../lib/parsers.js';
import { resolveProject } from '../../../lib/project-resolver.js';

interface ListDependenciesOptions {
  direction?: 'depends-on' | 'blocks';
  json?: boolean;
}

export async function listProjectDependencies(
  nameOrId: string,
  options: ListDependenciesOptions = {}
) {
  try {
    const silent = options.json === true;
    // Resolve project
    if (!silent) console.log(`\n🔍 Resolving project "${nameOrId}"...\n`);
    const resolved = await resolveProject(nameOrId);

    if (!resolved) {
      if (options.json) throw new NotFoundError(`project not found: ${nameOrId}`);
      showError('Project not found', `Could not find project: ${nameOrId}`);
      process.exit(1);
    }

    const projectId = resolved.projectId;
    const projectName = resolved.project?.name || nameOrId;
    const client = getLinearClient();

    // Fetch relations
    if (!silent) console.log('🔍 Fetching dependencies...\n');
    const relations = await getProjectRelations(client, projectId);

    if (relations.length === 0 && !options.json) {
      console.log(`📋 Dependencies for ${projectName} (${projectId}): None\n`);
      return;
    }

    // Group by direction
    const dependsOn = relations.filter(rel => getRelationDirection(rel, projectId) === 'depends-on');
    const blocks = relations.filter(rel => getRelationDirection(rel, projectId) === 'blocks');

    // Filter by direction if specified
    const showDependsOn = !options.direction || options.direction === 'depends-on';
    const showBlocks = !options.direction || options.direction === 'blocks';

    if (options.json) {
      const serialize = (relation: (typeof relations)[number], direction: 'depends-on' | 'blocks') => {
        const targetProject =
          relation.project.id === projectId ? relation.relatedProject : relation.project;
        return {
          id: relation.id,
          direction,
          project: { id: targetProject.id, name: targetProject.name },
          anchorType: relation.anchorType,
          relatedAnchorType: relation.relatedAnchorType,
        };
      };
      process.stdout.write(
        JSON.stringify(
          {
            project: { id: projectId, name: projectName },
            dependsOn: showDependsOn ? dependsOn.map(relation => serialize(relation, 'depends-on')) : [],
            blocks: showBlocks ? blocks.map(relation => serialize(relation, 'blocks')) : [],
          },
          null,
          2
        ) + '\n'
      );
      return;
    }

    console.log(`📋 Dependencies for ${projectName} (${projectId}):\n`);

    // Display depends-on relations
    if (showDependsOn && dependsOn.length > 0) {
      console.log(`⬅️  Depends On (${dependsOn.length} project${dependsOn.length === 1 ? '' : 's'}):`);
      for (const rel of dependsOn) {
        const targetProject = rel.project.id === projectId ? rel.relatedProject : rel.project;
        const anchorDesc = `[${rel.anchorType} → ${rel.relatedAnchorType}]`;
        const semantics = rel.anchorType === 'end' && rel.relatedAnchorType === 'start'
          ? 'My end waits for their start'
          : rel.anchorType === 'start' && rel.relatedAnchorType === 'end'
          ? 'My start waits for their end'
          : rel.anchorType === 'start' && rel.relatedAnchorType === 'start'
          ? 'Both starts linked'
          : 'Both ends linked';

        console.log(`  • ${targetProject.name} (${targetProject.id}) [${rel.id}]`);
        console.log(`    ${anchorDesc} ${semantics}`);
      }
      console.log('');
    }

    // Display blocks relations
    if (showBlocks && blocks.length > 0) {
      console.log(`➡️  Blocks (${blocks.length} project${blocks.length === 1 ? '' : 's'}):`);
      for (const rel of blocks) {
        const targetProject = rel.project.id === projectId ? rel.relatedProject : rel.project;
        const anchorDesc = `[${rel.anchorType} → ${rel.relatedAnchorType}]`;
        const semantics = rel.anchorType === 'start' && rel.relatedAnchorType === 'end'
          ? 'Their end waits for my start'
          : rel.anchorType === 'end' && rel.relatedAnchorType === 'start'
          ? 'Their start waits for my end'
          : rel.anchorType === 'start' && rel.relatedAnchorType === 'start'
          ? 'Both starts linked'
          : 'Both ends linked';

        console.log(`  • ${targetProject.name} (${targetProject.id}) [${rel.id}]`);
        console.log(`    ${anchorDesc} ${semantics}`);
      }
      console.log('');
    }

    // Summary
    if (options.direction) {
      const count = options.direction === 'depends-on' ? dependsOn.length : blocks.length;
      if (count === 0) {
        console.log(`ℹ️  No "${options.direction}" dependencies found\n`);
      }
    } else {
      if (dependsOn.length === 0 && blocks.length === 0) {
        console.log('ℹ️  No dependencies found\n');
      }
    }

  } catch (error) {
    if (options.json) throw error;
    if (isAuthenticationError(error)) throw error;
    showError('Error', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
