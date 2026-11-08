import { describe, expect, it } from 'vitest';
import {
  buildManagedServerFunctionPath,
  resolveManagedFunctionIdFromChangeSet,
  resolveServerFunctionDraftMetadata,
} from '../serverFunctionManualParity';
import type { ChangeSet } from '../../../shared/api/contracts/ai/agentTypes';

describe('serverFunctionManualParity', () => {
  it('builds path like Server Functions UI', () => {
    expect(buildManagedServerFunctionPath('math', 'sum-two-numbers')).toBe('/api/math/sum-two-numbers');
  });

  it('resolves canonical draft metadata', () => {
    const metadata = resolveServerFunctionDraftMetadata({
      name: 'Sum Two Numbers',
      folder: 'math',
      method: 'POST',
    });

    expect(metadata).toMatchObject({
      functionId: 'math.sum-two-numbers',
      name: 'sum-two-numbers',
      folder: 'math',
      method: 'POST',
      path: '/api/math/sum-two-numbers',
    });
    expect(metadata.testPayload).toBe('{}');
  });

  it('resolves slug-only change set id to folder.name', () => {
    const changeSet: ChangeSet = {
      id: 'cs-1',
      kind: 'function_source_patch',
      title: 'fn',
      functionId: 'sum-two-numbers',
      patch: {
        name: 'sum-two-numbers',
        folder: 'math',
        source: 'export {}',
      },
    };

    expect(resolveManagedFunctionIdFromChangeSet(changeSet)).toBe('math.sum-two-numbers');
  });
});
