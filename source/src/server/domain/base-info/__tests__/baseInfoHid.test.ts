import { describe, expect, it } from 'vitest';

import {
  calculateBaseInfoHierarchicalId,
  calculateBaseInfoHidDigitsCount,
  insertBaseInfoNodeWithHid,
  remapBaseInfoHidWithUnpaddedChildSegments,
} from '../baseInfoHid';

describe('baseInfoHid', () => {
  it('allocates root-level hierarchical ids starting at 100', async () => {
    const existing = new Set<string>();
    const id = await calculateBaseInfoHierarchicalId({
      parentId: null,
      childDigits: 3,
      idExists: async (candidate) => existing.has(candidate),
    });
    expect(id).toBe('100');
  });

  it('skips occupied sibling ids under a parent', async () => {
    const existing = new Set(['1.001']);
    const id = await calculateBaseInfoHierarchicalId({
      parentId: '1',
      childDigits: 3,
      idExists: async (candidate) => existing.has(candidate),
    });
    expect(id).toBe('1.002');
  });

  it('derives digit count from last sibling id', async () => {
    const digits = await calculateBaseInfoHidDigitsCount('1', async () => ['1.001', '1.012']);
    expect(digits).toBe(3);
  });

  it('inserts a node after allocating HID', async () => {
    const existing = new Set<string>();
    const inserted: string[] = [];

    const id = await insertBaseInfoNodeWithHid({
      parentId: null,
      childDigits: 3,
      title: 'Root',
      idExists: async (candidate) => existing.has(candidate),
      insert: async (row) => {
        existing.add(row.id);
        inserted.push(row.id);
      },
    });

    expect(id).toBe('100');
    expect(inserted).toEqual(['100']);
  });

  it('unpads child HID segments when remapping a subtree root', () => {
    expect(remapBaseInfoHidWithUnpaddedChildSegments('120', '120', '100.4')).toBe('100.4');
    expect(remapBaseInfoHidWithUnpaddedChildSegments('120.001', '120', '100.4')).toBe('100.4.1');
    expect(remapBaseInfoHidWithUnpaddedChildSegments('120.003.002', '120', '100.4')).toBe('100.4.3.2');
    expect(remapBaseInfoHidWithUnpaddedChildSegments('121.001.001.002', '121', '100.5')).toBe('100.5.1.1.2');
  });
});
