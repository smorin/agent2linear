import type { Command } from 'commander';

export interface LabelsShimDependencies {
  writeStdout(value: string): void;
  writeStderr(value: string): void;
}

const defaultDependencies: LabelsShimDependencies = {
  writeStdout: value => process.stdout.write(value),
  writeStderr: value => process.stderr.write(value),
};

const WARNING =
  'warning: labels is deprecated and will be removed in v2.0.0; use issue-labels or project-labels instead\n';

export function registerLabelsShim(
  cli: Command,
  dependencies: LabelsShimDependencies = defaultDependencies
): void {
  const labels = cli
    .command('labels')
    .alias('lbl')
    .description('Compatibility help for issue-labels and project-labels (deprecated)');

  labels
    .command('list')
    .alias('ls')
    .description('Show the canonical issue-label and project-label list commands')
    .action(() => {
      dependencies.writeStderr(WARNING);
      dependencies.writeStdout(
        'Use one of:\n' + '  a2l issue-labels list\n' + '  a2l project-labels list\n'
      );
    });
}
