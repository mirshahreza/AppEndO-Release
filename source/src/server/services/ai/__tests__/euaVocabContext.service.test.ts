import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EuaVocabContextService } from '../euaVocabContext.service';

const getBaseInfoNodeForForm = vi.fn();
const updateBaseInfoNode = vi.fn();

vi.mock('../../../domain/base-info/treeRepository', () => ({
  getBaseInfoNodeForForm: (...args: unknown[]) => getBaseInfoNodeForForm(...args),
  updateBaseInfoNode: (...args: unknown[]) => updateBaseInfoNode(...args),
}));

vi.mock('../../baseInfoOptionsCache', () => ({
  invalidateBaseInfoOptionsCache: vi.fn(),
}));

describe('EuaVocabContextService', () => {
  const service = new EuaVocabContextService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('patches semantic fields into metadata and note', async () => {
    getBaseInfoNodeForForm
      .mockResolvedValueOnce({
        id: '212110.001',
        parentId: '212110',
        title: 'Reason A',
        shortName: '',
        viewOrder: 1,
        note: 'Old',
        metadata: '{}',
        value: null,
        isActive: true,
        uiColor: '',
        uiHtml: '',
        locales: {},
      })
      .mockResolvedValueOnce({
        id: '212110.001',
        parentId: '212110',
        title: 'Reason A',
        shortName: '',
        viewOrder: 1,
        note: 'Help text',
        metadata: JSON.stringify({ userGuidance: 'Help text', semanticRubric: 'Rubric' }),
        value: null,
        isActive: true,
        uiColor: '',
        uiHtml: '',
        locales: {},
      });

    updateBaseInfoNode.mockResolvedValue(undefined);

    const record = await service.patchSemanticContext(
      '212110.001',
      {
        userGuidance: 'Help text',
        semanticRubric: 'Rubric',
        expectedParentId: '212110',
      },
      1,
    );

    expect(updateBaseInfoNode).toHaveBeenCalledOnce();
    expect(record.userGuidance).toBe('Help text');
    expect(record.semanticRubric).toBe('Rubric');
  });

  it('rejects when parent guard fails', async () => {
    getBaseInfoNodeForForm.mockResolvedValue({
      id: '212110.001',
      parentId: '999',
      title: 'Reason A',
      shortName: '',
      viewOrder: 1,
      note: '',
      metadata: '',
      value: null,
      isActive: true,
      uiColor: '',
      uiHtml: '',
      locales: {},
    });

    await expect(service.patchSemanticContext(
      '212110.001',
      { userGuidance: 'x', semanticRubric: 'y', expectedParentId: '212110' },
      1,
    )).rejects.toMatchObject({ statusCode: 403 });
  });
});
