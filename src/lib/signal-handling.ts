import { flushDiagnosticBuffer } from './logger.js';

interface SignalRuntime {
  exit(code: number): void;
  once(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  stdout: {
    on(event: 'error', listener: (error: NodeJS.ErrnoException) => void): unknown;
  };
}

interface SignalHandlerOptions {
  flush?: () => Promise<void> | void;
  runtime?: SignalRuntime;
}

function waitForWrites(stream: NodeJS.WriteStream): Promise<void> {
  return new Promise(resolve => stream.write('', () => resolve()));
}

async function flushProcessStreams(): Promise<void> {
  flushDiagnosticBuffer();
  await Promise.all([waitForWrites(process.stdout), waitForWrites(process.stderr)]);
}

export function installProcessSignalHandlers(options: SignalHandlerOptions = {}): void {
  const runtime = options.runtime ?? process;
  const flush = options.flush ?? flushProcessStreams;
  let shuttingDown = false;

  const shutdown = async (exitCode: 130 | 143): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    try {
      await flush();
    } finally {
      runtime.exit(exitCode);
    }
  };

  runtime.once('SIGINT', () => void shutdown(130));
  runtime.once('SIGTERM', () => void shutdown(143));
  runtime.stdout.on('error', error => {
    if (error.code === 'EPIPE') {
      runtime.exit(0);
      return;
    }
    throw error;
  });
}
