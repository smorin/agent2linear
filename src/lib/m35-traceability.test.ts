import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PLAN = 'docs/superpowers/plans/2026-07-22-M35-issue-project-comments-tdd.md';
const TRACE = 'docs/superpowers/plans/2026-07-24-M35-traceability.md';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function uniquePlanIds(markdown: string): string[] {
  return [
    ...new Set(
      [...markdown.matchAll(/^\|\s+\x60(CMT-[A-Z0-9-]+)\x60\s+\|/gm)]
        .map(match => match[1])
        .filter(id => !id.endsWith('-'))
    ),
  ];
}

interface TraceRow {
  id: string;
  implementationStatus: string;
  testStatus: string;
  verificationStatus: string;
  implementation: string;
  test: string;
  verification: string;
}

function traceRows(markdown: string): TraceRow[] {
  return [
    ...markdown.matchAll(
      /^\|\s+\x60(CMT-[A-Z0-9-]+)\x60\s+\|\s*(BASELINE|DONE|N\/A)\s*\|\s*(GREEN|N\/A)\s*\|\s*(PASS|N\/A)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm
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

describe('M35 ID-level traceability', () => {
  it('[CMT-TST-TRACE][CMT-VER-TRACE] tracks all 318 unique IDs exactly once', () => {
    const ids = uniquePlanIds(read(PLAN));
    const rows = traceRows(read(TRACE));
    expect(ids).toHaveLength(318);
    expect(rows).toHaveLength(318);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.map(row => row.id).sort()).toEqual([...ids].sort());

    for (const row of rows) {
      expect(row.implementation).not.toBe('');
      expect(row.test).not.toBe('');
      expect(row.verification).not.toBe('');
      if (!row.id.startsWith('CMT-DOC-') && !row.id.startsWith('CMT-VER-')) {
        expect(row.testStatus).toBe('GREEN');
        expect(row.test).not.toBe('N/A');
      }
      expect(row.verificationStatus).toBe('PASS');
    }
  });

  it('[CMT-API-PROJECT-QUERY] records the live-proven filtered top-level connection', () => {
    const plan = read(PLAN);
    const trace = read(TRACE);
    expect(plan).toContain('comments(filter:{and:[project ID,projectUpdate:null]}');
    expect(plan).not.toContain('CMT-API-PROJECT-QUERY\x60 | \x60project(id){comments');
    expect(trace).toContain('projectUpdate: { null: true }');
  });
});
