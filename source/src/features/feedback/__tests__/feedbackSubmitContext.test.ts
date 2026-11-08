import { describe, expect, it, vi, afterEach } from 'vitest';
import { resolveFeedbackSubmitContext } from '../feedbackSubmitContext';

describe('resolveFeedbackSubmitContext', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds sourcePath with pageKey, overlay, and route', () => {
    vi.stubGlobal('window', {
      location: {
        pathname: '/portal/studio/users',
        search: '?overlay=dialog%2Fedit%2F12&tab=1',
        hash: '',
      },
    });
    vi.stubGlobal('navigator', { userAgent: 'test-agent', language: 'ar-IQ' });

    const ctx = resolveFeedbackSubmitContext({
      pageKey: 'users',
      pathPrefix: '/portal',
    });

    expect(ctx.route).toBe('/studio/users?overlay=dialog%2Fedit%2F12&tab=1');
    expect(ctx.sourcePath).toBe(
      'page=users · overlay=dialog/edit/12 · route=/studio/users?overlay=dialog%2Fedit%2F12&tab=1',
    );
    expect(ctx.metadata.overlay).toBe('dialog/edit/12');
    expect(ctx.metadata.pathname).toBe('/studio/users');
  });
});
