import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PLAN = 'docs/superpowers/plans/2026-07-22-label-project-lifecycle-tdd.md';
const TRACE = 'docs/superpowers/plans/2026-07-24-M33-traceability.md';

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function uniquePlanIds(markdown: string): string[] {
  return [
    ...new Set([...markdown.matchAll(/^\|\s*(LPL-[A-Z0-9-]+)\s*\|/gm)].map(match => match[1])),
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
      /^\|\s+\x60(LPL-[A-Z0-9-]+)\x60\s+\|\s*(BASELINE|DONE|N\/A)\s*\|\s*(GREEN|N\/A)\s*\|\s*(PASS|N\/A)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm
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

describe('M33 ID-level traceability', () => {
  it('[LPL-TST-TRACE][LPL-VER-TRACE] tracks all 317 unique IDs exactly once', () => {
    const plan = read(PLAN);
    const ids = uniquePlanIds(plan);
    const rows = traceRows(read(TRACE));

    expect(ids).toHaveLength(317);
    expect(rows).toHaveLength(317);
    expect(new Set(rows.map(row => row.id)).size).toBe(rows.length);
    expect(rows.map(row => row.id).sort()).toEqual([...ids].sort());
    expect(plan).not.toMatch(
      /\|\s*(?:NS|RED|FAIL)\s*\|\s*(?:NS|RED|GREEN|N\/A)\s*\|\s*(?:NS|PASS|FAIL|N\/A)\s*\|$/m
    );

    for (const row of rows) {
      expect(row.implementation).not.toBe('');
      expect(row.test).not.toBe('');
      expect(row.verification).not.toBe('');
      if (!row.id.startsWith('LPL-DOC-') && !row.id.startsWith('LPL-VER-')) {
        expect(row.testStatus).toBe('GREEN');
        expect(row.test).not.toBe('N/A');
      }
      expect(row.verificationStatus).toBe('PASS');
    }
  });

  it('[LPL-API-PROJ-TRASHED-PAYLOAD] records the live-proven lifecycle mutations', () => {
    const plan = read(PLAN);
    const conformance = read('CONFORMANCE.md');
    expect(plan).toContain('archiveProject(id, { trash: true })');
    expect(plan).toContain('unarchiveProject(id)');
    expect(plan).toContain('never send them through `projectUpdate`');
    expect(conformance).toContain('Linear returned an internal server error');
  });

  it('[LPL-OUT-ORDER] records the supported createdAt provider order', () => {
    const plan = read(PLAN);
    const readme = read('README.md');
    expect(plan).not.toContain('stable name ordering');
    expect(plan).not.toContain('stable name order');
    expect(plan).toContain('createdAt');
    expect(readme).toContain('createdAt');
  });
});
