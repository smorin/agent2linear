import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const PLAN = 'docs/superpowers/plans/2026-07-22-M34-raw-cursor-pagination-history-tdd.md';
const TRACE = 'docs/superpowers/plans/2026-07-24-M34-traceability.md';
const DOWNSTREAM = [
  'docs/superpowers/plans/2026-07-22-label-project-lifecycle-tdd.md',
  'docs/superpowers/plans/2026-07-22-M35-issue-project-comments-tdd.md',
];

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function planIds(markdown: string): string[] {
  return [...markdown.matchAll(/^\| `(CPH-[A-Z0-9-]+)` \|/gm)]
    .map(match => match[1])
    .filter(id => !id.endsWith('-'));
}

interface TraceRow {
  id: string;
  implementation: string;
  test: string;
  verification: string;
  implementationStatus: string;
  testStatus: string;
  verificationStatus: string;
}

function traceRows(markdown: string): TraceRow[] {
  return [
    ...markdown.matchAll(
      /^\| `(CPH-[A-Z0-9-]+)` \| (BASELINE|DONE|N\/A) \| (GREEN|N\/A) \| (PASS|N\/A) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm
    ),
  ].map(match => ({
    id: match[1],
    implementationStatus: match[2],
    testStatus: match[3],
    verificationStatus: match[4],
    implementation: match[5].trim(),
    test: match[6].trim(),
    verification: match[7].trim(),
  }));
}

describe('M34 ID-level traceability', () => {
  it('[CPH-TST-TRACE][CPH-VER-TRACE] tracks every atomic ID exactly once with complete evidence', () => {
    const ids = planIds(read(PLAN));
    const rows = traceRows(read(TRACE));
    expect(ids).toHaveLength(214);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rows).toHaveLength(ids.length);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.map(row => row.id).sort()).toEqual([...ids].sort());

    for (const row of rows) {
      expect(row.implementation).not.toBe('');
      expect(row.test).not.toBe('');
      expect(row.verification).not.toBe('');
      if (!row.id.startsWith('CPH-DOC-') && !row.id.startsWith('CPH-VER-')) {
        expect(row.testStatus).toBe('GREEN');
        expect(row.test).not.toBe('N/A');
      }
      expect(row.verificationStatus).toBe('PASS');
    }
  });

  it('[CPH-DOC-DEPENDENCY-MAP] accepts only known one-way M34 prerequisites', () => {
    const plan = read(PLAN);
    const known = new Set(planIds(plan));
    expect(plan.match(/\b(?:LPL|CMT)-[A-Z0-9-]+\b/g) ?? []).toEqual([]);

    for (const downstreamPath of DOWNSTREAM) {
      const downstream = read(downstreamPath);
      const references = [...downstream.matchAll(/`(CPH-[A-Z0-9-]+)`/g)]
        .map(match => match[1])
        .filter(id => !id.endsWith('-'));
      expect(references.length).toBeGreaterThan(0);
      for (const reference of references) {
        expect(known.has(reference), downstreamPath + ': ' + reference).toBe(true);
      }
    }
  });

  it('[CPH-TST-LIVE][PR17-R6] wires the guarded pagination harness into live CI', () => {
    expect(read('.github/workflows/live.yml')).toContain(
      'node tests/scripts/test-pagination-live.js'
    );
  });
});
