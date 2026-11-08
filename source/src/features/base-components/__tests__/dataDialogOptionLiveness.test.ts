import { describe, expect, it } from 'vitest';
import { resolveUiChartEchartsTemplate } from '../../../shared/ui';
import {
  DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG,
  resolveDialogPreset,
  resolveDialogPreviewProps,
} from '../dialog/DialogBaseComponentsWorkspace';
import {
  DEFAULT_CREATE_EDIT_BASE_COMPONENTS_CONFIG,
  resolveCreateEditPreviewModel,
} from '../create-edit/CreateEditBaseComponentsWorkspace';
import {
  applyConfirmFlowTone,
  DEFAULT_CONFIRM_BASE_COMPONENTS_CONFIG,
  resolveConfirmPreviewProps,
} from '../confirm/ConfirmBaseComponentsWorkspace';
import {
  DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG,
  resolveEnabledWizardStep,
  resolveWizardPreviewProps,
} from '../wizard/WizardBaseComponentsWorkspace';
import {
  applyGridChrome,
  applyGridMode,
  applyGridPreset,
  buildGridCompactFromDemoConfig,
  DEFAULT_GRID_BASE_COMPONENTS_CONFIG,
  resolveGridControlVisibility,
  resolveGridPreviewFillProps,
  resolveGridPreviewPresentation,
} from '../grid/GridBaseComponentsWorkspace';
import {
  DEFAULT_GRID_PAGING_DEMO_CONFIG,
  resolveGridPagingProductionProps,
  resolvePagingControlVisibility,
} from '../components/BaseComponentsGridPagingFields';
import {
  applyTreeLayout,
  applyTreePattern,
  DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG,
  resolveTreePresentation,
  resolveTreePreviewFillProps,
  resolveTreePreviewLayout,
  resolveTreeStackedActionsPlacement,
  resolveTreeStackedFieldLabels,
  resolveTreeStateView,
} from '../treegrid/TreeGridBaseComponentsWorkspace';
import {
  applyChartKind,
  applyChartPurpose,
  applyChartTemplate,
  CHART_PURPOSE_KINDS,
  DEFAULT_CHART_BASE_COMPONENTS_CONFIG,
  resolveChartDisplayControls,
  resolveChartPreviewModel,
  resolveChartRowsForState,
} from '../chart/ChartBaseComponentsWorkspace';
import {
  applyKanbanInteractionMode,
  applyKanbanPreset,
  canMoveKanbanCard,
  DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG,
  resolveKanbanInteraction,
  resolveKanbanStateOptions,
} from '../kanban/KanbanBaseComponentsWorkspace';
import {
  buildCrudSetDemoGridRows,
  buildCrudSetSpecFromDemoConfig,
  CRUD_SET_DEMO_PATCH_APIS,
  DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG,
  resolveCrudSetPreviewRows,
} from '../crud-set/CrudSetBaseComponentsWorkspace';
import {
  DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG,
  resolveEditViewOptionLiveness,
} from '../edit-view/EditViewBaseComponentsWorkspace';
import { BASE_COMPONENT_CATALOG } from '../catalog/baseComponentCatalog';
import {
  crudSetOmittedUi,
  crudSetPaginationEnabled,
  isBooleanTogglePatch,
  CRUD_SET_CELL_KINDS,
} from '../../../domain/component-designer/crudSetSpec';

describe('dialog option liveness', () => {
  it('maps presets, dismiss policy, focus, backdrop, and header tone to preview props', () => {
    const danger = resolveDialogPreset(DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG, 'danger');
    expect(danger).toMatchObject({
      bodyMode: 'validation',
      footerMode: 'action',
      actionPreset: 'cancel-delete',
    });
    expect(resolveDialogPreviewProps({
      ...danger,
      backdrop: 'designer',
      size: 'full',
      dismissPolicy: 'locked',
      showCloseButton: false,
      headerActionCount: 2,
      focusPolicy: 'primary-action',
    })).toEqual({
      backdrop: 'designer',
      backdropTint: 'medium',
      backdropBlur: 'default',
      backdropTransparency: 'opaque',
      size: 'full',
      closeOnBackdrop: false,
      closeOnEscape: false,
      showCloseButton: false,
      headerActionCount: 2,
      headerTone: 'danger',
      focusTarget: 'primary-action',
    });
    expect(resolveDialogPreviewProps({
      ...DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG,
      dismissPolicy: 'locked',
      showCloseButton: true,
    })).toMatchObject({
      closeOnBackdrop: false,
      closeOnEscape: false,
      showCloseButton: true,
    });
    expect(resolveDialogPreviewProps({
      ...DEFAULT_DIALOG_BASE_COMPONENTS_CONFIG,
      backdropTint: 'faint',
      backdropBlur: 'soft',
      backdropTransparency: 'clear',
    })).toMatchObject({
      backdrop: 'admin',
      backdropTint: 'faint',
      backdropBlur: 'soft',
      backdropTransparency: 'clear',
    });
  });
});

describe('create-edit option liveness', () => {
  it('resolves composition, gated fields, regions, dirty guard, and saving state', () => {
    const model = resolveCreateEditPreviewModel({
      ...DEFAULT_CREATE_EDIT_BASE_COMPONENTS_CONFIG,
      mode: 'create',
      composition: 'editor-rail',
      enabledGatedForm: true,
      state: 'dirty',
      showAuxiliaryFooter: true,
      showIntermediateFooter: true,
    }, false);
    expect(model.composition).toEqual({
      twoColumn: false,
      sectioned: false,
      editorRail: true,
    });
    expect(model.fieldDisabled).toBe(true);
    expect(model.closeRequiresConfirmation).toBe(true);
    expect(model.primaryLabel).toBe('Create');
    expect(model.shell).toMatchObject({
      showAuxiliaryFooter: true,
      showIntermediateFooter: true,
      showActionFooter: true,
      backdropTint: 'medium',
      backdropBlur: 'default',
      backdropTransparency: 'opaque',
      showCloseButton: true,
      headerActionCount: 1,
    });

    expect(resolveCreateEditPreviewModel({
      ...DEFAULT_CREATE_EDIT_BASE_COMPONENTS_CONFIG,
      state: 'saving',
    }, true)).toMatchObject({
      primaryDisabled: true,
      primaryLabel: 'Saving…',
    });
  });
});

describe('confirm option liveness', () => {
  it('normalizes flow tone and maps typed validation, focus, pending, error, and secondary action', () => {
    const warning = applyConfirmFlowTone(DEFAULT_CONFIRM_BASE_COMPONENTS_CONFIG, 'warning');
    expect(warning).toMatchObject({
      title: 'Revoke API key?',
      confirmIntent: 'warning',
      confirmLabel: 'Revoke',
    });
    const typed = {
      ...warning,
      bodyMode: 'typed' as const,
      confirmPhrase: 'REVOKE',
      focusPolicy: 'primary' as const,
      isConfirming: true,
      showError: true,
      secondaryAction: true,
    };
    expect(resolveConfirmPreviewProps(typed, 'wrong')).toMatchObject({
      tone: 'default',
      initialFocus: 'confirm',
      confirmDisabled: true,
      isConfirming: true,
      error: 'Delete failed. Try again.',
      showSecondaryAction: true,
      backdropTint: 'medium',
      backdropBlur: 'default',
      backdropTransparency: 'opaque',
      showCloseButton: true,
      headerActionCount: 0,
    });
    expect(resolveConfirmPreviewProps(typed, 'REVOKE').confirmDisabled).toBe(false);
  });
});

describe('wizard option liveness', () => {
  it('maps orientation, marker, viewport, state gates, and disabled-step normalization', () => {
    expect(resolveEnabledWizardStep([
      { title: 'Blocked', disabled: true },
      { title: 'Ready' },
    ], 0)).toBe(1);

    const props = resolveWizardPreviewProps({
      ...DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG,
      orientation: 'vertical',
      marker: 'number',
      viewport: 'phone',
      state: 'saving',
    }, 1, 3);
    expect(props).toMatchObject({
      orientation: 'vertical',
      marker: 'number',
      stepTabColor: 'theme',
      canMoveNext: false,
      finalActionDisabled: true,
      showSavingState: true,
      backdropTint: 'faint',
      backdropBlur: 'default',
      backdropTransparency: 'opaque',
      showCloseButton: true,
      headerActionCount: 0,
    });
    expect(props.shellClassName).toContain('100dvh');

    expect(resolveWizardPreviewProps({
      ...DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG,
      stepTabColorMode: 'theme',
    }, 0, 3).stepTabColor).toBe('theme');
    expect(resolveWizardPreviewProps({
      ...DEFAULT_WIZARD_BASE_COMPONENTS_CONFIG,
      stepTabColorMode: 'custom',
      stepTabSelectedHex: '#0EA5E9',
      stepTabUnselectedHex: '#64748B',
    }, 0, 3).stepTabColor).toEqual({
      selected: '#0EA5E9',
      unselected: '#64748B',
    });
  });
});

describe('grid option liveness', () => {
  it('normalizes presets and mode while resolving control visibility and responsive presentation', () => {
    expect(applyGridPreset(DEFAULT_GRID_BASE_COMPONENTS_CONFIG, 'selectable')).toMatchObject({
      selection: 'multiple',
      enableSort: true,
      enableColumnLayout: false,
    });
    const composed = applyGridMode({
      ...DEFAULT_GRID_BASE_COMPONENTS_CONFIG,
      selection: 'multiple',
      presentation: 'cards',
    }, 'composed');
    expect(composed).toMatchObject({ selection: 'none', presentation: 'table' });
    expect(resolveGridControlVisibility(composed)).toEqual({
      selection: false,
      presentation: false,
      compact: false,
      columnQuery: false,
    });
    expect(resolveGridPreviewPresentation('auto', 'phone')).toBe('cards');
    expect(resolveGridPreviewPresentation('auto', 'tablet')).toBe('cards');
    expect(buildGridCompactFromDemoConfig({
      ...DEFAULT_GRID_BASE_COMPONENTS_CONFIG,
      compactTabletLayout: 'cards',
      compactTabletCardsPerRow: 3,
    })).toEqual({
      tablet: { layout: 'cards', cardsPerRow: 3 },
    });
    expect(resolveGridPreviewFillProps(true)).toEqual({
      fillHeight: true,
      scrollClassName: 'max-h-full',
      previewHostClassName: 'flex h-full min-h-0 flex-1 flex-col',
    });
    expect(resolveGridPreviewFillProps(false)).toEqual({
      fillHeight: false,
      scrollClassName: undefined,
      previewHostClassName: 'min-h-0',
    });
    expect(DEFAULT_GRID_BASE_COMPONENTS_CONFIG.fillHeight).toBe(true);
    expect(DEFAULT_GRID_BASE_COMPONENTS_CONFIG.chrome).toBe('classic');
    expect(DEFAULT_GRID_BASE_COMPONENTS_CONFIG.cellPaddingX).toBe(5);
    expect(BASE_COMPONENT_CATALOG.options.find((option) => option.id === 'grid.chrome')?.defaultValue).toBe('classic');
    expect(BASE_COMPONENT_CATALOG.options.find((option) => option.id === 'grid.cellPaddingX')?.defaultValue).toBe(5);
    expect(BASE_COMPONENT_CATALOG.options.find((option) => option.id === 'grid.features')?.defaultValue).toEqual(['sort', 'filter', 'resize']);
    expect(applyGridChrome(DEFAULT_GRID_BASE_COMPONENTS_CONFIG, 'hero')).toMatchObject({
      chrome: 'hero',
      margin: 4,
      borderWidth: 5,
    });
    expect(applyGridChrome(applyGridChrome(DEFAULT_GRID_BASE_COMPONENTS_CONFIG, 'hero'), 'classic')).toMatchObject({
      chrome: 'classic',
      margin: 0,
      borderWidth: 0,
    });
  });
});

describe('grid paging option liveness', () => {
  it('maps paging mode to production footer props and hides irrelevant controls', () => {
    expect(resolvePagingControlVisibility('cursor')).toEqual({
      listMode: false,
      siblingPages: false,
      firstLast: false,
      pageJump: false,
      pageNumbers: false,
    });
    expect(resolveGridPagingProductionProps({
      ...DEFAULT_GRID_PAGING_DEMO_CONFIG,
      mode: 'cursor',
      pageJump: true,
      showFirstLast: true,
    }, 'paging', 'phone')).toMatchObject({
      listMode: 'infinite',
      showFirstLast: false,
      showPageNumbers: false,
      showPageJump: false,
      responsiveMode: 'phone',
      trailingAction: 'cursor',
    });
  });

  it('defaults paging on for Grid and off for TreeGrid', () => {
    expect(DEFAULT_GRID_BASE_COMPONENTS_CONFIG.paging.enabled).toBe(true);
    expect(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.paging.enabled).toBe(false);
    expect(BASE_COMPONENT_CATALOG.options.find((option) => option.id === 'treegrid.paging')?.defaultValue).toBe(false);
  });
});

describe('treegrid option liveness', () => {
  it('normalizes navigation and responsive layouts and maps loading/error/empty states', () => {
    const navigation = applyTreePattern({
      ...DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG,
      moveDisabled: false,
    }, 'navigation-tree');
    expect(navigation.moveDisabled).toBe(true);
    expect(resolveTreePresentation(navigation)).toEqual({
      layout: 'hybrid-stacked',
      showHeader: false,
      showIdColumn: false,
      showDataColumns: false,
    });
    expect(applyTreeLayout({
      ...DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG,
      moveDisabled: false,
    }, 'hybrid-stacked').moveDisabled).toBe(true);
    expect(resolveTreeStateView('branch-loading').loadingByParent).toEqual({ 'root-0': true });
    expect(resolveTreeStateView('error').showError).toBe(true);
    expect(resolveTreeStateView('empty').showEmpty).toBe(true);
  });

  it('resolves Presentation, Cards from, and compact overlays like Grid', () => {
    const auto = DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG;
    expect(resolveTreePreviewLayout(auto, 'phone')).toBe('hybrid-stacked');
    expect(resolveTreePreviewLayout(auto, 'tablet')).toBe('hybrid-stacked');
    expect(resolveTreePreviewLayout(auto, 'desktop')).toBe('table');
    expect(resolveTreePreviewLayout({ ...auto, cardBelow: 'tablet' }, 'tablet')).toBe('hybrid-stacked');
    expect(resolveTreePreviewLayout({ ...auto, cardBelow: 'desktop' }, 'desktop')).toBe('hybrid-stacked');
    expect(resolveTreePreviewLayout({ ...auto, presentation: 'table' }, 'phone')).toBe('table');
    expect(resolveTreePreviewLayout({ ...auto, presentation: 'cards' }, 'desktop')).toBe('hybrid-stacked');
    expect(resolveTreePreviewLayout({ ...auto, compactPhoneLayout: 'keep-table' }, 'phone')).toBe('table');
    expect(resolveTreePreviewLayout({ ...auto, compactTabletLayout: 'cards' }, 'tablet')).toBe('hybrid-stacked');
    expect(resolveTreeStackedActionsPlacement(auto)).toBe('footer');
    expect(resolveTreeStackedActionsPlacement({ ...auto, compactActionsPlacement: 'header' })).toBe('header');
    expect(resolveTreeStackedActionsPlacement({ ...auto, compactShowActions: false })).toBe('none');
    expect(resolveTreeStackedFieldLabels('inherit')).toBe('inline');
    expect(resolveTreeStackedFieldLabels('hidden')).toBe('hidden');
    expect(resolveTreePreviewFillProps(true).previewHostClassName).toContain('flex-1');
    expect(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.fillHeight).toBe(true);
    expect(DEFAULT_TREEGRID_BASE_COMPONENTS_CONFIG.stickyHeader).toBe(true);
  });
});

describe('chart option liveness', () => {
  it('enforces purpose-kind compatibility and resolves display and data-state behavior', () => {
    expect(CHART_PURPOSE_KINDS.trend).toEqual(['line', 'area', 'sparkline', 'candlestick']);
    expect(applyChartPurpose(DEFAULT_CHART_BASE_COMPONENTS_CONFIG, 'relationship')).toMatchObject({
      purpose: 'relationship',
      kind: 'scatter',
    });
    expect(resolveChartDisplayControls('gauge')).toMatchObject({
      legend: false,
      grid: false,
      takeaway: true,
      tooltip: false,
      renderer: false,
    });
    expect(resolveChartDisplayControls('area')).toMatchObject({
      legend: true,
      grid: true,
      stacked: true,
      smooth: true,
      tooltip: true,
      marks: true,
      magicType: true,
    });
    expect(resolveChartPreviewModel(DEFAULT_CHART_BASE_COMPONENTS_CONFIG).component).toBe('UiBarChart');
    expect(resolveChartPreviewModel({
      ...DEFAULT_CHART_BASE_COMPONENTS_CONFIG,
      kind: 'sunburst',
    }).component).toBe('UiAdvancedChart');
    expect(applyChartKind(DEFAULT_CHART_BASE_COMPONENTS_CONFIG, 'scatter')).toMatchObject({
      purpose: 'relationship',
      kind: 'scatter',
    });
    expect(resolveChartRowsForState('empty')).toHaveLength(0);
    expect(resolveChartRowsForState('insufficient')).toHaveLength(1);
    expect(resolveChartRowsForState('filtered')).toHaveLength(3);
  });

  it('applies ECharts templates onto compatible kind, purpose, and chrome', () => {
    const polar = applyChartTemplate(DEFAULT_CHART_BASE_COMPONENTS_CONFIG, 'polar-bar');
    expect(polar).toMatchObject({
      template: 'polar-bar',
      kind: 'bar',
      purpose: 'comparison',
      showTitle: true,
      titleText: 'Polar bar',
    });
    expect(resolveUiChartEchartsTemplate('polar-bar').option?.polar).toBeTruthy();
    expect(applyChartTemplate(polar, 'nightingale')).toMatchObject({
      template: 'nightingale',
      kind: 'pie',
      purpose: 'part-to-whole',
      roseType: 'radius',
    });
    expect(applyChartKind(polar, 'line')).toMatchObject({
      template: 'custom',
      kind: 'line',
      purpose: 'trend',
    });
  });
});

describe('kanban option liveness', () => {
  it('normalizes presets and interaction while enforcing keyboard, state, and WIP behavior', () => {
    const readOnly = applyKanbanPreset({
      ...DEFAULT_KANBAN_BASE_COMPONENTS_CONFIG,
      state: 'dragging',
    }, 'read-only');
    expect(readOnly).toMatchObject({ interactive: false, state: 'default' });
    expect(applyKanbanInteractionMode(readOnly, true)).toMatchObject({
      interactive: true,
      preset: 'status',
    });
    expect(resolveKanbanInteraction({
      interactive: true,
      keyboardMove: false,
      state: 'default',
    })).toEqual({
      interactive: true,
      enableKeyboardMove: false,
    });
    expect(resolveKanbanStateOptions({ interactive: false, wipLimits: true })).toEqual([
      'default',
      'empty',
    ]);

    const columns = [
      { id: 'todo', title: 'To do', cards: [] },
      {
        id: 'done',
        title: 'Done',
        cards: [
          { id: '1', title: 'One' },
          { id: '2', title: 'Two' },
        ],
      },
    ];
    expect(canMoveKanbanCard(true, 'done', columns)).toBe(false);
    expect(canMoveKanbanCard(false, 'done', columns)).toBe(true);
  });
});

describe('new data display option liveness', () => {
  it('map shows cluster markers only for pin maps', async () => {
    const { resolveMapOptionLiveness } = await import('../map/MapBaseComponentsWorkspace');
    expect(resolveMapOptionLiveness({
      kind: 'pin',
      tileProvider: 'osm',
      clusterMarkers: true,
      height: 280,
    }).visibleOptions).toEqual(['kind', 'tileProvider', 'clusterMarkers', 'height']);
    expect(resolveMapOptionLiveness({
      kind: 'choropleth',
      tileProvider: 'osm',
      clusterMarkers: true,
      height: 360,
    })).toMatchObject({
      visibleOptions: ['kind', 'tileProvider', 'height'],
      mapProps: { clusterMarkers: false, height: 360 },
    });
  });

  it('codes switches QR download vs barcode format controls', async () => {
    const { resolveCodesOptionLiveness } = await import('../codes/CodesBaseComponentsWorkspace');
    expect(resolveCodesOptionLiveness({
      kind: 'qr',
      value: 'https://appendO.dev',
      size: 160,
      downloadable: true,
      format: 'CODE128',
      showValue: true,
    }).visibleOptions).toEqual(['kind', 'value', 'size', 'downloadable']);
    expect(resolveCodesOptionLiveness({
      kind: 'barcode',
      value: '1234567890128',
      size: 160,
      downloadable: true,
      format: 'EAN13',
      showValue: false,
    }).visibleOptions).toEqual(['kind', 'value', 'size', 'format', 'showValue']);
  });

  it('media players expose video vs audio control families', async () => {
    const { resolveMediaPlayersOptionLiveness } = await import('../media-players/MediaPlayersBaseComponentsWorkspace');
    expect(resolveMediaPlayersOptionLiveness({
      kind: 'video',
      controls: false,
      loop: true,
      showCaptions: true,
      showWaveform: true,
      playbackSpeedControl: true,
    }).playerProps).toMatchObject({ controls: false, showCaptions: true, showWaveform: false });
    expect(resolveMediaPlayersOptionLiveness({
      kind: 'audio',
      controls: false,
      loop: false,
      showCaptions: true,
      showWaveform: false,
      playbackSpeedControl: true,
    }).visibleOptions).toEqual(['kind', 'showWaveform', 'playbackSpeedControl', 'loop']);
  });

  it('spreadsheet maps FortuneSheet settings onto UiSpreadsheet props', async () => {
    const { resolveSpreadsheetOptionLiveness } = await import('../spreadsheet/SpreadsheetBaseComponentsWorkspace');
    const open = resolveSpreadsheetOptionLiveness({
      showToolbar: true,
      toolbarPreset: 'full',
      showFormulaBar: true,
      showSheetTabs: true,
      statBar: 'tabs',
      allowEdit: true,
      height: 420,
      lang: 'en',
      direction: 'ltr',
      currency: 'USD',
      row: 36,
      column: 18,
      addRows: 50,
      showAddColumns: true,
      defaultFontSize: 11,
      defaultRowHeight: 19,
      defaultColWidth: 73,
      showRowHeader: true,
      showColumnHeader: true,
      showGridLines: true,
      devicePixelRatio: 'auto',
      forceCalculation: false,
      cellMenuPreset: 'full',
      headerMenuPreset: 'full',
      sheetTabMenuPreset: 'full',
      filterMenuPreset: 'full',
    });
    expect(open.visibleOptions).toContain('toolbarPreset');
    expect(open.visibleOptions).toEqual(expect.arrayContaining([
      'showToolbar', 'toolbarPreset', 'statBar', 'lang', 'direction', 'currency', 'row', 'column',
      'showRowHeader', 'showGridLines', 'cellMenuPreset', 'filterMenuPreset',
    ]));
    expect(open.spreadsheetProps.statBar).toBe('tabs');
    expect(open.spreadsheetProps.currency).toBe('$');
    expect(open.spreadsheetProps.toolbarItems.length).toBeGreaterThan(10);

    const closed = resolveSpreadsheetOptionLiveness({
      showToolbar: false,
      toolbarPreset: 'compact',
      showFormulaBar: false,
      showSheetTabs: true,
      statBar: 'footer',
      allowEdit: false,
      height: 'full',
      lang: 'zh',
      direction: 'rtl',
      currency: 'CNY',
      row: 84,
      column: 60,
      addRows: 10,
      showAddColumns: false,
      defaultFontSize: 14,
      defaultRowHeight: 32,
      defaultColWidth: 140,
      showRowHeader: false,
      showColumnHeader: false,
      showGridLines: false,
      devicePixelRatio: 2,
      forceCalculation: true,
      cellMenuPreset: 'none',
      headerMenuPreset: 'edit',
      sheetTabMenuPreset: 'none',
      filterMenuPreset: 'none',
    });
    expect(closed.visibleOptions).not.toContain('toolbarPreset');
    expect(closed.spreadsheetProps).toMatchObject({
      showToolbar: false,
      allowEdit: false,
      height: 'full',
      lang: 'zh',
      direction: 'rtl',
      currency: '¥',
      rowHeaderWidth: 0,
      columnHeaderHeight: 0,
      forceCalculation: true,
      devicePixelRatio: 2,
      showAddColumns: false,
      statBar: 'footer',
      cellContextMenu: [],
      sheetTabContextMenu: [],
      filterContextMenu: [],
    });
    expect(closed.spreadsheetProps.headerContextMenu).toEqual(expect.arrayContaining(['copy', 'insert-row']));
  });
});

describe('crud-set option liveness', () => {
  it('maps catalog options onto CrudSetSpec chrome and omitted pieces', () => {
    const full = buildCrudSetSpecFromDemoConfig(DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG);
    expect(full.listBody).toBe('grid');
    expect(crudSetPaginationEnabled(full)).toBe(true);
    expect(full.createApis).toHaveLength(2);
    expect(full.createApis[0]?.acceptedFields).toEqual([
      'code', 'title', 'subtitle', 'website', 'parentTitle', 'status', 'owner',
      'city', 'detailNote', 'tags', 'comments', 'latitude', 'longitude', 'active',
    ]);
    expect(full.patches.find((patch) => patch.kind === 'content')?.acceptedFields).toEqual([
      'title', 'subtitle', 'website', 'parentTitle', 'status', 'owner',
      'city', 'detailNote', 'tags', 'comments', 'latitude', 'longitude', 'active',
    ]);
    expect(full.export?.enabled).toBe(true);
    expect(full.export?.formats).toEqual(['xlsx', 'csv']);
    expect(full.export?.defaultFormat).toBe('xlsx');
    expect(full.deleteApi).toBeDefined();
    expect(full.patches.some((patch) => patch.kind === 'content')).toBe(true);
    expect(full.patches.some(isBooleanTogglePatch)).toBe(true);
    expect(full.columns.find((column) => column.field === 'locked')?.cellKind).toBe('lock-status');
    expect(full.columns.find((column) => column.field === 'status')?.cellKind).toBe('badge');
    expect(full.columns.find((column) => column.field === 'photo')).toMatchObject({
      cellKind: 'image',
      imageMask: 'circle',
    });
    expect(full.columns.find((column) => column.field === 'createdAt')).toMatchObject({
      cellKind: 'audit',
      secondaryField: 'createdBy',
      stack: 'stacked',
    });
    expect(full.columns.find((column) => column.field === 'updatedAt')).toMatchObject({
      cellKind: 'date',
      secondaryField: 'updatedBy',
      stack: 'stacked',
    });
    expect(full.columns.find((column) => column.field === 'status')?.secondaryField).toBe('approvedBy');
    expect(full.columns.find((column) => column.field === 'owner')?.cellKind).toBe('text');
    expect(full.columns.find((column) => column.field === 'tags')?.cellKind).toBe('chips');
    expect(full.columns.find((column) => column.field === 'comments')?.cellKind).toBe('chips');
    expect(full.columns.find((column) => column.field === 'city')).toMatchObject({
      cellKind: 'text',
      secondaryField: 'detailNote',
      stack: 'stacked',
    });
    expect(full.columns.find((column) => column.field === 'website')?.cellKind).toBe('link');
    expect(full.columns.find((column) => column.field === 'active')?.cellKind).toBe('boolean-icon');
    expect(full.columns.find((column) => column.field === 'active')?.formPlacement).toBe('side');
    expect(full.columns.find((column) => column.field === 'locked')?.formPlacement).toBe('side');
    expect(new Set(full.columns.map((column) => column.cellKind))).toEqual(new Set(CRUD_SET_CELL_KINDS));
    expect(full.columns.find((column) => column.field === 'latitude')?.cellKind).toBe('text');
    expect(full.columns.find((column) => column.field === 'longitude')?.cellKind).toBe('text');
    expect(full.columns.find((column) => column.field === 'parentTitle')?.cellKind).toBe('text');
    const relationsOff = buildCrudSetSpecFromDemoConfig({
      ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG,
      relations: {
        ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG.relations,
        tags: false,
        comments: false,
        owner: false,
        detail: false,
        parent: false,
      },
    });
    expect(relationsOff.columns.map((column) => column.field)).toEqual([
      'photo', 'code', 'title', 'status', 'website', 'latitude', 'longitude', 'active', 'locked', 'createdAt', 'updatedAt',
    ]);
    expect(relationsOff.createApis[0]?.acceptedFields).toEqual([
      'code', 'title', 'subtitle', 'website', 'status', 'latitude', 'longitude', 'active',
    ]);
    expect(relationsOff.patches.find((patch) => patch.kind === 'content')?.acceptedFields).toEqual([
      'title', 'subtitle', 'website', 'status', 'latitude', 'longitude', 'active',
    ]);
    const demoRow = buildCrudSetDemoGridRows()[0];
    expect(demoRow).toEqual(expect.objectContaining({
      createdAt: expect.any(String),
      createdBy: expect.any(String),
      updatedAt: expect.any(String),
      updatedBy: expect.any(String),
      latitude: expect.any(Number),
      longitude: expect.any(Number),
      detailNote: expect.any(String),
      tags: expect.any(Array),
    }));
    const lockedRow = buildCrudSetDemoGridRows().find((row) => row.locked);
    expect(lockedRow).toEqual(expect.objectContaining({
      lockedAt: expect.any(String),
      lockedBy: expect.any(String),
    }));
    const approvedRow = buildCrudSetDemoGridRows().find((row) => row.status === 'Approved');
    expect(approvedRow).toEqual(expect.objectContaining({
      approvedAt: expect.any(String),
      approvedBy: expect.any(String),
    }));
    expect(full.filterBar?.search).not.toBe(false);
    expect(full.filterBar?.enabled).not.toBe(false);
    expect(full.refresh).not.toBe(false);
    expect(full.paging?.pattern).toBe('numbered');
    expect(full.paging?.defaultPageSize).toBe(50);
    expect(full.sorting?.footer).not.toBe(false);
    expect(full.sorting?.defaultField).toBe('code');
    expect(full.grid?.chrome).toBe('classic');
    expect(full.grid?.presentation).toBe('auto');
    expect(full.actions?.maxVisible).toBe(3);
    expect(full.dialogs?.formSize).toBe('lg');
    expect(full.dialogs?.confirmSize).toBe('sm');
    expect(full.filterBar?.searchClear).not.toBe(false);
    expect(full.columns.find((column) => column.field === 'code')?.cardRole).toBe('title');
    expect(full.filterBar?.filters?.some((filter) => filter.field === 'status')).toBe(true);
    expect(crudSetOmittedUi(full)).toMatchObject({
      create: false,
      patches: false,
      delete: false,
      export: false,
      paging: false,
      filterBar: false,
      refresh: false,
    });

    const stripped = buildCrudSetSpecFromDemoConfig({
      ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG,
      listBody: 'tree-grid',
      pagination: true,
      exportEnabled: false,
      createApis: [],
      patches: [],
      deleteEnabled: false,
      columns: [
        { field: 'code', label: 'Code' },
        { field: 'title', label: 'Title' },
      ],
      refreshEnabled: false,
      filterBar: { ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG.filterBar, enabled: false },
    });
    expect(stripped.listBody).toBe('tree-grid');
    expect(crudSetPaginationEnabled(stripped)).toBe(false);
    expect(stripped.columns.map((column) => column.field)).toEqual(['code', 'title']);
    expect(crudSetOmittedUi(stripped)).toEqual({
      create: true,
      patches: true,
      delete: true,
      export: true,
      paging: true,
      filterBar: true,
      refresh: true,
      collection: true,
      autoRefresh: true,
      rowActions: true,
    });

    const customized = buildCrudSetSpecFromDemoConfig({
      ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG,
      paging: {
        ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG.paging,
        pattern: 'prev-next',
        defaultPageSize: 100,
        summary: false,
        listModeSwitch: false,
      },
      sorting: { footer: false, defaultField: 'title', defaultDirection: 'desc' },
      grid: { chrome: 'hero', density: 'compact', presentation: 'cards', selection: 'multiple' },
      actions: { maxVisible: 2, align: 'start' },
      dialogs: { formSize: 'sm', confirmSize: 'md', confirmInitialFocus: 'confirm' },
    });
    expect(customized.paging?.pattern).toBe('prev-next');
    expect(customized.paging?.defaultPageSize).toBe(100);
    expect(customized.paging?.summary).toBe(false);
    expect(customized.sorting?.footer).toBe(false);
    expect(customized.sorting?.defaultField).toBe('title');
    expect(customized.sorting?.defaultDirection).toBe('desc');
    expect(customized.grid?.chrome).toBe('hero');
    expect(customized.grid?.density).toBe('compact');
    expect(customized.grid?.presentation).toBe('cards');
    expect(customized.actions?.maxVisible).toBe(2);
    expect(customized.dialogs?.formSize).toBe('sm');

    const titleOpen = buildCrudSetSpecFromDemoConfig({
      ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG,
      patches: [
        { ...CRUD_SET_DEMO_PATCH_APIS[0]!, openFromColumnId: 'title' },
        { ...CRUD_SET_DEMO_PATCH_APIS[1]! },
      ],
    });
    expect(titleOpen.patches.find((patch) => patch.kind === 'content')?.openFromColumnId).toBe('title');
    expect(titleOpen.patches.find((patch) => patch.kind === 'purpose')?.interaction).not.toBe('boolean-toggle');
    expect(titleOpen.patches.find((patch) => patch.id === 'approve')?.openFromColumnId).toBeUndefined();

    const columnApprove = buildCrudSetSpecFromDemoConfig({
      ...DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG,
      patches: [
        { ...CRUD_SET_DEMO_PATCH_APIS[0]! },
        { ...CRUD_SET_DEMO_PATCH_APIS[1]!, openFromColumnId: 'status' },
        { ...CRUD_SET_DEMO_PATCH_APIS[2]! },
      ],
    });
    expect(columnApprove.patches.find((patch) => patch.id === 'approve')?.openFromColumnId).toBe('status');
    expect(columnApprove.patches.find((patch) => patch.id === 'edit')?.openFromColumnId).toBeUndefined();
    expect(columnApprove.patches.some(isBooleanTogglePatch)).toBe(true);
    expect(resolveCrudSetPreviewRows({ listBody: 'grid', displayState: 'empty' }, [{ id: '1' }])).toEqual([]);
    expect(resolveCrudSetPreviewRows({ listBody: 'grid', displayState: 'default' }, [{ id: '1' }])).toEqual([{ id: '1' }]);
  });
});

describe('edit-view option liveness', () => {
  it('maps Edit / View options onto RecordForm placement, size, and side header', () => {
    expect(resolveEditViewOptionLiveness(DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG)).toMatchObject({
      component: 'RecordForm',
      mode: 'edit',
      formSize: '4xl',
      showHeader: true,
      subHeaderCount: 0,
      showFooter: true,
      subFooterCount: 0,
      sidePanelTitle: 'Flags',
      sidePanelPlacement: 'end',
      sidePanelPinnable: false,
      sidePanelSplitter: true,
      sidePanelShowTitle: true,
      sidePanelTitleInHeader: false,
      sidePanelBackground: 'theme',
      sidePanelBackgroundColor: '',
      sideFields: ['active', 'locked'],
    });
    expect(resolveEditViewOptionLiveness({
      ...DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG,
      mode: 'view',
      formSize: 'maximized',
      sidePanelTitle: ' Status ',
      showHeader: false,
      subHeaderCount: 2,
      showFooter: false,
      subFooterCount: 1,
      sidePanelPlacement: 'left',
      sidePanelPinnable: true,
      sidePanelSplitter: true,
      sidePanelShowTitle: true,
      sidePanelTitleInHeader: true,
      sidePanelBackground: 'custom',
      sidePanelBackgroundColor: '#FFF7ED',
    })).toMatchObject({
      mode: 'view',
      formSize: 'maximized',
      showHeader: false,
      subHeaderCount: 2,
      showFooter: false,
      subFooterCount: 1,
      sidePanelTitle: 'Status',
      sidePanelPlacement: 'left',
      sidePanelPinnable: true,
      sidePanelSplitter: true,
      sidePanelTitleInHeader: true,
      sidePanelBackground: 'custom',
      sidePanelBackgroundColor: '#FFF7ED',
    });
    expect(resolveEditViewOptionLiveness({
      ...DEFAULT_EDIT_VIEW_BASE_COMPONENTS_CONFIG,
      sidePanelShowTitle: false,
      sidePanelTitle: 'Flags',
      sidePanelTitleInHeader: true,
    })).toMatchObject({
      sidePanelTitle: '',
      sidePanelShowTitle: false,
      sidePanelTitleInHeader: false,
    });
  });
});
