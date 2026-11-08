import { describe, expect, it } from 'vitest';
import {
  buildPortalFunctionTag,
  parsePortalSegmentFromFunctionTag,
  readPortalSegmentFromMetadata,
  upsertPortalTagInMetadata,
} from '../serverFunctionPortalTags';

describe('serverFunctionPortalTags', () => {
  it('builds and parses portal:{segment} tags', () => {
    expect(buildPortalFunctionTag('Ops')).toBe('portal:ops');
    expect(buildPortalFunctionTag('  CMS  ')).toBe('portal:cms');
    expect(buildPortalFunctionTag('')).toBe('');
    expect(parsePortalSegmentFromFunctionTag('portal:ops')).toBe('ops');
    expect(parsePortalSegmentFromFunctionTag('openapi')).toBeNull();
  });

  it('reads the portal segment from apiDoc tags', () => {
    expect(readPortalSegmentFromMetadata({
      apiDoc: { tags: ['cms', 'portal:ops', 'internal'] },
    })).toBe('ops');
    expect(readPortalSegmentFromMetadata(null)).toBe('');
  });

  it('upserts a single portal tag without dropping unrelated tags', () => {
    const next = upsertPortalTagInMetadata(
      { apiDoc: { tags: ['cms', 'portal:legacy'], summary: 'Settings' } },
      'Ops',
    );

    expect(next.apiDoc?.tags).toEqual(['cms', 'portal:ops']);
    expect(next.apiDoc?.summary).toBe('Settings');
  });

  it('removes the portal tag when the segment is cleared', () => {
    const next = upsertPortalTagInMetadata(
      { apiDoc: { tags: ['portal:ops', 'cms'] } },
      '   ',
    );

    expect(next.apiDoc?.tags).toEqual(['cms']);
  });
});
