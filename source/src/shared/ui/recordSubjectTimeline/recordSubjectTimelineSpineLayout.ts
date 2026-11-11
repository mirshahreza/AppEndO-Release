export type RecordSubjectTimelineDirection = 'newestFirst' | 'oldestFirst';

export function parseRecordSubjectTimelineYear(occurredAt: string): number | null {
  const ms = Date.parse(occurredAt);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).getUTCFullYear();
}

export type RecordSubjectTimelineSpineRow<TEvent extends { occurredAt: string }> =
  | { kind: 'year'; year: number; key: string }
  | { kind: 'event'; event: TEvent; eventIndex: number };

export function orderRecordSubjectTimelineEvents<TEvent extends { occurredAt: string }>(
  events: TEvent[],
  direction: RecordSubjectTimelineDirection,
): TEvent[] {
  const sorted = [...events].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
  return direction === 'newestFirst' ? sorted.reverse() : sorted;
}

function resolveRecordSubjectTimelineYearDividerYears(
  events: ReadonlyArray<Pick<{ occurredAt: string }, 'occurredAt'>>,
): number[] {
  const years: number[] = [];
  let lastYear: number | null = null;

  events.forEach((event) => {
    const year = parseRecordSubjectTimelineYear(event.occurredAt);
    if (year === null) {
      return;
    }
    if (lastYear === null || year !== lastYear) {
      years.push(year);
      lastYear = year;
    }
  });

  return years;
}

function assertRecordSubjectTimelineYearDividerOrder(
  years: readonly number[],
  direction: RecordSubjectTimelineDirection,
): void {
  for (let index = 1; index < years.length; index += 1) {
    const previous = years[index - 1]!;
    const current = years[index]!;
    if (direction === 'newestFirst' && current > previous) {
      throw new Error('Timeline year dividers must decrease top-to-bottom when newest is first.');
    }
    if (direction === 'oldestFirst' && current < previous) {
      throw new Error('Timeline year dividers must increase top-to-bottom when oldest is first.');
    }
  }
}

export type BuildRecordSubjectTimelineSpineRowsOptions = {
  /** When true, `events` are already in on-screen order (parent handles direction toggles). */
  preserveEventOrder?: boolean;
};

/** Year divider rows + event rows in on-screen timeline order. */
export function buildRecordSubjectTimelineSpineRows<TEvent extends { occurredAt: string }>(
  events: ReadonlyArray<TEvent>,
  direction: RecordSubjectTimelineDirection,
  options?: BuildRecordSubjectTimelineSpineRowsOptions,
): RecordSubjectTimelineSpineRow<TEvent>[] {
  const ordered = options?.preserveEventOrder
    ? [...events]
    : orderRecordSubjectTimelineEvents([...events], direction);
  const dividerYears = resolveRecordSubjectTimelineYearDividerYears(ordered);
  assertRecordSubjectTimelineYearDividerOrder(dividerYears, direction);

  const rows: RecordSubjectTimelineSpineRow<TEvent>[] = [];
  let lastYear: number | null = null;
  let dividerSequence = 0;

  ordered.forEach((event, eventIndex) => {
    const year = parseRecordSubjectTimelineYear(event.occurredAt);
    if (year !== null && (lastYear === null || year !== lastYear)) {
      rows.push({
        kind: 'year',
        year,
        key: `year-divider-${dividerSequence}-${year}`,
      });
      dividerSequence += 1;
      lastYear = year;
    }
    rows.push({ kind: 'event', event, eventIndex });
  });

  return rows;
}
