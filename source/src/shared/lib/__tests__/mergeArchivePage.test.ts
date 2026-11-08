import { describe, expect, it } from 'vitest';
import { mergeDescendingPage } from '../mergeArchivePage';

describe('mergeDescendingPage', () => {
  it('takes a global page from the top of both sorted sources', () => {
    const hot = [{ t: '2026-01-10' }, { t: '2026-01-08' }, { t: '2026-01-06' }];
    const archived = [{ t: '2026-01-09' }, { t: '2026-01-07' }, { t: '2026-01-05' }];
    const compare = (left: { t: string }, right: { t: string }) => right.t.localeCompare(left.t);
    const page = mergeDescendingPage(hot, archived, 2, 2, compare, 10, 4);
    expect(page.items.map((row) => row.t)).toEqual(['2026-01-08', '2026-01-07']);
    expect(page.totalCount).toBe(14);
  });

  it('returns the combined total when one source is empty', () => {
    const hot = [{ t: '2026-01-10' }];
    const compare = (left: { t: string }, right: { t: string }) => right.t.localeCompare(left.t);
    const page = mergeDescendingPage(hot, [], 0, 1, compare, 5, 3);
    expect(page.items.map((row) => row.t)).toEqual(['2026-01-10']);
    expect(page.totalCount).toBe(8);
  });

  it('pages a third source after merging a hot+archive window', () => {
    const hot = [{ t: '2026-01-10' }, { t: '2026-01-07' }];
    const archived = [{ t: '2026-01-09' }];
    const auth = [{ t: '2026-01-11' }, { t: '2026-01-08' }, { t: '2026-01-06' }];
    const compare = (left: { t: string }, right: { t: string }) => right.t.localeCompare(left.t);
    const window = mergeDescendingPage(hot, archived, 0, 4, compare, 2, 1);
    const page = mergeDescendingPage(window.items, auth, 2, 2, compare, window.totalCount, 3);
    expect(page.items.map((row) => row.t)).toEqual(['2026-01-09', '2026-01-08']);
    expect(page.totalCount).toBe(6);
  });
});
