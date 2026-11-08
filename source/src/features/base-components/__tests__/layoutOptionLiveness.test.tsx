import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG,
  applyToolbarPreset,
  resolveToolbarPreviewModel,
} from '../toolbar/ToolbarBaseComponentsWorkspace';
import {
  DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG,
  resolveSearchPreviewModel,
} from '../search/SearchBaseComponentsWorkspace';
import {
  DEFAULT_FLOATING_PANEL_BASE_COMPONENTS_CONFIG,
  applyFloatingPanelPreset,
  resolveFloatingPanelPreviewModel,
} from '../floating-panel/FloatingPanelBaseComponentsWorkspace';
import {
  DEFAULT_CANVAS_TOOLBAR_BASE_COMPONENTS_CONFIG,
  applyCanvasToolbarPreset,
  resolveCanvasToolbarPreviewModel,
} from '../canvas-toolbar/CanvasToolbarBaseComponentsWorkspace';
import {
  DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG,
  resolveToolboxPanelPreviewModel,
} from '../toolbox-panel/ToolboxPanelBaseComponentsWorkspace';
import {
  DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG,
  applySidebarRenderer,
  resolveSidebarMenuPreviewModel,
} from '../sidebar-menu/SidebarMenuBaseComponentsWorkspace';
import {
  DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG,
  applySurfaceBoxPreset,
  resolveSurfaceBoxPreviewModel,
} from '../surface-box/SurfaceBoxBaseComponentsWorkspace';
import {
  DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG,
  applyScrollAreaVariant,
  exportScrollAreaBaseComponentsConfig,
  resolveScrollAreaPreviewModel,
} from '../scroll-area/ScrollAreaBaseComponentsWorkspace';
import {
  DEFAULT_DOCK_PANE_BASE_COMPONENTS_CONFIG,
  resolveDockPaneOptionLiveness,
} from '../dock-pane/DockPaneBaseComponentsWorkspace';
import {
  DEFAULT_BREADCRUMBS_BASE_COMPONENTS_CONFIG,
  applyBreadcrumbsPreset,
  resolveBreadcrumbsPreviewModel,
} from '../breadcrumbs/BreadcrumbsBaseComponentsWorkspace';
import {
  DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
  applyTabsActivationMode,
  applyTabsItemCount,
  applyTabsWidth,
  resolveTabsPreviewModel,
} from '../tabs/TabsBaseComponentsWorkspace';
import {
  DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG,
  applyAccordionDisclosureOption,
  resolveAccordionDisclosurePreviewModel,
} from '../accordion-disclosure/AccordionDisclosureBaseComponentsWorkspace';
import {
  DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG,
  applyPopoverTooltipOption,
  resolvePopoverTooltipPreviewModel,
} from '../popover-tooltip/PopoverTooltipBaseComponentsWorkspace';
import {
  DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG,
  resolveButtonsPreviewModel,
} from '../buttons/ButtonsBaseComponentsWorkspace';

describe('Base Components layout option liveness', () => {
  it('buttons maps every kind to the production primitive and group orientation', () => {
    expect(resolveButtonsPreviewModel(DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG).component)
      .toBe('WorkspaceBackIcon');
    expect(resolveButtonsPreviewModel({
      ...DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG,
      kind: 'labeled-app-button',
    }).component).toBe('AppButton');
    expect(resolveButtonsPreviewModel({
      ...DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG,
      kind: 'split-button',
    }).component).toBe('AppSplitButton');
    expect(resolveButtonsPreviewModel({
      ...DEFAULT_BUTTONS_BASE_COMPONENTS_CONFIG,
      kind: 'button-group',
      labeledIntent: 'secondary',
      groupOrientation: 'vertical',
    })).toMatchObject({
      component: 'AppButtonGroup',
      group: {
        orientation: 'vertical',
        intent: 'secondary',
        items: ['Align left', 'Align center', 'Align right'],
      },
    });
  });

  it('toolbar maps recipes, layout, state, intents, and every slot to live preview signals', () => {
    const formatting = applyToolbarPreset(DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG, 'formatting');
    expect(resolveToolbarPreviewModel(formatting)).toMatchObject({
      primaryLabel: 'Create',
      compact: true,
      slots: { search: false, filters: true },
    });

    const model = resolveToolbarPreviewModel({
      ...formatting,
      orientation: 'vertical',
      presentation: 'floating',
      viewport: 'phone',
      state: 'pending',
      labeledIntent: 'warning',
      showIconActions: false,
      showSplitButton: true,
      splitIntent: 'confirm',
      showExport: true,
      showRefresh: false,
      showSeparator: true,
    });
    expect(model).toMatchObject({
      orientation: 'vertical',
      floating: true,
      viewport: 'phone',
      disabled: true,
      pending: true,
      splitIntent: 'confirm',
      slots: {
        iconActions: false,
        splitButton: true,
        export: true,
        refresh: false,
        separator: true,
      },
    });
    expect(resolveToolbarPreviewModel({
      ...DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG,
      showIconActions: false,
      showSplitButton: false,
      showExport: false,
      showRefresh: false,
      showSeparator: true,
    })).toMatchObject({ showSeparatorControl: false, slots: { separator: false } });
    expect(resolveToolbarPreviewModel({
      ...DEFAULT_TOOLBAR_BASE_COMPONENTS_CONFIG,
      state: 'pressed',
      labeledIntent: 'warning',
    }).primaryIntent).toBe('toggle-on');
  });

  it('search maps each production component and hides variant-only controls', () => {
    const panel = resolveSearchPreviewModel({
      ...DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG,
      showLeading: true,
      clearable: false,
      width: 'fit',
      direction: 'mixed',
      state: 'disabled',
      placeholder: 'APIs…',
      initialValue: 'users',
      debounceMs: 300,
    });
    expect(panel).toMatchObject({
      component: 'AppSearchBox',
      direction: 'auto',
      disabled: true,
      showClear: false,
      widthClass: 'max-w-md',
      showLeading: true,
      showSubmitControl: false,
      shortcut: 'none',
      placeholder: 'APIs…',
      initialValue: 'users',
      debounceMs: 300,
    });
    expect(resolveSearchPreviewModel({
      ...DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG,
      variant: 'toolbar',
      width: 'fit',
    })).toMatchObject({
      component: 'ToolbarSearchInput',
      widthClass: 'max-w-[200px]',
      showLeading: false,
      showSubmitControl: false,
    });
    expect(resolveSearchPreviewModel({
      ...DEFAULT_SEARCH_BASE_COMPONENTS_CONFIG,
      variant: 'command',
      submitOnEnter: true,
      shortcut: 'slash',
      state: 'loading',
    })).toMatchObject({
      component: 'UiInput',
      showSubmitControl: true,
      submitOnEnter: true,
      shortcut: 'slash',
      status: 'loading',
    });
  });

  it('floating panel maps shell chrome, regions, geometry, and capability dependencies', () => {
    const studio = resolveFloatingPanelPreviewModel(
      applyFloatingPanelPreset(DEFAULT_FLOATING_PANEL_BASE_COMPONENTS_CONFIG, 'data-studio'),
    );
    expect(studio).toMatchObject({
      preset: 'data-studio',
      sizePreset: 'preview',
      bodyMode: 'scroll',
      footerMode: 'status',
      studioChrome: 'column',
      colorSource: 'tone',
      tone: 'slate',
      showSurfaceChromeControls: false,
      showHeaderHeightControl: false,
    });

    const model = resolveFloatingPanelPreviewModel({
      ...DEFAULT_FLOATING_PANEL_BASE_COMPONENTS_CONFIG,
      title: 'Inspector',
      showTitleIcon: false,
      colorSource: 'custom',
      customColorHex: '#123456',
      sizePreset: 'compact',
      headerHeight: 'compact',
      initialPosition: 'top-left',
      showHeaderBand: false,
      footerMode: 'none',
      showThinkingIndicator: true,
      bodyMode: 'plain',
      enableDrag: false,
      dragFromHeaderOnly: true,
      enableResize: false,
      enableMaximize: false,
      state: 'maximized',
      direction: 'rtl',
    });
    expect(model).toMatchObject({
      title: 'Inspector',
      titleIcon: false,
      colorSource: 'custom',
      customColorHex: '#123456',
      sizePreset: 'compact',
      headerHeight: 'compact',
      initialPosition: 'top-left',
      showHeaderBand: false,
      footerMode: 'none',
      showThinkingIndicator: true,
      bodyMode: 'plain',
      enableDrag: false,
      dragFromHeaderOnly: false,
      showDragRegionControl: false,
      enableResize: false,
      enableMaximize: false,
      maximized: false,
      direction: 'rtl',
      showCloseButton: true,
      headerActionCount: 0,
    });
  });

  it('canvas toolbar maps presets, anchors, layouts, groups, state, and visibility', () => {
    expect(resolveCanvasToolbarPreviewModel(
      applyCanvasToolbarPreset(DEFAULT_CANVAS_TOOLBAR_BASE_COMPONENTS_CONFIG, 'review'),
    )).toMatchObject({
      preset: 'review',
      left: { visible: false, showZoom: true },
      right: { visible: true, showHistory: false, showOverflow: true },
      controls: { leftDetails: false, rightDetails: true },
    });

    expect(resolveCanvasToolbarPreviewModel({
      ...DEFAULT_CANVAS_TOOLBAR_BASE_COMPONENTS_CONFIG,
      presentation: 'attached',
      viewport: 'tablet',
      state: 'pressed',
      leftPosition: 'bottom-left',
      rightPosition: 'bottom-right',
      leftLayout: 'row',
      rightLayout: 'row',
      leftFullWidthButtons: false,
      reverseGroups: true,
      showHistory: false,
      showZoom: false,
      showOverflow: false,
    })).toMatchObject({
      attached: true,
      viewport: 'tablet',
      pressed: true,
      left: {
        position: 'bottom-left',
        layout: 'row',
        fullWidthButtons: false,
        showZoom: false,
        reverseActions: true,
      },
      right: {
        position: 'bottom-right',
        layout: 'row',
        showHistory: false,
        showOverflow: false,
      },
    });
  });

  it('toolbox panel maps content recipes and hides categorized-only controls', () => {
    const categorized = resolveToolboxPanelPreviewModel({
      ...DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG,
      initialExpandedSection: 'ai',
      density: 'compact',
      draggableItems: true,
      showDescriptions: false,
      panelOpen: false,
      colorSource: 'custom',
      customColorHex: '#abcdef',
    });
    expect(categorized).toMatchObject({
      contentMode: 'categorized',
      open: false,
      densityClass: '!min-h-7 !py-1',
      draggableItems: true,
      showDescriptions: false,
      expansionMode: 'single-persistent',
      initialExpandedSection: 'ai',
      chrome: { colorSource: 'custom', customColorHex: '#abcdef' },
    });
    expect(resolveToolboxPanelPreviewModel({
      ...DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG,
      preset: 'flat',
    })).toMatchObject({
      contentMode: 'flat',
      expansionMode: null,
      initialExpandedSection: null,
    });
    expect(resolveToolboxPanelPreviewModel({
      ...DEFAULT_TOOLBOX_PANEL_BASE_COMPONENTS_CONFIG,
      preset: 'search-first',
      state: 'error',
    }).contentMode).toBe('error');
  });

  it('sidebar menu normalizes renderers and exposes only renderer-compatible controls', () => {
    const railConfig = applySidebarRenderer({
      ...DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG,
      fillHeight: true,
    }, 'rail');
    expect(railConfig).toMatchObject({ renderer: 'rail', collapsed: true, fillHeight: false });
    expect(resolveSidebarMenuPreviewModel(railConfig)).toMatchObject({
      renderer: 'rail',
      collapsed: true,
      showRichItemControls: true,
      showGroupControls: false,
    });

    const standard = resolveSidebarMenuPreviewModel({
      ...DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG,
      density: 'compact',
      edge: 'end',
      direction: 'rtl',
      state: 'unavailable-route',
      activePath: '/base-components/demo/users',
      accordion: true,
      requireOpenGroup: true,
      lockActiveGroup: false,
      fillHeight: true,
      ungroupedAtStart: true,
      ungroupedAtEnd: false,
      groupGapPx: 12,
    });
    expect(standard).toMatchObject({
      renderer: 'standard',
      density: 'compact',
      edge: 'end',
      direction: 'rtl',
      state: 'unavailable-route',
      activePath: '/base-components/demo/users',
      showRichItemControls: false,
      showGroupControls: true,
      props: {
        accordion: true,
        requireOpenGroup: true,
        lockActiveGroup: false,
        fillHeight: true,
        ungroupedAtStart: true,
        ungroupedAtEnd: false,
        groupGapPx: 12,
      },
    });
    expect(resolveSidebarMenuPreviewModel({
      ...DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG,
      viewport: 'phone',
      renderer: 'mega',
    }).renderer).toBe('drawer');
    expect(resolveSidebarMenuPreviewModel({
      ...DEFAULT_SIDEBAR_MENU_BASE_COMPONENTS_CONFIG,
      structure: 'flat',
    }).showGroupControls).toBe(false);
  });

  it('surface box maps recipes, slots, state styling inputs, and panel-only controls', () => {
    expect(applySurfaceBoxPreset(DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG, 'actionable'))
      .toMatchObject({ preset: 'actionable', showFooter: true, state: 'default' });
    expect(applySurfaceBoxPreset(DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG, 'selectable'))
      .toMatchObject({ preset: 'selectable', showFooter: false, state: 'selected' });

    const panel = resolveSurfaceBoxPreviewModel({
      ...DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG,
      preset: 'actionable',
      orientation: 'horizontal',
      surface: 'inset',
      depth: 'raised',
      density: 'compact',
      state: 'loading',
      tone: 'rose',
      fill: false,
      showTitle: true,
      showHeaderExtra: true,
      showSubtitle: false,
      showIcon: false,
      showFooter: true,
      collapsible: true,
    });
    expect(panel).toMatchObject({
      props: { tone: 'rose', layout: 'panel', fill: false, collapsible: true },
      recipe: {
        preset: 'actionable',
        orientation: 'horizontal',
        surface: 'inset',
        depth: 'raised',
        density: 'compact',
        state: 'loading',
      },
      slots: { title: true, subtitle: false, icon: false, headerExtra: true, footer: true },
      controls: { panelOnly: true, titleDetails: true, footer: true },
    });
    expect(resolveSurfaceBoxPreviewModel({
      ...DEFAULT_SURFACE_BOX_BASE_COMPONENTS_CONFIG,
      layout: 'strip',
      fill: true,
      collapsible: true,
      showTitle: true,
    })).toMatchObject({
      props: { layout: 'strip', fill: false, collapsible: false },
      recipe: { orientation: null, density: null },
      slots: { title: false, subtitle: false, icon: false, headerExtra: false, footer: false },
      controls: { panelOnly: false, titleDetails: false, footer: false },
    });
  });

  it('scroll area switches bar and nudge models and hides nudge-only props on bar', () => {
    const nudge = applyScrollAreaVariant(DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG, 'nudge');
    expect(nudge).toMatchObject({ variant: 'nudge', drag: true });
    expect(resolveScrollAreaPreviewModel({
      ...nudge,
      axis: 'horizontal',
      drag: false,
      stepPx: 120,
    })).toMatchObject({
      component: 'UiScrollArea',
      variant: 'nudge',
      axis: 'horizontal',
      drag: false,
      stepPx: 120,
      showNudgeMarks: true,
      showBarThumb: false,
      nudgeReveal: 'always',
      nudgePlacement: 'reserve',
      nudgeSlot: 'band',
      nudgeOpacity: null,
      nudgeIconSize: 18,
      barSide: null,
      dir: 'ltr',
      controls: { drag: true, stepPx: true, marks: true, opacity: false, barSide: false },
    });
    expect(resolveScrollAreaPreviewModel({
      ...nudge,
      nudgePlacement: 'overlay',
      nudgeReveal: 'pointer',
      nudgeSlot: 'icons',
      nudgeOpacity: 0.35,
    })).toMatchObject({
      nudgeReveal: 'pointer',
      nudgePlacement: 'overlay',
      nudgeSlot: 'icons',
      nudgeOpacity: 0.35,
      controls: { marks: true, opacity: true, barSide: false },
    });
    expect(resolveScrollAreaPreviewModel(nudge)).toMatchObject({
      barSide: null,
      nudgeIconSize: 18,
      controls: { marks: true, barSide: false, iconSize: true },
    });
    expect(resolveScrollAreaPreviewModel(DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG)).toMatchObject({
      variant: 'bar',
      drag: false,
      stepPx: null,
      showNudgeMarks: false,
      showBarThumb: true,
      hideThumb: false,
      barSide: 'direction',
      dir: 'ltr',
      controls: { drag: false, stepPx: false, marks: false, opacity: false, barSide: true },
    });
    expect(resolveScrollAreaPreviewModel({
      ...DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG,
      barSide: 'left',
      dir: 'rtl',
    })).toMatchObject({
      barSide: 'left',
      dir: 'rtl',
      controls: { barSide: true },
    });
    expect(resolveScrollAreaPreviewModel({
      ...DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG,
      axis: 'horizontal',
    })).toMatchObject({
      barSide: null,
      controls: { barSide: false },
    });
    expect(resolveScrollAreaPreviewModel({
      ...DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG,
      variant: 'hidden',
    })).toMatchObject({
      variant: 'hidden',
      drag: false,
      stepPx: null,
      showNudgeMarks: false,
      showBarThumb: false,
      hideThumb: true,
      barSide: null,
      controls: { drag: false, stepPx: false, marks: false, opacity: false, barSide: false },
    });
    expect(exportScrollAreaBaseComponentsConfig({
      ...DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG,
      variant: 'hidden',
    })).toEqual({
      variant: 'hidden',
      axis: 'vertical',
      dir: 'ltr',
    });
    expect(exportScrollAreaBaseComponentsConfig(DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG)).toEqual({
      variant: 'bar',
      axis: 'vertical',
      dir: 'ltr',
      barSide: 'direction',
    });
    expect(exportScrollAreaBaseComponentsConfig({
      ...DEFAULT_SCROLL_AREA_BASE_COMPONENTS_CONFIG,
      barSide: 'left',
      dir: 'rtl',
    })).toEqual({
      variant: 'bar',
      axis: 'vertical',
      dir: 'rtl',
      barSide: 'left',
    });
    expect(exportScrollAreaBaseComponentsConfig({
      ...nudge,
      drag: true,
      stepPx: 240,
    })).toEqual({
      variant: 'nudge',
      axis: 'vertical',
      dir: 'ltr',
      drag: true,
      stepPx: 240,
      nudgeReveal: 'always',
      nudgePlacement: 'reserve',
      nudgeSlot: 'band',
      nudgeIconSize: 18,
      nudgeMark: 'icon',
    });
    expect(exportScrollAreaBaseComponentsConfig({
      ...nudge,
      nudgeMark: 'button',
      nudgeMarkShape: 'square',
    })).toMatchObject({
      nudgeMark: 'button',
      nudgeMarkShape: 'square',
    });
  });

  it('breadcrumbs maps trail recipes and normalizes collapsed/back-only controls', () => {
    const collapsedConfig = applyBreadcrumbsPreset({
      ...DEFAULT_BREADCRUMBS_BASE_COMPONENTS_CONFIG,
      maxVisible: 2,
    }, 'collapsed-middle');
    expect(collapsedConfig.maxVisible).toBe(4);
    expect(resolveBreadcrumbsPreviewModel({
      ...collapsedConfig,
      trail: 'One, Two, Three, Four, Five',
      showHome: true,
      separator: 'dot',
      longLabels: true,
      direction: 'rtl',
      viewport: 'phone',
    })).toMatchObject({
      labels: ['Home', '…', 'Four', 'Five with an intentionally long destination label'],
      separator: 'dot',
      direction: 'rtl',
      viewport: 'phone',
      showSeparatorControl: true,
      showMaximumVisibleControl: true,
    });
    expect(resolveBreadcrumbsPreviewModel({
      ...DEFAULT_BREADCRUMBS_BASE_COMPONENTS_CONFIG,
      preset: 'back-context',
      showHome: false,
    })).toMatchObject({
      labels: ['Back to CMS'],
      parent: 'CMS',
      separator: null,
      showSeparatorControl: false,
      showMaximumVisibleControl: false,
    });
  });

  it('tabs maps each production pattern and normalizes width/lifecycle dependencies', () => {
    const content = resolveTabsPreviewModel({
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      visualMode: 'icon-only',
      variant: 'contained',
      placement: 'end',
      alignment: 'center',
      width: 'fit',
      activationMode: 'automatic',
      panelLifecycle: 'lazy-keep',
      overflow: 'menu',
      panelAttachment: 'separated',
      itemCount: 8,
      showBadges: false,
      disabledItem: true,
      viewport: 'phone',
      direction: 'rtl',
    });
    expect(content).toMatchObject({
      component: 'UiTabs',
      viewport: 'phone',
      direction: 'rtl',
      contentProps: {
        visualMode: 'icon-only',
        variant: 'contained',
        placement: 'end',
        alignment: 'center',
        width: 'fit',
        activationMode: 'manual',
        panelLifecycle: 'lazy-keep',
        overflow: 'menu',
        panelAttachment: 'separated',
        itemCount: 8,
        showBadges: false,
        disabledItem: true,
      },
      controls: { content: true, workspace: false, segmented: false, panelAttachment: true, visualMode: true },
    });
    expect(resolveTabsPreviewModel({
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      pattern: 'workspace',
      workspaceClose: false,
      workspaceAdd: false,
      workspaceReorder: false,
      workspacePin: false,
      workspaceDirty: false,
    })).toMatchObject({
      component: 'UiWorkspaceTabs',
      workspaceProps: {
        closeable: false,
        showAddButton: false,
        allowReorder: false,
        allowPin: false,
        dirty: false,
      },
      controls: { workspace: true, panelAttachment: true, visualMode: false },
    });
    expect(resolveTabsPreviewModel({
      ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG,
      pattern: 'segmented',
      segmentedOrientation: 'vertical',
      width: 'equal',
    })).toMatchObject({
      component: 'UiSegmentedControl',
      segmentedProps: { orientation: 'vertical', width: 'equal' },
      controls: { segmented: true, panelAttachment: false, visualMode: true },
    });
    expect(applyTabsWidth({ ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG, itemCount: 8 }, 'equal'))
      .toMatchObject({ width: 'equal', itemCount: 3 });
    expect(applyTabsItemCount({ ...DEFAULT_TABS_BASE_COMPONENTS_CONFIG, width: 'equal' }, 6))
      .toMatchObject({ width: 'fit', itemCount: 6 });
    expect(applyTabsActivationMode(DEFAULT_TABS_BASE_COMPONENTS_CONFIG, 'automatic'))
      .toMatchObject({ activationMode: 'automatic', panelLifecycle: 'eager' });
  });

  it('accordion/disclosure maps pattern-specific props and persistent expansion normalization', () => {
    const persistent = applyAccordionDisclosureOption(
      { ...DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG, collapsible: true },
      'expansion',
      'persistent-one',
    );
    expect(persistent.collapsible).toBe(false);
    expect(resolveAccordionDisclosurePreviewModel({
      ...persistent,
      presentation: 'bordered',
      density: 'compact',
      headingIcon: 'leading',
      headingContent: 'title-actions',
      state: 'invalid-inside',
    })).toMatchObject({
      component: 'UiAccordion',
      invalidInside: true,
      variant: 'bordered',
      chrome: 'border-shadow',
      itemGap: 'sm',
      density: 'compact',
      headingIcon: 'leading',
      headingContent: 'title-actions',
      expansion: 'persistent-one',
      collapsible: false,
      controls: { expansion: true, collapsible: false, itemGap: true },
    });
    expect(resolveAccordionDisclosurePreviewModel({
      ...DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG,
      openHeaderTone: 'indigo',
    })).toMatchObject({
      openHeaderTone: 'indigo',
    });
    expect(resolveAccordionDisclosurePreviewModel({
      ...DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG,
      headingIcon: 'none',
    })).toMatchObject({
      headingIcon: 'none',
    });
    expect(applyAccordionDisclosureOption(
      DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG,
      'presentation',
      'bordered',
    )).toMatchObject({
      presentation: 'bordered',
      chrome: 'border',
      itemGap: 'none',
    });
    expect(applyAccordionDisclosureOption(
      { ...DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG, presentation: 'bordered', chrome: 'border', itemGap: 'none' },
      'presentation',
      'separated',
    )).toMatchObject({
      presentation: 'separated',
      chrome: 'border-shadow',
      itemGap: 'sm',
    });
    expect(resolveAccordionDisclosurePreviewModel({
      ...DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG,
      chrome: 'shadow',
      itemGap: 'lg',
    })).toMatchObject({
      chrome: 'shadow',
      itemGap: 'lg',
    });
    expect(resolveAccordionDisclosurePreviewModel({
      ...DEFAULT_ACCORDION_DISCLOSURE_BASE_COMPONENTS_CONFIG,
      pattern: 'disclosure',
      state: 'disabled',
    })).toMatchObject({
      component: 'UiDisclosure',
      disabled: true,
      expansion: null,
      collapsible: false,
      itemGap: null,
      controls: { expansion: false, collapsible: false, itemGap: false },
    });
  });

  it('popover/tooltip maps triggers, content, placement, timing, collision, dismissal, and state', () => {
    const tooltip = resolvePopoverTooltipPreviewModel({
      ...DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG,
      placement: 'start',
      alignment: 'end',
      trigger: 'field',
      delay: 800,
      collision: false,
      state: 'open',
    });
    expect(tooltip).toMatchObject({
      component: 'UiTooltip',
      trigger: 'field',
      controlledOpen: true,
      placement: 'left bottom',
      shouldFlip: false,
      delay: 800,
      fallbackPlacement: null,
      controls: { delay: true, dismiss: false, sidePlacement: true, centerAlignment: true },
    });

    const normalized = applyPopoverTooltipOption({
      ...DEFAULT_POPOVER_TOOLTIP_BASE_COMPONENTS_CONFIG,
      placement: 'end',
      alignment: 'center',
    }, 'pattern', 'picker-popover');
    expect(normalized).toMatchObject({ pattern: 'picker-popover', placement: 'bottom', alignment: 'start' });
    expect(resolvePopoverTooltipPreviewModel({
      ...normalized,
      dismiss: 'escape,outside,blur',
      collision: true,
      trigger: 'text',
      state: 'disabled',
    })).toMatchObject({
      component: 'ShellResponsivePopover',
      content: 'picker',
      trigger: 'text',
      disabled: true,
      placement: 'bottom-start',
      fallbackPlacement: 'top-start',
      delay: null,
      dismissOnOutside: true,
      dismissOnBlur: true,
      controls: { delay: false, dismiss: true, sidePlacement: false, centerAlignment: false },
    });
  });

  it('marks every audited preview with the shared root convention', () => {
    const workspaces = [
      ['toolbar', 'toolbar/ToolbarBaseComponentsWorkspace.tsx'],
      ['search', 'search/SearchBaseComponentsWorkspace.tsx'],
      ['floating-panel', 'floating-panel/FloatingPanelBaseComponentsWorkspace.tsx'],
      ['canvas-toolbar', 'canvas-toolbar/CanvasToolbarBaseComponentsWorkspace.tsx'],
      ['toolbox-panel', 'toolbox-panel/ToolboxPanelBaseComponentsWorkspace.tsx'],
      ['sidebar-menu', 'sidebar-menu/SidebarMenuBaseComponentsWorkspace.tsx'],
      ['surface-box', 'surface-box/SurfaceBoxBaseComponentsWorkspace.tsx'],
      ['scroll-area', 'scroll-area/ScrollAreaBaseComponentsWorkspace.tsx'],
      ['dock-pane', 'dock-pane/DockPaneBaseComponentsWorkspace.tsx'],
      ['breadcrumbs', 'breadcrumbs/BreadcrumbsBaseComponentsWorkspace.tsx'],
      ['tabs', 'tabs/TabsBaseComponentsWorkspace.tsx'],
      ['accordion-disclosure', 'accordion-disclosure/AccordionDisclosureBaseComponentsWorkspace.tsx'],
      ['popover-tooltip', 'popover-tooltip/PopoverTooltipBaseComponentsWorkspace.tsx'],
      ['component-layout', 'component-layout/ComponentLayoutBaseComponentsWorkspace.tsx'],
      ['client-component', 'client-component/ClientComponentBaseComponentsWorkspace.tsx'],
    ] as const;

    for (const [section, relativePath] of workspaces) {
      const source = readFileSync(resolve(process.cwd(), 'src/features/base-components', relativePath), 'utf8');
      expect(source, section).toContain(`data-bc-preview-root="${section}"`);
    }
  });

  it('client-component maps min viewport and below-min behavior to UiClientComponent', async () => {
    const {
      DEFAULT_CLIENT_COMPONENT_BASE_COMPONENTS_CONFIG,
      resolveClientComponentOptionLiveness,
    } = await import('../client-component/ClientComponentBaseComponentsWorkspace');
    expect(resolveClientComponentOptionLiveness(DEFAULT_CLIENT_COMPONENT_BASE_COMPONENTS_CONFIG)).toMatchObject({
      component: 'UiClientComponent',
      clientProps: { minViewport: 'always', belowMin: 'continue' },
    });
    expect(resolveClientComponentOptionLiveness({
      minViewport: 'desktop',
      belowMin: 'placeholder',
      simulatedViewport: 'phone',
    })).toMatchObject({
      component: 'UiClientComponent',
      clientProps: { minViewport: 'desktop', belowMin: 'placeholder' },
    });
    expect(resolveClientComponentOptionLiveness({
      minViewport: 'always',
      belowMin: 'hide',
      simulatedViewport: 'phone',
    }).clientProps).toEqual({
      minViewport: 'always',
      belowMin: 'continue',
    });
  });

  it('dock-pane maps dock to UiDockPane', () => {
    expect(resolveDockPaneOptionLiveness(DEFAULT_DOCK_PANE_BASE_COMPONENTS_CONFIG).dockPaneProps).toEqual({
      dock: 'left',
    });
    expect(resolveDockPaneOptionLiveness({ dock: 'right' }).dockPaneProps).toEqual({ dock: 'right' });
    expect(resolveDockPaneOptionLiveness({ dock: 'top' }).dockPaneProps).toEqual({ dock: 'top' });
    expect(resolveDockPaneOptionLiveness({ dock: 'bottom' }).dockPaneProps).toEqual({ dock: 'bottom' });
  });

  it('component-layout maps preset, density, height, and direction to production props', async () => {
    const { resolveComponentLayoutOptionLiveness } = await import('../component-layout/ComponentLayoutBaseComponentsWorkspace');
    expect(resolveComponentLayoutOptionLiveness({
      preset: 'inspector',
      density: 'compact',
      heightMode: 'fill',
      direction: 'rtl',
    }).layoutProps).toEqual({
      preset: 'inspector',
      density: 'compact',
      heightMode: 'fill',
      direction: 'rtl',
    });
  });
});
