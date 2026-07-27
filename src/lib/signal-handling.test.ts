import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { installProcessSignalHandlers } from './signal-handling.js';

class FakeRuntime extends EventEmitter {
  readonly stdout = new EventEmitter();
  readonly exit = vi.fn<(code: number) => void>();
}

describe('M36 process signal handling', () => {
  it('[RLS-SIGNAL-INT] flushes once before exiting 130', async () => {
    const runtime = new FakeRuntime();
    const events: string[] = [];
    const flush = vi.fn(async () => {
      events.push('flush');
    });
    runtime.exit.mockImplementation(code => {
      events.push(`exit:${code}`);
    });

    installProcessSignalHandlers({ runtime, flush });
    runtime.emit('SIGINT');
    await vi.waitFor(() => expect(runtime.exit).toHaveBeenCalledWith(130));

    expect(events).toEqual(['flush', 'exit:130']);
  });

  it('[RLS-SIGNAL-TERM] flushes once before exiting 143', async () => {
    const runtime = new FakeRuntime();
    const events: string[] = [];
    const flush = vi.fn(async () => {
      events.push('flush');
    });
    runtime.exit.mockImplementation(code => {
      events.push(`exit:${code}`);
    });

    installProcessSignalHandlers({ runtime, flush });
    runtime.emit('SIGTERM');
    await vi.waitFor(() => expect(runtime.exit).toHaveBeenCalledWith(143));

    expect(events).toEqual(['flush', 'exit:143']);
  });

  it('serializes duplicate shutdown signals while a flush is pending', async () => {
    const runtime = new FakeRuntime();
    let releaseFlush: (() => void) | undefined;
    const flush = vi.fn(
      () =>
        new Promise<void>(resolve => {
          releaseFlush = resolve;
        })
    );

    installProcessSignalHandlers({ runtime, flush });
    runtime.emit('SIGINT');
    runtime.emit('SIGTERM');
    releaseFlush?.();
    await vi.waitFor(() => expect(runtime.exit).toHaveBeenCalledWith(130));

    expect(flush).toHaveBeenCalledOnce();
    expect(runtime.exit).toHaveBeenCalledOnce();
  });

  it('[RLS-SIGNAL-PIPE] exits quietly for stdout EPIPE only', () => {
    const runtime = new FakeRuntime();
    installProcessSignalHandlers({ runtime, flush: vi.fn() });

    runtime.stdout.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }));

    expect(runtime.exit).toHaveBeenCalledOnce();
    expect(runtime.exit).toHaveBeenCalledWith(0);
  });

  it('does not swallow unrelated stdout errors', () => {
    const runtime = new FakeRuntime();
    installProcessSignalHandlers({ runtime, flush: vi.fn() });
    const error = Object.assign(new Error('write failed'), { code: 'EIO' });

    expect(() => runtime.stdout.emit('error', error)).toThrow(error);
    expect(runtime.exit).not.toHaveBeenCalled();
  });
});
