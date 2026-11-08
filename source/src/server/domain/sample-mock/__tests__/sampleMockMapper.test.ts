import { describe, expect, it } from 'vitest';
import {
  parseSampleMockIncludes,
  sampleMockPhotoSrc,
  serializeSampleMockIncludes,
} from '../../../../shared/api/contracts/sample-mock/records';
import {
  computeSampleMockDepths,
  mapSampleMockRecord,
  type SampleMockRecordRow,
} from '../sampleMockMapper';

const baseRow = (overrides: Partial<SampleMockRecordRow> = {}): SampleMockRecordRow => ({
  id: 10n,
  parentId: 1n,
  code: 'ORD-001',
  title: 'Order 1',
  subtitle: 'Customer 1',
  website: 'https://example.com/orders/ord-001',
  photo: 'https://i.pravatar.cc/160?img=12',
  statusId: 2n,
  ownerId: 3n,
  locked: false,
  active: true,
  latitude: 35.6892,
  longitude: 51.389,
  approvedAt: null,
  approvedBy: null,
  lockedAt: null,
  lockedBy: null,
  unlockedAt: null,
  unlockedBy: null,
  createdAt: new Date('2026-03-01T09:30:00.000Z'),
  createdBy: 3n,
  updatedAt: new Date('2026-03-01T09:30:00.000Z'),
  updatedBy: 3n,
  parent: { id: 1n, title: 'Region 1', code: 'REG-1' },
  status: { id: 2n, title: 'Open', code: 'open' },
  owner: { id: 3n, username: 'nina.vale', displayName: 'Nina Vale' },
  detail: { city: 'North Harbor', note: 'Fulfill from North Harbor' },
  comments: [{ body: 'Need follow-up' }],
  recordTags: [{ tag: { slug: 'urgent', title: 'Urgent' } }],
  ...overrides,
});

describe('sample mock mapper', () => {
  it('parses include tokens and serializes enabled kinds', () => {
    expect(parseSampleMockIncludes(undefined).tags).toBe(true);
    expect(parseSampleMockIncludes('none')).toEqual({
      parent: false,
      status: false,
      owner: false,
      detail: false,
      comments: false,
      tags: false,
    });
    expect(parseSampleMockIncludes('status,tags')).toMatchObject({
      status: true,
      tags: true,
      owner: false,
      parent: false,
    });
    expect(serializeSampleMockIncludes(parseSampleMockIncludes('status,tags'))).toBe('status,tags');
  });

  it('omits relation payloads when the include is off', () => {
    const people = new Map([['3', { id: 3n, username: 'nina.vale', displayName: 'Nina Vale' }]]);
    const mapped = mapSampleMockRecord(baseRow(), {
      parent: false,
      status: false,
      owner: false,
      detail: false,
      comments: false,
      tags: false,
    }, people);
    expect(mapped.status).toBeUndefined();
    expect(mapped.owner).toBeUndefined();
    expect(mapped.city).toBeUndefined();
    expect(mapped.tags).toBeUndefined();
    expect(mapped.comments).toBeUndefined();
    expect(mapped.parentTitle).toBeUndefined();
    expect(mapped.createdBy).toBe('nina.vale');
  });

  it('maps every relation kind when includes are on', () => {
    const people = new Map([['3', { id: 3n, username: 'nina.vale', displayName: 'Nina Vale' }]]);
    const mapped = mapSampleMockRecord(baseRow(), parseSampleMockIncludes(undefined), people, 1);
    expect(mapped).toMatchObject({
      parentId: '1',
      parentTitle: 'Region 1',
      status: 'Open',
      owner: 'nina.vale',
      city: 'North Harbor',
      comments: ['Need follow-up'],
      tags: ['Urgent'],
      __depth: 1,
      latitude: 35.6892,
      longitude: 51.389,
    });
  });

  it('computes tree depth from parentId', () => {
    const depths = computeSampleMockDepths([
      { id: 1n, parentId: null },
      { id: 2n, parentId: 1n },
      { id: 3n, parentId: 2n },
    ]);
    expect(depths.get('1')).toBe(0);
    expect(depths.get('2')).toBe(1);
    expect(depths.get('3')).toBe(2);
  });

  it('uses the Avatar catalog portrait samples', () => {
    expect(sampleMockPhotoSrc(0)).toBe('https://i.pravatar.cc/160?img=1');
    expect(sampleMockPhotoSrc(11)).toBe('https://i.pravatar.cc/160?img=12');
    expect(sampleMockPhotoSrc(70)).toBe('https://i.pravatar.cc/160?img=1');
  });
});
