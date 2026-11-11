import { describe, expect, it } from 'vitest';
import { buildRecordSubjectTimelineSpineRows } from '../recordSubjectTimelineSpineLayout';

describe('buildRecordSubjectTimelineSpineRows', () => {
  it('preserves caller order when preserveEventOrder is set', () => {
    const events = [
      { id: 'b', occurredAt: '2026-01-02T10:00:00.000Z' },
      { id: 'a', occurredAt: '2026-01-02T10:00:00.000Z' },
    ];
    const rows = buildRecordSubjectTimelineSpineRows(events, 'newestFirst', { preserveEventOrder: true });
    const eventRows = rows.filter((row) => row.kind === 'event');
    expect(eventRows.map((row) => row.event.id)).toEqual(['b', 'a']);
  });

  it('re-sorts by occurredAt when preserveEventOrder is false', () => {
    const events = [
      { id: 'older', occurredAt: '2025-06-01T10:00:00.000Z' },
      { id: 'newer', occurredAt: '2026-06-01T10:00:00.000Z' },
    ];
    const rows = buildRecordSubjectTimelineSpineRows(events, 'newestFirst');
    const eventRows = rows.filter((row) => row.kind === 'event');
    expect(eventRows.map((row) => row.event.id)).toEqual(['newer', 'older']);
  });
});
