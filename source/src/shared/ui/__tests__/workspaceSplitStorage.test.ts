// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  WORKSPACE_SPLIT_PANEL_KEYS,
  persistWorkspaceSplitRatioState,
  persistWorkspaceSplitSizeState,
  readWorkspaceSplitRatioState,
  readWorkspaceSplitSizeState,
  workspaceSplitStorageKey,
} from '../workspaceSplitStorage';

describe('workspaceSplitStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists vertical panel size and collapsed state', () => {
    persistWorkspaceSplitSizeState(WORKSPACE_SPLIT_PANEL_KEYS.sandboxNav, {
      size: 0,
      collapsed: true,
      expandedSize: 288,
    });

    expect(readWorkspaceSplitSizeState(WORKSPACE_SPLIT_PANEL_KEYS.sandboxNav, {
      size: 288,
      collapsed: false,
      expandedSize: 288,
    })).toEqual({
      size: 0,
      collapsed: true,
      expandedSize: 288,
    });
  });

  it('persists ratio panel state', () => {
    persistWorkspaceSplitRatioState(WORKSPACE_SPLIT_PANEL_KEYS.gitChangesDiff, {
      ratio: 0.35,
      collapsed: false,
      expandedRatio: 0.35,
    });

    expect(readWorkspaceSplitRatioState(WORKSPACE_SPLIT_PANEL_KEYS.gitChangesDiff, {
      ratio: 0.4,
      collapsed: false,
      expandedRatio: 0.4,
    })).toEqual({
      ratio: 0.35,
      collapsed: false,
      expandedRatio: 0.35,
    });
  });

  it('builds stable storage keys', () => {
    expect(workspaceSplitStorageKey(WORKSPACE_SPLIT_PANEL_KEYS.designerPalette)).toBe(
      'appendo.workspace-split.v1:designer.palette',
    );
    expect(workspaceSplitStorageKey(WORKSPACE_SPLIT_PANEL_KEYS.ideaFoundryInspector)).toBe(
      'appendo.workspace-split.v1:idea-foundry.inspector',
    );
    expect(workspaceSplitStorageKey(WORKSPACE_SPLIT_PANEL_KEYS.packageDetailInspector)).toBe(
      'appendo.workspace-split.v1:package-detail.inspector',
    );
  });
});
