import { Command } from 'commander';
import { realpathSync } from 'fs';
import { resolve } from 'path';

import { registerAliasCommands } from './commands/alias/register.js';
import { registerCacheCommands } from './commands/cache/register.js';
import { registerColorsCommands } from './commands/colors/register.js';
import { registerConfigCommands } from './commands/config/register.js';
import { registerCursorHistoryCommands } from './commands/cursor-history/register.js';
import { registerCyclesCommands } from './commands/cycles/register.js';
import { doctorCommand } from './commands/doctor.js';
import { registerIconsCommands } from './commands/icons/register.js';
// Per-entity command registrations
import { registerInitiativesCommands } from './commands/initiatives/register.js';
import { registerIssueCommands } from './commands/issue/register.js';
import { registerIssueLabelsCommands } from './commands/issue-labels/register.js';
import { registerLabelsShim } from './commands/labels/register.js';
import { registerMembersCommands } from './commands/members/register.js';
import { registerMilestoneTemplatesCommands } from './commands/milestone-templates/register.js';
import { registerProfileCommands } from './commands/profile/register.js';
import { registerProjectCommands } from './commands/project/register.js';
import { registerProjectLabelsCommands } from './commands/project-labels/register.js';
import { registerProjectStatusCommands } from './commands/project-status/register.js';
import { registerPromptCommands } from './commands/prompt/register.js';
import { setup } from './commands/setup.js';
import { registerTeamsCommands } from './commands/teams/register.js';
import { registerTemplatesCommands } from './commands/templates/register.js';
import { whoamiCommand } from './commands/whoami.js';
import { registerWorkflowStatesCommands } from './commands/workflow-states/register.js';
import { registerWorkspaceCommands } from './commands/workspace/register.js';
import { API_KEY_MIGRATION_GUIDANCE, readApiKeyFile } from './lib/api-key-input.js';
import { inferErrorOutputMode, UsageError } from './lib/cli-error.js';
import { isExplicitConfigMutationCommand, loadExplicitConfig } from './lib/explicit-config.js';
import {
  assertInteractionAllowed,
  commandRequiresInteractiveInput,
} from './lib/interaction-policy.js';
import { setInvocationContext } from './lib/invocation-context.js';
import { configureDiagnostics, logger } from './lib/logger.js';
import { setNoColor } from './lib/output.js';
import { assertOutputOptionCompatibility } from './lib/output-mode.js';
import { stdinAllocationConflict } from './lib/stdin-allocation.js';
import { CLI_VERSION } from './lib/version.js';

const cli = new Command();

// Let the process boundary render one stable error and set the documented exit.
// Help/version still render normally and are recognized as successful Commander exits.
cli
  .exitOverride()
  .configureOutput({
    outputError: () => undefined,
    writeErr: value => {
      if (inferErrorOutputMode(process.argv.slice(2)) !== 'json') {
        process.stderr.write(value);
      }
    },
  })
  .showSuggestionAfterError(true)
  .showHelpAfterError();

cli
  .name('agent2linear')
  .description(
    'Command-line tool for creating Linear issues and projects. Designed for AI agents and automation.'
  )
  .version(`agent2linear ${CLI_VERSION}`)
  .option('-q, --quiet', 'Suppress progress messages (errors still shown)')
  .option(
    '-v, --verbose',
    'Increase diagnostic detail (repeatable: -vv, -vvv)',
    (_value, previous: number) => Math.min(previous + 1, 3),
    0
  )
  .option('--debug', 'Emit maximum redacted diagnostics and bug-report context')
  .option('--no-input', 'Never prompt; explicit stdin payloads remain allowed')
  .option('--no-color', 'Disable emojis and colored output')
  .option('--workspace <name>', 'Select workspace/profile for this invocation')
  .option('--api-key-file <path>', 'Read one Linear API key from a file or stdin (-)')
  .option('--config <path>', 'Use one explicit JSON config file (read-only)')
  .option(
    '-C, --cwd <dir>',
    'Resolve config, override matching, and relative paths as if launched in <dir> (else $AGENT2LINEAR_CWD, else the current directory)'
  )
  .hook('preAction', async (thisCommand, actionCommand) => {
    const opts = thisCommand.opts();
    const actionOptions = actionCommand.opts();
    const noInput = actionCommand.optsWithGlobals().input === false;
    const commandPath: string[] = [];
    for (
      let command: Command | null = actionCommand;
      command !== null && command !== thisCommand;
      command = command.parent
    ) {
      commandPath.unshift(command.name());
    }
    configureDiagnostics({
      debug: opts.debug === true,
      quiet: opts.quiet === true,
      verbosity: opts.verbose,
    });
    if (opts.color === false) setNoColor(true);
    assertOutputOptionCompatibility({
      json: actionOptions.json === true,
      output: actionOptions.output,
      outputSource:
        actionCommand.getOptionValueSource('output') === 'default' ? 'default' : 'explicit',
    });

    // M36: apply git-style -C before resolving any relative input paths,
    // including --config.
    const rawCwd = opts.cwd ?? process.env.AGENT2LINEAR_CWD;
    let contextDir: string | undefined;
    if (rawCwd) {
      try {
        contextDir = realpathSync(rawCwd);
      } catch {
        throw new Error(`--cwd directory not found or unreadable: ${rawCwd}`);
      }
      process.chdir(contextDir);
    }

    logger.operation(`command=${commandPath.join(' ') || 'agent2linear'}`);
    logger.internal('invocation resolution', {
      command: commandPath.join(' ') || 'agent2linear',
      contextDir: contextDir ?? process.cwd(),
      explicitConfig: opts.config === undefined ? null : resolve(process.cwd(), opts.config),
    });

    if (commandPath.join(' ') === 'config set' && actionCommand.processedArgs[0] === 'apiKey') {
      throw new UsageError(
        `config set apiKey <value> is not supported because it exposes an API key in argv; ${API_KEY_MIGRATION_GUIDANCE}`
      );
    }
    if (
      commandPath.join(' ') === 'config edit' &&
      actionOptions.key === 'apiKey' &&
      actionOptions.value !== undefined
    ) {
      throw new UsageError(
        `config edit --key apiKey --value <value> is not supported because it exposes an API key in argv; ${API_KEY_MIGRATION_GUIDANCE}`
      );
    }

    if (opts.config !== undefined && isExplicitConfigMutationCommand(commandPath)) {
      throw new UsageError(
        '--config is a read-only resolution selector and cannot be combined with configuration mutations; use --global or --project to select a write scope.'
      );
    }

    assertInteractionAllowed(commandPath, noInput, process.stdin.isTTY === true);

    const explicitConfig =
      opts.config === undefined
        ? undefined
        : loadExplicitConfig(resolve(process.cwd(), opts.config));

    // Detect comment body/API-key stdin contention before either consumer reads.
    const stdinConflict = stdinAllocationConflict({
      apiKeyFile: opts.apiKeyFile,
      commandPath,
      body: actionOptions.body,
      bodyFile: actionOptions.bodyFile,
      description: actionOptions.description,
      destructiveConfirmation:
        actionOptions.trash === true ||
        new Set([
          'alias clear',
          'cursor-history clear',
          'issue-labels delete',
          'issue-labels retire',
          'milestone-templates remove',
          'project dependencies clear',
          'project-labels delete',
          'project-labels retire',
          'workflow-states delete',
        ]).has(commandPath.join(' ')),
      interactiveInput:
        actionOptions.interactive === true || commandRequiresInteractiveInput(commandPath),
      noInput,
      stdinIsTTY: process.stdin.isTTY === true,
      title: actionOptions.title,
      yes: actionOptions.yes === true,
    });
    if (stdinConflict) {
      throw new UsageError(stdinConflict);
    }

    // Resolve the safe key source eagerly so getApiKey() remains synchronous.
    const apiKeyFromStdin = opts.apiKeyFile === '-';
    const apiKey =
      opts.apiKeyFile === undefined
        ? undefined
        : await readApiKeyFile(
            opts.apiKeyFile === '-' ? '-' : resolve(process.cwd(), opts.apiKeyFile)
          );

    setInvocationContext({
      noInput,
      stdinIsTTY: process.stdin.isTTY === true,
      workspace: opts.workspace,
      apiKey,
      apiKeyFromStdin,
      contextDir,
      explicitConfig,
    });
  });

// Register all entity command groups
registerInitiativesCommands(cli);
registerProjectCommands(cli);
registerTeamsCommands(cli);
registerMembersCommands(cli);
registerProjectStatusCommands(cli);
registerAliasCommands(cli);
registerMilestoneTemplatesCommands(cli);
registerTemplatesCommands(cli);
registerConfigCommands(cli);
registerWorkflowStatesCommands(cli);
registerIssueLabelsCommands(cli);
registerProjectLabelsCommands(cli);
registerIconsCommands(cli);
registerColorsCommands(cli);
registerCacheCommands(cli);
registerCursorHistoryCommands(cli);
registerIssueCommands(cli);
registerCyclesCommands(cli);
registerWorkspaceCommands(cli);
registerProfileCommands(cli);
registerPromptCommands(cli);

// Stub command groups (future releases)
const issues = cli
  .command('issues')
  .alias('iss')
  .description('Manage Linear issues [Coming Soon]');

issues
  .command('create')
  .alias('new')
  .description('Create a new issue [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

issues
  .command('list')
  .alias('ls')
  .description('List issues [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

const milestones = cli
  .command('milestones')
  .alias('mile')
  .description('Manage project milestones [Coming Soon]');

milestones
  .command('list')
  .alias('ls')
  .description('List milestones [Not yet implemented]')
  .action(() => {
    console.log('⚠️  This command is not yet implemented.');
    console.log('   See MILESTONES.md for planned features and timeline.');
  });

registerLabelsShim(cli);

// Top-level commands
cli
  .command('whoami')
  .description('Display authenticated user info')
  .addHelpText(
    'after',
    `
Examples:
  $ agent2linear whoami    # Show your name, email, organization, and API key

Displays the identity associated with your configured Linear API key.
`
  )
  .action(async () => {
    await whoamiCommand();
  });

cli
  .command('doctor')
  .description('Run diagnostic checks on your agent2linear environment')
  .addHelpText(
    'after',
    `
Examples:
  $ agent2linear doctor    # Run all diagnostic checks

Checks:
  • API key configuration
  • API connectivity
  • Default team/initiative settings
  • Cache health
  • Alias counts
`
  )
  .action(async () => {
    await doctorCommand();
  });

cli
  .command('setup')
  .description('Interactive first-time setup wizard')
  .addHelpText(
    'after',
    `
Examples:
  $ agent2linear setup    # Run interactive setup wizard

This command will guide you through:
  • Setting up your Linear API key
  • Selecting your default team
  • Configuring optional defaults
  • Learning about key commands
`
  )
  .action(async () => {
    await setup();
  });

export { cli };
