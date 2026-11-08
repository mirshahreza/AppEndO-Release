import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import { shouldShowDesignerPublishedDraftLoading } from '../DesignerPublishedPage';
import {
  designerPublishedPageQueryRetry,
  designerPublishedPageQueryRetryDelay,
} from '../../../shared/api/queries/component-designer';

describe('shouldShowDesignerPublishedDraftLoading', () => {
  it('keeps loading while pending without data (including retry backoff)', () => {
    expect(shouldShowDesignerPublishedDraftLoading({
      authLoading: false,
      hasDraftData: false,
      isPending: true,
      isFetching: false,
    })).toBe(true);
  });

  it('shows content when cached draft data exists', () => {
    expect(shouldShowDesignerPublishedDraftLoading({
      authLoading: true,
      hasDraftData: true,
      isPending: false,
      isFetching: false,
    })).toBe(false);
  });
});

describe('designerPublishedPageQueryRetry', () => {
  it('retries transient network errors up to three attempts', () => {
    const networkError = new ApiError('Network request failed.', {
      status: 0,
      statusText: 'Network Error',
      bodySnippet: '',
      path: '/api/component-designer/drafts/by-path',
    });
    expect(designerPublishedPageQueryRetry(0, networkError)).toBe(true);
    expect(designerPublishedPageQueryRetry(2, networkError)).toBe(true);
    expect(designerPublishedPageQueryRetry(3, networkError)).toBe(false);
  });

  it('does not retry missing version responses', () => {
    const notFound = new ApiError('Version not found.', {
      status: 404,
      statusText: 'Not Found',
      bodySnippet: '',
      path: '/api/component-designer/drafts/by-path',
    });
    expect(designerPublishedPageQueryRetry(0, notFound)).toBe(false);
  });

  it('backs off between attempts', () => {
    expect(designerPublishedPageQueryRetryDelay(0)).toBe(400);
    expect(designerPublishedPageQueryRetryDelay(2)).toBe(1_600);
    expect(designerPublishedPageQueryRetryDelay(5)).toBe(3_000);
  });
});
