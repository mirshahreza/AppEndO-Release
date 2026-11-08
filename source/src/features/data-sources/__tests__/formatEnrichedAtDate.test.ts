import { describe, expect, it } from 'vitest';
import { formatEnrichedAtDate } from '../utils';

describe('formatEnrichedAtDate', () => {
  it('formats an ISO timestamp as yyyy/mm/dd', () => {
    expect(formatEnrichedAtDate('2024-06-15T10:00:00.000Z')).toBe('2024/06/15');
  });

  it('returns empty when the timestamp is missing or invalid', () => {
    expect(formatEnrichedAtDate(null)).toBe('');
    expect(formatEnrichedAtDate('')).toBe('');
    expect(formatEnrichedAtDate('not-a-date')).toBe('');
  });
});
