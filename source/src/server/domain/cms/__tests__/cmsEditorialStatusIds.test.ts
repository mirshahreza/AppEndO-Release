import { describe, expect, it } from 'vitest';
import { buildCmsAwaitingReviewStatusFilter } from '../cmsEditorialStatusIds';

describe('buildCmsAwaitingReviewStatusFilter', () => {
  it('includes draft and in-review status codes only', () => {
    expect(buildCmsAwaitingReviewStatusFilter({
      published: 'st-published',
      draft: 'st-draft',
      inReview: 'st-in-review',
    })).toEqual(['st-draft', 'st-in-review']);
  });

  it('deduplicates when draft and in-review resolve to the same id', () => {
    expect(buildCmsAwaitingReviewStatusFilter({
      published: 'st-published',
      draft: 'st-draft',
      inReview: 'st-draft',
    })).toEqual(['st-draft']);
  });
});
