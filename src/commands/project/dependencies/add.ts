/**
 * M23: Project Dependency Management - Add Command
 *
 * Add dependency relations to a project
 */

import { isAuthenticationError } from '../../../lib/cli-error.js';
import { createProjectRelation,getLinearClient } from '../../../lib/linear-client.js';
import { showError, showSuccess } from '../../../lib/output.js';
import { parseAdvancedDependency,resolveDependencyProjects } from '../../../lib/parsers.js';
import { resolveProject } from '../../../lib/project-resolver.js';

interface AddDependenciesOptions {
  dependsOn?: string;
  blocks?: string;
  dependency?: string[];
}

export async function addProjectDependencies(
  nameOrId: string,
  options: AddDependenciesOptions
) {
  try {
    // Validate at least one flag provided
    if (!options.dependsOn && !options.blocks && (!options.dependency || options.dependency.length === 0)) {
      showError(
        'No dependencies specified',
        'Provide at least one of:\n' +
        '  --depends-on <projects>  (comma-separated IDs/aliases)\n' +
        '  --blocks <projects>       (comma-separated IDs/aliases)\n' +
        '  --dependency <spec>       (advanced: "project:anchor:anchor")'
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

    // Parse all dependencies to create
    const dependenciesToCreate: Array<{
      relatedProjectId: string;
      anchorType: 'start' | 'end';
      relatedAnchorType: 'start' | 'end';
      type: 'depends-on' | 'blocks' | 'advanced';
    }> = [];

    // Parse --depends-on
    if (options.dependsOn) {
      try {
        const projectIds = resolveDependencyProjects(options.dependsOn);
        for (const relatedProjectId of projectIds) {
          // Self-referential validation
          if (relatedProjectId === projectId) {
            console.error(`⚠️  Warning: Skipping self-referential dependency (project cannot depend on itself)`);
            continue;
          }
          dependenciesToCreate.push({
            relatedProjectId,
            anchorType: 'end',
            relatedAnchorType: 'start',
            type: 'depends-on',
          });
        }
      } catch (error) {
        showError('Error parsing --depends-on', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }

    // Parse --blocks
    if (options.blocks) {
      try {
        const projectIds = resolveDependencyProjects(options.blocks);
        for (const relatedProjectId of projectIds) {
          // Self-referential validation
          if (relatedProjectId === projectId) {
            console.error(`⚠️  Warning: Skipping self-referential dependency (project cannot block itself)`);
            continue;
          }
          dependenciesToCreate.push({
            relatedProjectId,
            anchorType: 'start',
            relatedAnchorType: 'end',
            type: 'blocks',
          });
        }
      } catch (error) {
        showError('Error parsing --blocks', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
      }
    }

    // Parse --dependency (advanced)
    if (options.dependency && options.dependency.length > 0) {
      for (const depSpec of options.dependency) {
        try {
          const parsed = parseAdvancedDependency(depSpec);
          // Self-referential validation
          if (parsed.relatedProjectId === projectId) {
            console.error(`⚠️  Warning: Skipping self-referential dependency in "${depSpec}"`);
            continue;
          }
          dependenciesToCreate.push({
            relatedProjectId: parsed.relatedProjectId,
            anchorType: parsed.anchorType,
            relatedAnchorType: parsed.relatedAnchorType,
            type: 'advanced',
          });
        } catch (error) {
          showError(`Error parsing --dependency "${depSpec}"`, error instanceof Error ? error.message : 'Unknown error');
          process.exit(1);
        }
      }
    }

    if (dependenciesToCreate.length === 0) {
      console.log('\n⚠️  No valid dependencies to create (all were filtered out)\n');
      process.exit(0);
    }

    // Create dependencies
    console.log(`\n🔗 Adding ${dependenciesToCreate.length} dependenc${dependenciesToCreate.length === 1 ? 'y' : 'ies'}...\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (const dep of dependenciesToCreate) {
      try {
        const relation = await createProjectRelation(client, {
          type: 'dependency',
          projectId,
          relatedProjectId: dep.relatedProjectId,
          anchorType: dep.anchorType,
          relatedAnchorType: dep.relatedAnchorType,
        });

        const typeLabel = dep.type === 'depends-on' ? 'depends on' :
                         dep.type === 'blocks' ? 'blocks' :
                         `${dep.anchorType}→${dep.relatedAnchorType}`;
        console.log(`   ✓ Added: ${typeLabel} ${relation.relatedProject.name}`);
        successCount++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMsg.includes('Relation exists') || errorMsg.includes('already exists')) {
          console.log(`   ⚠️  Already exists: ${dep.relatedProjectId}`);
          skipCount++;
        } else {
          console.error(`   ✗ Failed: ${errorMsg}`);
          failCount++;
        }
      }
    }

    // Summary
    console.log('');
    if (successCount > 0) {
      showSuccess(
        `Added ${successCount} dependenc${successCount === 1 ? 'y' : 'ies'}`,
        skipCount > 0 ? { 'Skipped (already exists)': skipCount.toString() } :
        failCount > 0 ? { 'Failed': failCount.toString() } : undefined
      );
    } else if (skipCount > 0) {
      console.log(`⚠️  All dependencies already exist (${skipCount} skipped)\n`);
    } else {
      showError('Failed to add dependencies', `${failCount} failed`);
      process.exit(1);
    }

  } catch (error) {
    if (isAuthenticationError(error)) throw error;
    showError('Error', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
