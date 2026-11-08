import { describe, expect, it } from 'vitest';
import { isWorkflowPublished } from '../workflowPublished';

describe('isWorkflowPublished', () => {
  it('reads list summaries from currentPublishedRevisionId', () => {
    expect(isWorkflowPublished({ currentPublishedRevisionId: 12 })).toBe(true);
    expect(isWorkflowPublished({ currentPublishedRevisionId: null })).toBe(false);
  });

  it('reads designer projections from publicationStatus and currentPublishedRevision', () => {
    expect(isWorkflowPublished({
      publicationStatus: { isPublished: true },
      currentPublishedRevision: null,
    })).toBe(true);

    expect(isWorkflowPublished({
      publicationStatus: { isPublished: false },
      currentPublishedRevision: { id: 4 },
    })).toBe(true);

    expect(isWorkflowPublished({
      publicationStatus: { isPublished: false },
      currentPublishedRevision: null,
    })).toBe(false);
  });

  it('reads dossiers from definition.isPublished', () => {
    expect(isWorkflowPublished({
      definition: { isPublished: true, currentPublishedRevisionId: null },
    })).toBe(true);
  });
});
