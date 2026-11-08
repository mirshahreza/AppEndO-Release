import { describe, expect, it } from 'vitest';
import {
  buildHrefWithWorkspaceOverlay,
  parseWorkspaceOverlayFromSearchParams,
  setWorkspaceOverlayOnSearchParams,
  WORKSPACE_OVERLAY_QUERY_PARAM,
} from '../workspaceOverlayDeepLink';

describe('workspaceOverlayDeepLink', () => {
  it('reads and writes the overlay query param', () => {
    const params = new URLSearchParams('foo=1');
    expect(parseWorkspaceOverlayFromSearchParams(params)).toBeNull();

    const withOverlay = setWorkspaceOverlayOnSearchParams(params, 'panel/designer');
    expect(withOverlay.get(WORKSPACE_OVERLAY_QUERY_PARAM)).toBe('panel/designer');
    expect(parseWorkspaceOverlayFromSearchParams(withOverlay)).toBe('panel/designer');

    const cleared = setWorkspaceOverlayOnSearchParams(withOverlay, null);
    expect(cleared.has(WORKSPACE_OVERLAY_QUERY_PARAM)).toBe(false);
  });

  it('rejects unsafe overlay tokens', () => {
    expect(setWorkspaceOverlayOnSearchParams(new URLSearchParams(), 'bad token').has(WORKSPACE_OVERLAY_QUERY_PARAM))
      .toBe(false);
  });

  it('builds hrefs with overlay preserved', () => {
    expect(buildHrefWithWorkspaceOverlay('/studio/data-studio/edit/t', 'panel/datasheet'))
      .toBe('/studio/data-studio/edit/t?overlay=panel%2Fdatasheet');
  });
});
