import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { verifyAppliedChangeSets } from '../postApplyVerify.service';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';

vi.mock('../../../../core/ai/tools/pathAllowlist', () => ({
  resolveAllowlistedPath: vi.fn((relativePath: string) => ({
    ok: true as const,
    absolutePath: `/workspace/${relativePath}`,
    relativePath,
  })),
  isPlanModeDocumentPath: vi.fn(() => false),
}));

vi.mock('../../../domain/component-designer/drafts', () => ({
  getDesignerDraft: vi.fn((lookup: string) => (
    lookup === 'layout-1' || lookup === 'general/layout-one'
      ? { id: 'layout-1', document: { nodes: { root: {} }, rootNodeId: 'root' } }
      : null
  )),
}));

vi.mock('../../../domain/functions/functionRepository', () => ({
  findManagedFunctionById: vi.fn(async (functionId: string) => {
    if (functionId === 'fn-1') {
      return { id: 'fn-1', code: 'export const ok = true;\n', test_payload: '{}' };
    }
    if (functionId === 'custom.sum-two-numbers') {
      return { id: 'custom.sum-two-numbers', code: 'export const sum = 1;\n', test_payload: '{}' };
    }
    return null;
  }),
}));

vi.mock('../../jobs/jobServerFunctionExecutor', () => ({
  executeManagedFunctionForJob: vi.fn(async () => ({
    statusCode: 200,
    body: { success: true },
  })),
}));

describe('postApplyVerify.service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies file_patch content on disk', async () => {
    const absolutePath = '/workspace/src/example.ts';
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'statSync').mockReturnValue({ isFile: () => true } as fs.Stats);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('export const ok = true;\n');

    const changeSets: ChangeSet[] = [{
      id: 'cs-1',
      kind: 'file_patch',
      title: 'Patch example',
      path: 'src/example.ts',
      content: 'export const ok = true;\n',
    }];

    const result = await verifyAppliedChangeSets(changeSets);
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]?.ok).toBe(true);
    expect(fs.readFileSync).toHaveBeenCalledWith(absolutePath, 'utf8');
  });

  it('reports missing designer draft after component layout apply', async () => {
    const changeSets: ChangeSet[] = [{
      id: 'cs-2',
      kind: 'component_layout_patch',
      title: 'Layout patch',
      layoutId: 'missing-layout',
      patch: { name: 'Missing Layout', folder: 'general', document: { nodes: [], rootNodeId: 'root' } },
    }];

    const result = await verifyAppliedChangeSets(changeSets);
    expect(result.ok).toBe(false);
    expect(result.checks[0]?.ok).toBe(false);
  });

  it('resolves component layout by folder/name path after apply', async () => {
    const changeSets: ChangeSet[] = [{
      id: 'cs-3',
      kind: 'component_layout_patch',
      title: 'Layout patch',
      layoutId: 'missing-slug',
      patch: {
        name: 'Layout One',
        folder: 'general',
        document: { nodes: { root: {} }, rootNodeId: 'root' },
      },
    }];

    const result = await verifyAppliedChangeSets(changeSets);
    expect(result.ok).toBe(true);
    expect(result.checks[0]?.message).toContain('layout-1');
  });

  it('verifies function_source_patch existence, source, and live execution', async () => {
    const source = 'export const ok = true;\n';
    const changeSets: ChangeSet[] = [{
      id: 'cs-fn',
      kind: 'function_source_patch',
      title: 'Patch function',
      functionId: 'fn-1',
      patch: {
        name: 'Fn',
        folder: 'custom',
        method: 'GET',
        path: '/api/custom/fn-1',
        source,
      },
    }];

    const result = await verifyAppliedChangeSets(changeSets);
    expect(result.ok).toBe(true);
    expect(result.checks.map((check) => check.id)).toEqual([
      'function_source_patch:cs-fn:exists',
      'function_source_patch:cs-fn:source',
      'function_source_patch:cs-fn:execute',
    ]);
  });

  it('resolves slug-only functionId to folder.name managed id after apply', async () => {
    const source = 'export const sum = 1;\n';
    const changeSets: ChangeSet[] = [{
      id: 'cs-sum',
      kind: 'function_source_patch',
      title: 'Server function: sum-two-numbers',
      functionId: 'sum-two-numbers',
      patch: {
        name: 'sum-two-numbers',
        folder: 'custom',
        method: 'POST',
        path: '/api/custom/sum-two-numbers',
        source,
      },
    }];

    const result = await verifyAppliedChangeSets(changeSets);
    expect(result.ok).toBe(true);
    expect(result.checks[0]?.message).toContain('custom.sum-two-numbers');
  });
});
