// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { WORKSPACE_SPLIT_PANEL_KEYS } from '../../../../../shared/ui';
import { useLiveDesignerPanelSplit } from '../useLiveDesignerPanelSplit';

describe('useLiveDesignerPanelSplit', () => {
  it('starts at the default size and clamps setSize', () => {
    const { result } = renderHook(() => useLiveDesignerPanelSplit({
      panelKey: WORKSPACE_SPLIT_PANEL_KEYS.liveDesignerOutline,
      defaultSize: 288,
      minSize: 180,
      maxSize: 480,
      side: 'start',
    }));

    expect(result.current.size).toBe(288);

    act(() => {
      result.current.setSize(120);
    });
    expect(result.current.size).toBe(180);

    act(() => {
      result.current.setSize(900);
    });
    expect(result.current.size).toBe(480);
  });
});
