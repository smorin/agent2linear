import { describe, expect,it } from 'vitest';

describe('Vitest setup', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const message: string = 'Hello, Vitest!';
    expect(message).toContain('Vitest');
    expect(message).toHaveLength(14);
  });

  it('should support async tests', async () => {
    const promise = Promise.resolve(42);
    await expect(promise).resolves.toBe(42);
  });

  it('should support objects and arrays', () => {
    const obj = { name: 'test', value: 123 };
    expect(obj).toEqual({ name: 'test', value: 123 });

    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });
});
