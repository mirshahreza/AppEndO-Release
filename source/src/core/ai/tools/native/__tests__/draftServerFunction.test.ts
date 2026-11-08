import { describe, expect, it, beforeEach } from 'vitest';
import { clearAgentDrafts } from '../agentDraftStore';
import { executeDraftServerFunction, resolveDraftServerFunctionId } from '../draftServerFunction';

describe('draftServerFunction', () => {
  beforeEach(() => {
    clearAgentDrafts();
  });
  it('uses folder.name managed function id for new drafts', async () => {
    expect(resolveDraftServerFunctionId('Sum Two Numbers', 'math')).toBe('math.sum-two-numbers');
    expect(resolveDraftServerFunctionId('Sum Two Numbers')).toBe('general.sum-two-numbers');
  });

  it('preserves explicit functionId when patching', () => {
    expect(resolveDraftServerFunctionId('Any', 'math', 'math.existing-fn')).toBe('math.existing-fn');
  });

  it('stores canonical metadata on draft like manual UI Save', async () => {
    const result = await executeDraftServerFunction({
      name: 'sum-two-numbers',
      folder: 'math',
      method: 'POST',
      source: 'async function handler() {}',
      testPayload: '{\n  "a": 1,\n  "b": 2\n}',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toMatchObject({
      functionId: 'math.sum-two-numbers',
      folder: 'math',
      method: 'POST',
      path: '/api/math/sum-two-numbers',
    });
  });

  it('normalizes export default source and upserts by functionId', async () => {
    const exportDefaultSource = `export default async function sumTwoNumbers(context) {
  return { result: 1 };
}`;

    const first = await executeDraftServerFunction({
      name: 'sum-two-numbers',
      folder: 'math',
      functionId: 'math.sum-two-numbers',
      source: exportDefaultSource,
    });
    const second = await executeDraftServerFunction({
      name: 'sum-two-numbers',
      folder: 'math',
      functionId: 'math.sum-two-numbers',
      source: 'async function handler() { return res.json({ result: 2 }); }',
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.data?.draftId).toBe(first.data?.draftId);

    const changeSets = (await import('../../../validation/changeSetBuilder')).buildChangeSetsFromDrafts();
    expect(changeSets).toHaveLength(1);
    expect(changeSets[0]?.kind).toBe('function_source_patch');
    const patch = changeSets[0]?.kind === 'function_source_patch' ? changeSets[0].patch : {};
    expect(JSON.stringify(patch)).not.toContain('export default');
  });

  it('creates a new function draft while another function is open in page context', async () => {
    const result = await executeDraftServerFunction(
      {
        name: 'multiply-two-numbers',
        folder: 'math',
        functionId: 'math.multiply-two-numbers',
        source: 'async function handler() { return res.json({ product: 1 }); }',
      },
      {
        mode: 'agent',
        allowedGroups: ['draft', 'edge'],
        pageContext: {
          path: '/server-functions/math/sum-two-numbers',
          pageLabel: 'Server Functions',
          pageKey: 'server-functions',
          functionId: 'math.sum-two-numbers',
        },
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const changeSets = (await import('../../../validation/changeSetBuilder')).buildChangeSetsFromDrafts();
    expect(changeSets).toHaveLength(1);
    const patch = changeSets[0]?.kind === 'function_source_patch' ? changeSets[0].patch : {};
    expect(patch).toMatchObject({
      operation: 'create',
      name: 'multiply-two-numbers',
    });
    expect('baseFunctionId' in patch ? patch.baseFunctionId : undefined).toBeUndefined();

    const validation = (await import('../../../validation/proposalValidator')).validateProposal(changeSets, {
      pageContext: {
        path: '/server-functions/math/sum-two-numbers',
        pageLabel: 'Server Functions',
        pageKey: 'server-functions',
        functionId: 'math.sum-two-numbers',
      },
    });
    expect(validation.ok).toBe(true);
  });
});
