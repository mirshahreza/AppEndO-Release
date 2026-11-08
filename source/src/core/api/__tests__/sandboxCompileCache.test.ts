import { describe, expect, it } from 'vitest';
import { compileSandboxSource, invalidateSandboxCompileCache } from '../sandboxCompileCache';

describe('sandboxCompileCache', () => {
  it('returns identical compiled output for repeated source', async () => {
    invalidateSandboxCompileCache();
    const source = 'export default async function handler() { return 1; }';

    const first = await compileSandboxSource(source, 'ts', 'v20.x');
    const second = await compileSandboxSource(source, 'ts', 'v20.x');

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });

  it('invalidates only the matching compiled source entry', async () => {
    invalidateSandboxCompileCache();
    const sourceA = 'export default async function handlerA() { return 1; }';
    const sourceB = 'export default async function handlerB() { return 2; }';

    const compiledA = await compileSandboxSource(sourceA, 'ts', 'v20.x');
    const compiledB = await compileSandboxSource(sourceB, 'ts', 'v20.x');

    invalidateSandboxCompileCache(sourceA, 'ts', 'v20.x');

    const afterInvalidateA = await compileSandboxSource(sourceA, 'ts', 'v20.x');
    const cachedB = await compileSandboxSource(sourceB, 'ts', 'v20.x');

    expect(afterInvalidateA).toBe(compiledA);
    expect(cachedB).toBe(compiledB);
  });
});
