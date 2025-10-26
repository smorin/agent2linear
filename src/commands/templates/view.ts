import { getTemplateById } from '../../lib/linear-client.js';
import { resolveAlias } from '../../lib/aliases.js';
import { openInBrowser } from '../../lib/browser.js';

export async function viewTemplate(templateId: string, options: { web?: boolean } = {}) {
  // Resolve alias to ID if needed
  // Try both project-template and issue-template types
  let resolvedId = templateId;
  const projectTemplateId = resolveAlias('project-template', templateId);
  const issueTemplateId = resolveAlias('issue-template', templateId);

  if (projectTemplateId !== templateId) {
    resolvedId = projectTemplateId;
    console.log(`\n📎 Resolved project template alias "${templateId}" to ${resolvedId}`);
  } else if (issueTemplateId !== templateId) {
    resolvedId = issueTemplateId;
    console.log(`\n📎 Resolved issue template alias "${templateId}" to ${resolvedId}`);
  }

  try {
    console.log(`🔍 Fetching template: ${resolvedId}...`);

    const template = await getTemplateById(resolvedId);

    if (!template) {
      console.error(`❌ Template not found: ${resolvedId}`);
      console.error('   Use "linear-create templates list" to see available templates');
      process.exit(1);
    }

    // Handle --web flag
    // Note: Templates don't have individual URLs in Linear, so we open the templates settings page
    if (options.web) {
      console.log(`🌐 Opening templates page in browser...`);
      console.log(`   Template: ${template.name}`);
      await openInBrowser('https://linear.app/settings/templates');
      console.log(`✓ Browser opened to Linear templates settings`);
      console.log(`   💡 Navigate to "${template.name}" in the templates list`);
      process.exit(0);
    }

    console.log('');
    console.log(`📋 Template: ${template.name}`);
    console.log(`   ID: ${template.id}`);
    console.log(`   Type: ${template.type}`);
    if (template.description) {
      console.log(`   Description: ${template.description}`);
    }
    console.log('');

    // Show usage tip
    if (template.type === 'project') {
      console.log('💡 Use this template:');
      console.log(`   $ linear-create project create --template ${template.id}`);
      console.log('');
      console.log('   Set as default:');
      console.log(`   $ linear-create config set defaultProjectTemplate ${template.id}`);
    } else if (template.type === 'issue') {
      console.log('💡 Use this template:');
      console.log(`   $ linear-create issues create --template ${template.id}`);
      console.log('');
      console.log('   Set as default:');
      console.log(`   $ linear-create config set defaultIssueTemplate ${template.id}`);
    }
    console.log('');
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to fetch template'}`);
    process.exit(1);
  }
}
