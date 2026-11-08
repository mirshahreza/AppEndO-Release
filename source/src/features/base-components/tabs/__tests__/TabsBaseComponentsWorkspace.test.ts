import { describe, expect, it } from 'vitest';
import {
  applyTabsActivationMode,
  applyTabsItemCount,
  applyTabsWidth,
  buildTabsBaseComponentsConfigExport,
  DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
} from '../TabsBaseComponentsWorkspace';

describe('TabsBaseComponentsWorkspace config export', () => {
  it('separates content-tab public props from demo fixtures and scenarios', () => {
    const result = buildTabsBaseComponentsConfigExport({
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      panelLifecycle: 'lazy-keep',
      activationMode: 'automatic',
      viewport: 'phone',
      direction: 'rtl',
    });

    expect(result.public).toMatchObject({
      component: 'UiTabs',
      activationMode: 'manual',
      panelLifecycle: 'lazy-keep',
      panelAttachment: 'integrated',
    });
    expect(result.composition).toEqual({
      controlledSelection: true,
      itemContent: 'icon-label',
    });
    expect(result.demo.scenarios).toMatchObject({
      viewport: 'phone',
      direction: 'rtl',
    });
  });

  it('exports workspace lifecycle handlers as composition details', () => {
    const result = buildTabsBaseComponentsConfigExport({
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      pattern: 'workspace',
      workspaceAdd: false,
      workspaceDirty: true,
    });

    expect(result.public).toMatchObject({
      component: 'UiWorkspaceTabs',
      showAddButton: false,
      allowReorder: true,
      allowPin: true,
    });
    expect(result.composition).toMatchObject({
      controlledSelection: true,
      handlers: {
        close: true,
        add: false,
        reorder: true,
        pin: true,
        requestCloseDirty: true,
      },
    });
    expect(result.demo.fixtures).toMatchObject({ dirtyItem: true });
  });

  it('keeps segmented control orientation public and demo-only viewport separate', () => {
    const result = buildTabsBaseComponentsConfigExport({
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      pattern: 'segmented',
      segmentedOrientation: 'vertical',
      width: 'equal',
    });

    expect(result.public).toMatchObject({
      component: 'UiSegmentedControl',
      orientation: 'vertical',
      width: 'equal',
    });
    expect(result.demo.fixtures).toMatchObject({ itemCount: 3 });
    expect(result.demo.scenarios).toHaveProperty('viewport');
  });

  it('keeps Width operable and normalizes only invalid equal-width combinations', () => {
    const dense = {
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      itemCount: 8 as const,
      width: 'fit' as const,
    };

    expect(applyTabsWidth(dense, 'equal')).toMatchObject({
      width: 'equal',
      itemCount: 3,
    });
    expect(
      applyTabsItemCount(
        { ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG, width: 'equal' },
        6,
      ),
    ).toMatchObject({
      width: 'fit',
      itemCount: 6,
    });
  });

  it('keeps Activation operable by selecting the required eager lifecycle', () => {
    expect(
      applyTabsActivationMode(
        {
          ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
          panelLifecycle: 'lazy-keep',
        },
        'automatic',
      ),
    ).toMatchObject({
      activationMode: 'automatic',
      panelLifecycle: 'eager',
    });
  });
});
