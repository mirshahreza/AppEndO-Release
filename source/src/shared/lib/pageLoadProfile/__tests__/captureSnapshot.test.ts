import { describe, expect, it } from 'vitest';
import { buildPageLoadProfileSnapshotFromBrowser } from '../captureSnapshot';

describe('buildPageLoadProfileSnapshotFromBrowser', () => {
  it('returns null when no resource timing entries exist', () => {
    expect(buildPageLoadProfileSnapshotFromBrowser('/iq/demo', 'demo')).toBeNull();
  });
});
