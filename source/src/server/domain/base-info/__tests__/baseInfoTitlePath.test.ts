import { describe, expect, it } from 'vitest';

import {
  BASE_INFO_TITLE_PATH_SEPARATOR,
  joinBaseInfoTitlePathSegments,
  resolveBaseInfoTitlePathSegment,
  shouldRecomputeBaseInfoTitlePathsAfterSave,
} from '../baseInfoTitlePath';

describe('baseInfoTitlePath', () => {
  it('resolves segment from culture bundle then canonical title', () => {
    expect(resolveBaseInfoTitlePathSegment({
      id: '100.1',
      parentId: '100',
      title: 'Gender',
    }, 'ir', { 'base_info.title.100.1': 'جنسیت' })).toBe('جنسیت');

    expect(resolveBaseInfoTitlePathSegment({
      id: '100.1.1',
      parentId: '100.1',
      title: 'Male',
    }, 'us', {})).toBe('Male');
  });

  it('joins segments with the platform separator', () => {
    const path = joinBaseInfoTitlePathSegments(['Base', 'Gender', 'Male']);
    expect(path).toBe(`Base${BASE_INFO_TITLE_PATH_SEPARATOR}Gender${BASE_INFO_TITLE_PATH_SEPARATOR}Male`);
  });

  it('skips title-path recompute when canonical title and locale titles are unchanged', () => {
    expect(shouldRecomputeBaseInfoTitlePathsAfterSave({
      previousCanonicalTitle: 'In Review',
      nextCanonicalTitle: 'In Review',
      locales: undefined,
    })).toBe(false);

    expect(shouldRecomputeBaseInfoTitlePathsAfterSave({
      previousCanonicalTitle: 'In Review',
      nextCanonicalTitle: 'Published',
    })).toBe(true);

    expect(shouldRecomputeBaseInfoTitlePathsAfterSave({
      previousCanonicalTitle: 'In Review',
      nextCanonicalTitle: 'In Review',
      locales: { ir: { note: 'updated note only' } },
    })).toBe(false);

    expect(shouldRecomputeBaseInfoTitlePathsAfterSave({
      previousCanonicalTitle: 'In Review',
      nextCanonicalTitle: 'In Review',
      locales: { ir: { title: 'در حال بررسی' } },
    })).toBe(true);
  });
});
