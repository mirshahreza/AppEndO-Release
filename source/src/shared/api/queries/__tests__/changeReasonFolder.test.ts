import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHANGE_REASON_API_META_KEY, ensureChangeReasonFolder } from '../changeReasonFolder';

vi.mock('../base-info', () => ({
  fetchBaseInfoNode: vi.fn(),
  fetchBaseInfoChildren: vi.fn(),
  createBaseInfoNode: vi.fn(),
}));

import { createBaseInfoNode, fetchBaseInfoChildren, fetchBaseInfoNode } from '../base-info';

const fetchBaseInfoNodeMock = vi.mocked(fetchBaseInfoNode);
const fetchBaseInfoChildrenMock = vi.mocked(fetchBaseInfoChildren);
const createBaseInfoNodeMock = vi.mocked(createBaseInfoNode);

describe('ensureChangeReasonFolder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses a stored situation folder when the node still exists', async () => {
    fetchBaseInfoNodeMock.mockResolvedValue({ id: '100.6.47', parentId: '100.6' });
    await expect(ensureChangeReasonFolder({
      ownerKey: 'function:fn-profile',
      title: 'PUT /api/profile',
      storedNodeId: '100.6.47',
    })).resolves.toBe('100.6.47');
    expect(createBaseInfoNodeMock).not.toHaveBeenCalled();
  });

  it('finds an existing folder by owner metadata before creating', async () => {
    fetchBaseInfoChildrenMock.mockResolvedValue([
      {
        id: '100.6.48',
        parent_id: '100.6',
        label: 'PUT /api/profile',
        is_active: true,
        metadata: JSON.stringify({ [CHANGE_REASON_API_META_KEY]: 'function:fn-profile' }),
      },
    ]);
    await expect(ensureChangeReasonFolder({
      ownerKey: 'function:fn-profile',
      title: 'PUT /api/profile',
    })).resolves.toBe('100.6.48');
    expect(createBaseInfoNodeMock).not.toHaveBeenCalled();
  });

  it('creates a folder under 100.6 tagged with the API owner', async () => {
    fetchBaseInfoChildrenMock.mockResolvedValue([]);
    createBaseInfoNodeMock.mockResolvedValue({ success: true, id: '100.6.49' });
    await expect(ensureChangeReasonFolder({
      ownerKey: 'function:fn-profile',
      title: 'PUT /api/profile',
    })).resolves.toBe('100.6.49');
    expect(createBaseInfoNodeMock).toHaveBeenCalledWith(expect.objectContaining({
      parentId: '100.6',
      title: 'PUT /api/profile',
      metadata: JSON.stringify({ [CHANGE_REASON_API_META_KEY]: 'function:fn-profile' }),
    }));
  });
});
