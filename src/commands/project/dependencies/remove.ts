/**
 * M23: Project Dependency Management - Remove Command
 *
 * Remove dependency relations from a project
 */

import { resolveAlias } from '../../../lib/aliases.js';
import { deleteProjectRelation,getLinearClient, getProjectRelations } from '../../../lib/linear-client.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { getRelationDirection,resolveDependencyProjects } from '../../../lib/parsers.js';
import { resolveProject } from '../../../lib/project-resolver.js';

interface RemoveDependenciesOptions {
  dependsOn?: string;
  blocks?: string;
  relationId?: string;
  with?: string;
}

export async function removeProjectDependencies(
  nameOrId: string,
  options: RemoveDependenciesOptions
) {
  try {
    // Validate at least one flag provided
    if (!options.dependsOn && !options.blocks && !options.relationId && !options.with) {
      showError(
        'No removal criteria specified',
        'Provide at least one of:\n' +
        '  --depends-on <projects>  (remove "depends on" relations)\n' +
        '  --blocks <projects>       (remove "blocks" relations)\n' +
        '  --relation-id <id>        (remove by relation ID)\n' +
        '  --with <project>          (remove all relations with project)'
      );
      process.exit(1);
    }

    // Resolve project
    console.log(`\n🔍 Resolving project "${nameOrId}"...\n`);
    const resolved = await resolveProject(nameOrId);

    if (!resolved) {
      showError('Project not found', `Could not find project: ${nameOrId}`);
      process.exit(1);
    }

    const projectId = resolved.projectId;
    const client = getLinearClient();

    // Fetch existing relations
    console.log('🔍 Fetching existing dependencies...\n');
    const existingRelations = await getProjectRelations(client, projectId);

    if (existingRelations.length === 0) {
      console.log('ℹ️  No dependencies found for this project\n');
      process.exit(0);
    }

    const relationsToDelete: string[] = [];

    // Remove by relation ID
    if (options.relationId) {
      const matching = existingRelations.find(rel => rel.id === options.relationId);
      if (matching) {
        relationsToDelete.push(matching.id);
      } else {
        showError('Relation not found', `No relation with ID: ${options.relationId}`);
        process.exit(1);
      }
    }

    // Remove --depends-on relations
    if (options.dependsOn) {
      try {
        const targetProjectIds = resolveDependencyProjects(options.dependsOn);
        for (const targetId of targetProjectIds) {
          const matching = existingRelations.filter(rel => {
            const direction = getRelationDirection(rel, projectId);
            return direction === 'depends-on' &&
                   (rel.project.id === projectId && rel.relatedProject.id === targetId);
          });
          relationsToDelete.push(...matching.map(r => r.id));
        }
      } catch (error) {
        showError('Error parsing --depends-on', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }

    // Remove --blocks relations
    if (options.blocks) {
      try {
        const targetProjectIds = resolveDependencyProjects(options.blocks);
        for (const targetId of targetProjectIds) {
          const matching = existingRelations.filter(rel => {
            const direction = getRelationDirection(rel, projectId);
            return direction === 'blocks' &&
                   (rel.project.id === projectId && rel.relatedProject.id === targetId);
          });
          relationsToDelete.push(...matching.map(r => r.id));
        }
      } catch (error) {
        showError('Error parsing --blocks', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }

    // Remove all relations with specific project
    if (options.with) {
      try {
        const targetProjectId = resolveAlias('project', options.with);
        const matching = existingRelations.filter(rel =>
          (rel.project.id === projectId && rel.relatedProject.id === targetProjectId) ||
          (rel.relatedProject.id === projectId && rel.project.id === targetProjectId)
        );
        relationsToDelete.push(...matching.map(r => r.id));
      } catch (error) {
        showError('Error parsing --with', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }

    // Remove duplicates
    const uniqueRelations = [...new Set(relationsToDelete)];

    if (uniqueRelations.length === 0) {
      console.log('⚠️  No matching dependencies found to remove\n');
      process.exit(0);
    }

    // Delete relations
    console.log(`🗑️  Removing ${uniqueRelations.length} dependenc${uniqueRelations.length === 1 ? 'y' : 'ies'}...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const relationId of uniqueRelations) {
      try {
        await deleteProjectRelation(client, relationId);
        console.log(`   ✓ Removed dependency (${relationId})`);
        successCount++;
      } catch (error) {
        console.error(`   ✗ Failed to remove ${relationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failCount++;
      }
    }

    // Summary
    console.log('');
    if (successCount > 0) {
      showSuccess(
        `Removed ${successCount} dependenc${successCount === 1 ? 'y' : 'ies'}`,
        failCount > 0 ? { 'Failed': failCount.toString() } : undefined
      );
    } else {
      showError('Failed to remove dependencies', `${failCount} failed`);
      process.exit(1);
    }

  } catch (error) {
    showError('Error', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
