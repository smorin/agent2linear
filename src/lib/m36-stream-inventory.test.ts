import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

interface EvidenceGroup {
  commands: string[];
  file: string;
  markers: string[];
}

const expectedCommands = [
  'cursor-history clear',
  'cursor-history list',
  'cursor-history view',
  'issue comment add',
  'issue comment list',
  'issue create',
  'issue list',
  'issue update',
  'issue view',
  'issue-labels create',
  'issue-labels delete',
  'issue-labels list',
  'issue-labels restore',
  'issue-labels retire',
  'issue-labels update',
  'project comment add',
  'project comment list',
  'project create',
  'project dependencies list',
  'project list',
  'project update',
  'project view',
  'project-labels create',
  'project-labels delete',
  'project-labels list',
  'project-labels restore',
  'project-labels retire',
  'project-labels update',
];

const runnerEvidence: EvidenceGroup[] = [
  {
    commands: ['issue list'],
    file: 'src/commands/issue/list.pagination.test.ts',
    markers: ['CPH-OPT-ISSUE-JSON', 'CPH-HIS-WRITE-FAILURE'],
  },
  {
    commands: ['project list'],
    file: 'src/commands/project/list.pagination.test.tsx',
    markers: ['CPH-OUT-PAGE-JSON', 'CPH-HIS-WRITE-FAILURE'],
  },
  {
    commands: ['project view', 'project dependencies list'],
    file: 'src/commands/project/read-output.test.ts',
    markers: ['RLS-OUT-PROJECT-VIEW', 'RLS-OUT-PROJECT-DEPENDENCIES-LIST'],
  },
  {
    commands: ['project create'],
    file: 'src/commands/project/json-errors.test.ts',
    markers: ['project create --json --dry-run', 'RLS-OUT-JSON-ERROR'],
  },
  {
    commands: ['project update'],
    file: 'src/commands/project/update.lifecycle.test.ts',
    markers: ['RLS-OUT-PROJECT-UPDATE', 'RLS-OUT-JSON-ERROR'],
  },
  {
    commands: ['issue create', 'issue update', 'issue view'],
    file: 'src/commands/issue/output-json.test.ts',
    markers: ['issue create', 'issue update', 'absent JSON view', 'RLS-OUT-JSON-ERROR'],
  },
  {
    commands: [
      'issue-labels create',
      'issue-labels update',
      'issue-labels delete',
      'issue-labels retire',
      'issue-labels restore',
      'issue-labels list',
      'project-labels create',
      'project-labels update',
      'project-labels delete',
      'project-labels retire',
      'project-labels restore',
      'project-labels list',
    ],
    file: 'src/commands/labels/runner.test.ts',
    markers: [
      '%s label create emits a mutation-free JSON plan',
      '%s label update emits a mutation-free JSON plan',
      '%s label delete emits a mutation-free JSON plan',
      '%s label %s emits a mutation-free JSON plan',
      'RLS-OUT-ISSUE-LABELS-LIST',
      'RLS-OUT-PROJECT-LABELS-LIST',
      'LPL-OUT-JSON-DELETE',
    ],
  },
  {
    commands: [
      'issue comment add',
      'issue comment list',
      'project comment add',
      'project comment list',
    ],
    file: 'src/commands/comment/runner.test.ts',
    markers: ['CMT-TST-%s-ADD', 'CMT-TST-%s-LIST', 'CMT-OUT-NO-PARTIAL'],
  },
  {
    commands: ['cursor-history list', 'cursor-history view', 'cursor-history clear'],
    file: 'src/commands/cursor-history/register.test.ts',
    markers: ['CPH-CMD-HISTORY-LIST', 'CPH-CMD-HISTORY-VIEW', 'CPH-OPT-HISTORY-CLEAR-DRYRUN'],
  },
];

const builtEvidence = [
  {
    file: 'tests/scripts/test-m36-output-cli.js',
    markers: ['const quiet = run', 'assertJsonError', 'JSON.parse(json.stdout)'],
  },
  {
    file: 'tests/scripts/test-m36-output-migrations-cli.js',
    markers: ['const commands = [', "'--output', 'json'", "'--json'"],
  },
  {
    file: 'tests/scripts/test-comments-cli.sh',
    markers: ['issue comment', 'project comment'],
  },
  {
    file: 'tests/scripts/test-label-lifecycle-cli.sh',
    markers: ['issue-labels', 'project-labels'],
  },
  {
    file: 'tests/scripts/test-cursor-history-cli.sh',
    markers: ['cursor-history list', 'cursor-history clear'],
  },
];

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('M36 result-stream evidence inventory', () => {
  it('[RLS-TST-STREAMS] assigns runner evidence to every named result command exactly once', () => {
    const actual = runnerEvidence.flatMap(group => group.commands).sort();
    expect(actual).toEqual(expectedCommands);
    expect(new Set(actual).size).toBe(actual.length);

    for (const evidence of runnerEvidence) {
      const source = read(evidence.file);
      for (const marker of evidence.markers) {
        expect(source, `${evidence.file} must retain ${marker}`).toContain(marker);
      }
    }
  });

  it('[RLS-TST-STREAMS] retains built-CLI success, quiet, error, and family probes', () => {
    for (const evidence of builtEvidence) {
      const source = read(evidence.file);
      for (const marker of evidence.markers) {
        expect(source, `${evidence.file} must retain ${marker}`).toContain(marker);
      }
    }
  });
});
