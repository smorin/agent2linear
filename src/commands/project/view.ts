import { openInBrowser } from '../../lib/browser.js';
import { NotFoundError, UsageError } from '../../lib/cli-error.js';
import { getFullProjectDetails } from '../../lib/linear-client.js';
import { formatContentPreview, showResolvedAlias } from '../../lib/output.js';
import { resolveProject } from '../../lib/project-resolver.js';

interface ViewProjectOptions {
  web?: boolean;
  autoAlias?: boolean;
  desc?: boolean;
  descLength?: string;
  descFull?: boolean;
  noDesc?: boolean;
  json?: boolean;
}

export async function viewProject(nameOrId: string, options: ViewProjectOptions = {}) {
  if (options.json && options.web) {
    throw new UsageError('--web cannot be combined with JSON output');
  }
  const silent = options.json === true;

  // Use smart resolver to handle ID, alias, or name
  if (!silent) console.log(`\n🔍 Resolving project "${nameOrId}"...\n`);

  const resolved = await resolveProject(nameOrId, {
    autoAlias: options.autoAlias,
  });

  if (!resolved) {
    throw new NotFoundError(`project not found: ${nameOrId}`);
  }

  const resolvedId = resolved.projectId;

  // Show how the project was resolved
  if (!silent && resolved.resolvedBy === 'alias') {
    showResolvedAlias(resolved.usedAlias!, resolvedId);
  } else if (!silent && resolved.resolvedBy === 'name') {
    console.log(`   ✓ Found project by name: "${resolved.project?.name}"`);
    if (resolved.createdAlias) {
      console.log(`   ✓ Created alias "${resolved.createdAlias.alias}" (${resolved.createdAlias.scope})`);
    }
  } else if (!silent && resolved.resolvedBy === 'cache') {
    console.log(`   ✓ Found in cache: "${resolved.project?.name}"`);
  }

  try {
    if (!silent) console.log(`\n🔍 Fetching project details...\n`);

    const details = await getFullProjectDetails(resolvedId);

    if (!details) {
      throw new NotFoundError(`project not found: ${resolvedId}`);
    }

    const { project, lastAppliedTemplate, milestones, issues } = details;

    // Handle --web flag
    if (options.web) {
      console.log(`🌐 Opening in browser: ${project.name}`);
      await openInBrowser(project.url);
      console.log(`✓ Browser opened to ${project.url}`);
      process.exit(0);
    }

    if (options.json) {
      process.stdout.write(JSON.stringify(details, null, 2) + '\n');
      return;
    }

    // Display project details
    console.log(`📋 Project: ${project.name}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   State: ${project.state}`);

    if (project.initiative) {
      console.log(`   Initiative: ${project.initiative.name} (${project.initiative.id})`);
    }

    if (project.team) {
      console.log(`   Team: ${project.team.name} (${project.team.id})`);
    }

    if (lastAppliedTemplate) {
      console.log(`   Template: ${lastAppliedTemplate.name} (${lastAppliedTemplate.id})`);
    }

    console.log(`   URL: ${project.url}`);

    // Description display
    const descText = project.description || project.content;
    if (descText && !options.noDesc && (options.desc || options.descLength || options.descFull)) {
      console.log('');
      console.log('📝 Description:');
      console.log('─'.repeat(80));
      if (options.descFull) {
        console.log(descText);
      } else {
        const length = options.descLength ? parseInt(options.descLength, 10) : undefined;
        console.log(formatContentPreview(descText, length));
      }
      console.log('─'.repeat(80));
    }

    // Display milestones
    if (milestones.length > 0) {
      console.log(`\n📅 Milestones (${milestones.length}):`);
      for (const milestone of milestones) {
        console.log(`   ✓ ${milestone.name}`);
      }
    }

    // Display issues
    if (issues.length > 0) {
      console.log(`\n📝 Issues (${issues.length}):`);
      for (const issue of issues) {
        console.log(`   ✓ ${issue.identifier}: ${issue.title}`);
      }
    }

    // M23: Display dependencies
    try {
      const { getLinearClient, getProjectRelations } = await import('../../lib/linear-client.js');
      const { getRelationDirection } = await import('../../lib/parsers.js');
      const client = getLinearClient();

      const relations = await getProjectRelations(client, resolvedId);

      if (relations.length > 0) {
        // Group by direction
        const dependsOn = relations.filter(rel => getRelationDirection(rel, resolvedId) === 'depends-on');
        const blocks = relations.filter(rel => getRelationDirection(rel, resolvedId) === 'blocks');

        console.log(`\n🔗 Dependencies:`);

        if (dependsOn.length > 0) {
          console.log(`   ⬅️  Depends On (${dependsOn.length}):`);
          for (const rel of dependsOn) {
            const targetProject = rel.project.id === resolvedId ? rel.relatedProject : rel.project;
            const anchorDesc = `[${rel.anchorType} → ${rel.relatedAnchorType}]`;
            console.log(`      • ${targetProject.name} (${targetProject.id})`);
            console.log(`        ${anchorDesc} ${rel.anchorType === 'end' && rel.relatedAnchorType === 'start' ? 'My end waits for their start' : 'Custom anchor configuration'}`);
          }
        }

        if (blocks.length > 0) {
          console.log(`   ➡️  Blocks (${blocks.length}):`);
          for (const rel of blocks) {
            const targetProject = rel.project.id === resolvedId ? rel.relatedProject : rel.project;
            const anchorDesc = `[${rel.anchorType} → ${rel.relatedAnchorType}]`;
            console.log(`      • ${targetProject.name} (${targetProject.id})`);
            console.log(`        ${anchorDesc} ${rel.anchorType === 'start' && rel.relatedAnchorType === 'end' ? 'Their end waits for my start' : 'Custom anchor configuration'}`);
          }
        }
      } else {
        console.log(`\n🔗 Dependencies: None`);
      }
    } catch (error) {
      // Silently skip dependency display if there's an error
      console.error(`   ⚠️  Could not load dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    console.log();
  } catch (error) {
    if (options.json) throw error;
    if (error instanceof NotFoundError) throw error;
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
