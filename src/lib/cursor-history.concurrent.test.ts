import { type ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';

import { CursorHistoryStore } from './cursor-history.js';

interface ChildResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const vitestEntry = join(repoRoot, 'node_modules', 'vitest', 'vitest.mjs');
const workerTest = join(repoRoot, 'src', 'lib', 'cursor-history.concurrent.worker.test.ts');
const children: ChildProcessWithoutNullStreams[] = [];
let root: string | null = null;

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForFiles(paths: string[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!paths.every(existsSync)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `timed out waiting for worker barriers: ${paths.filter(path => !existsSync(path)).join(', ')}`
      );
    }
    await delay(20);
  }
}

function collectChild(
  child: ChildProcessWithoutNullStreams,
  timeoutMs: number
): Promise<ChildResult> {
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
  });
  child.stderr.on('data', chunk => {
    stderr += chunk;
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`child process ${child.pid ?? 'unknown'} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    child.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

afterEach(() => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
    }
  }
  if (root !== null) {
    rmSync(root, { recursive: true, force: true });
    root = null;
  }
});

describe('CursorHistoryStore multiprocess locking', () => {
  it('retains every synchronized successful writer without lock or temp artifacts', async () => {
    root = mkdtempSync(join(tmpdir(), 'a2l-history-concurrent-'));
    const historyPath = join(root, 'state', 'agent2linear', 'cursor-history.json');
    const barrierPrefix = join(root, 'barrier');
    const startPath = `${barrierPrefix}.start`;
    const childConfig = join(root, 'vitest-worker.config.mjs');
    writeFileSync(
      childConfig,
      `export default { root: ${JSON.stringify(repoRoot)}, test: { globals: true, environment: 'node' } };\n`
    );

    const workerIds = Array.from({ length: 6 }, (_, index) => `writer-${index + 1}`);
    const readyPaths = workerIds.map(workerId => `${barrierPrefix}.${workerId}.ready`);
    const results = workerIds.map(workerId => {
      const childEnv: NodeJS.ProcessEnv = {
        ...process.env,
        A2L_CURSOR_HISTORY_CONCURRENCY_WORKER: '1',
        A2L_CURSOR_HISTORY_PATH: historyPath,
        A2L_CURSOR_HISTORY_BARRIER: barrierPrefix,
        A2L_CURSOR_HISTORY_WORKER_ID: workerId,
      };
      delete childEnv.LINEAR_API_KEY;
      delete childEnv.AGENT2LINEAR_WORKSPACE;
      const child = spawn(
        process.execPath,
        [vitestEntry, 'run', '--config', childConfig, workerTest],
        { cwd: repoRoot, env: childEnv, stdio: ['pipe', 'pipe', 'pipe'] }
      );
      child.stdin.end();
      children.push(child);
      return collectChild(child, 30_000);
    });

    await waitForFiles(readyPaths, 20_000);
    writeFileSync(startPath, 'start', { flag: 'wx' });
    const completed = await Promise.all(results);
    expect(completed, completed.map(result => result.stderr || result.stdout).join('\n')).toEqual(
      completed.map(result => ({ ...result, code: 0, signal: null }))
    );

    const parsed = JSON.parse(readFileSync(historyPath, 'utf8'));
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toHaveLength(workerIds.length);
    expect(new Set(parsed.entries.map((entry: { id: string }) => entry.id)).size).toBe(
      workerIds.length
    );

    const store = new CursorHistoryStore({ filePath: historyPath });
    const cursors = store
      .list({ limit: 1000 })
      .map(entry => entry.cursor)
      .sort();
    expect(cursors).toEqual(workerIds.map(workerId => `cursor-${workerId}`).sort());
    expect(readdirSync(dirname(historyPath)).sort()).toEqual(['cursor-history.json']);
  }, 60_000);
});
