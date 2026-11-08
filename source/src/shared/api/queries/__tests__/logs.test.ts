import { describe, expect, it } from 'vitest';
import { buildLogsListSearchParams } from '../logs';

describe('buildLogsListSearchParams', () => {
  it('serializes a single level filter', () => {
    const params = buildLogsListSearchParams({ limit: 200, level: 'WARN' });
    expect(params.get('limit')).toBe('200');
    expect(params.getAll('level')).toEqual(['WARN']);
  });

  it('serializes multiple toolbar level filters', () => {
    const params = buildLogsListSearchParams({ limit: 200, level: ['INFO', 'WARN'] });
    expect(params.getAll('level')).toEqual(['INFO', 'WARN']);
  });

  it('omits empty level arrays', () => {
    const params = buildLogsListSearchParams({ limit: 200, level: [] });
    expect(params.has('level')).toBe(false);
  });

  it('serializes Timeline requestId jumps', () => {
    const params = buildLogsListSearchParams({ limit: 200, requestId: 'req-abc-1' });
    expect(params.get('requestId')).toBe('req-abc-1');
  });

  it('serializes server paging offset', () => {
    const params = buildLogsListSearchParams({ limit: 50, offset: 100 });
    expect(params.get('limit')).toBe('50');
    expect(params.get('offset')).toBe('100');
  });
});
