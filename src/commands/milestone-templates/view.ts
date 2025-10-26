import { getMilestoneTemplate } from '../../lib/milestone-templates.js';

export async function viewMilestoneTemplate(templateName: string) {
  try {
    console.log(`🔍 Loading milestone template: ${templateName}...`);

    const result = getMilestoneTemplate(templateName);

    if (!result) {
      console.error(`❌ Milestone template not found: ${templateName}`);
      console.error('   Use "linear-create milestone-templates list" to see available templates');
      process.exit(1);
    }

    const { template, source } = result;

    console.log('');
    console.log(`📋 Milestone Template: ${template.name || templateName}`);
    if (template.description) {
      console.log(`   Description: ${template.description}`);
    }
    console.log(`   Source: ${source}`);
    console.log('');
    console.log(`   Milestones (${template.milestones.length}):`);

    for (let i = 0; i < template.milestones.length; i++) {
      const milestone = template.milestones[i];
      const dateInfo = milestone.targetDate ? ` (${milestone.targetDate})` : '';
      console.log(`   ${i + 1}. ${milestone.name}${dateInfo}`);
      if (milestone.description) {
        console.log(`      ${milestone.description}`);
      }
    }

    console.log('');
    console.log('💡 Use this template:');
    console.log(`   $ linear-create project add-milestones <project-id> --template ${templateName}`);
    console.log('');
    console.log('   Set as default:');
    console.log(`   $ linear-create config set defaultMilestoneTemplate ${templateName}`);
    console.log('');
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}
