import { loadMilestoneTemplates, hasGlobalTemplates, hasProjectTemplates } from '../../lib/milestone-templates.js';
import { formatListJSON } from '../../lib/output.js';

interface ListOptions {
  format?: 'tsv' | 'json';
}

export async function listMilestoneTemplates(options: ListOptions = {}) {
  try {
    const templates = loadMilestoneTemplates();
    const templateNames = Object.keys(templates).sort();

    if (templateNames.length === 0) {
      console.log('No milestone templates found.');
      console.log('');
      console.log('Create templates at:');
      if (!hasGlobalTemplates()) {
        console.log('  Global:  ~/.config/linear-create/milestone-templates.json');
      }
      if (!hasProjectTemplates()) {
        console.log('  Project: .linear-create/milestone-templates.json');
      }
      console.log('');
      return;
    }

    // Handle format option
    if (options.format === 'json') {
      // JSON format: flat list with all fields
      const jsonData = templateNames.map(name => {
        const { template, source } = templates[name];
        return {
          name,
          description: template.description || '',
          milestoneCount: template.milestones.length,
          source,
        };
      });
      console.log(formatListJSON(jsonData));
    } else if (options.format === 'tsv') {
      // TSV format: flat list with standardized fields
      console.log('name\tdescription\tmilestoneCount\tsource');
      for (const name of templateNames) {
        const { template, source } = templates[name];
        const description = template.description || '';
        const milestoneCount = template.milestones.length;
        console.log(`${name}\t${description}\t${milestoneCount}\t${source}`);
      }
    } else {
      // Default behavior: grouped by source
      const globalTemplates = templateNames.filter(name => templates[name].source === 'global');
      const projectTemplates = templateNames.filter(name => templates[name].source === 'project');

      if (globalTemplates.length > 0) {
        console.log(`Global Templates (${globalTemplates.length}):`);
        for (const name of globalTemplates) {
          const template = templates[name].template;
          const milestoneCount = template.milestones.length;
          const description = template.description || '';
          console.log(`  ${name.padEnd(20)} - ${milestoneCount} milestone${milestoneCount === 1 ? '' : 's'}${description ? ' - ' + description : ''}`);
        }
        console.log('');
      }

      if (projectTemplates.length > 0) {
        console.log(`Project Templates (${projectTemplates.length}):`);
        for (const name of projectTemplates) {
          const template = templates[name].template;
          const milestoneCount = template.milestones.length;
          const description = template.description || '';
          console.log(`  ${name.padEnd(20)} - ${milestoneCount} milestone${milestoneCount === 1 ? '' : 's'}${description ? ' - ' + description : ''}`);
        }
        console.log('');
      }

      console.log('💡 Tip: Use "linear-create config set defaultMilestoneTemplate <name>" to save a default');
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
