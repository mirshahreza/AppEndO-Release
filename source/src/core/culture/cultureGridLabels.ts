import type { TranslationFn } from './TranslationRuntime';

export function formatCultureGridShowingRange(
  t: TranslationFn,
  totalCount: number,
  safePage: number,
  pageSize: number,
): string {
  if (totalCount === 0) {
    return t('grid.showingEmpty');
  }

  const start = ((safePage - 1) * pageSize) + 1;
  const end = Math.min(totalCount, safePage * pageSize);
  return t('grid.showingRange')
    .replace('{start}', String(start))
    .replace('{end}', String(end))
    .replace('{total}', String(totalCount));
}

export function formatCultureGridInfiniteRange(
  t: TranslationFn,
  visibleCount: number,
  totalCount: number,
): string {
  return t('grid.infiniteRange')
    .replace('{visible}', String(visibleCount))
    .replace('{total}', String(totalCount));
}

export function formatCulturePageSizeLabel(t: TranslationFn, pageSize: number): string {
  return t('grid.pageSizeLabel').replace('{size}', String(pageSize));
}
