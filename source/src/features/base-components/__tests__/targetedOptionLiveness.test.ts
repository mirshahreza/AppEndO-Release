import { describe, expect, it } from 'vitest';
import {
  resolveDialogPreset,
  type DialogBaseComponentsConfig,
} from '../dialog/DialogBaseComponentsWorkspace';
import {
  applyChartPurpose,
  CHART_PURPOSE_KINDS,
  DEFAULT_CHART_BASE_COMPONENTS_CONFIG,
} from '../chart/ChartBaseComponentsWorkspace';
import { resolveGridPreviewPresentation } from '../grid/GridBaseComponentsWorkspace';
import { resolvePagingControlVisibility } from '../components/BaseComponentsGridPagingFields';
import { resolveTreePresentation } from '../treegrid/TreeGridBaseComponentsWorkspace';
import { resolveEnabledWizardStep } from '../wizard/WizardBaseComponentsWorkspace';
import {
  resolveKanbanInteraction,
  resolveKanbanStateOptions,
} from '../kanban/KanbanBaseComponentsWorkspace';

const dialogConfig: DialogBaseComponentsConfig = {
  colorSource: 'accent',
  tone: 'cyan',
  customColorHex: '#0891b2',
  backdrop: 'admin',
  backdropTint: 'medium',
  backdropBlur: 'default',
  backdropTransparency: 'opaque',
  size: '3xl',
  title: 'Dialog',
  headerActionCount: 1,
  showCloseButton: true,
  bands: [],
  bodyMode: 'plain',
  footerMode: 'both',
  actionPreset: 'cancel-save',
  preset: 'informational',
  state: 'default',
  dismissPolicy: 'escape,outside',
  focusPolicy: 'safe-defaults',
};

const chartConfig = DEFAULT_CHART_BASE_COMPONENTS_CONFIG;

describe('targeted Base Components option liveness', () => {
  it('normalizes dialog presets into observable, compatible compositions', () => {
    expect(resolveDialogPreset(dialogConfig, 'danger')).toMatchObject({
      title: 'Delete this record?',
      bodyMode: 'validation',
      footerMode: 'action',
      actionPreset: 'cancel-delete',
    });
    expect(resolveDialogPreset(dialogConfig, 'progress')).toMatchObject({
      state: 'loading',
      footerMode: 'auxiliary',
      dismissPolicy: 'locked',
      showCloseButton: false,
    });
  });

  it('maps purpose to compatible chart kinds and selects a live default', () => {
    expect(CHART_PURPOSE_KINDS['part-to-whole']).toEqual(['pie', 'donut', 'treemap', 'sunburst', 'funnel']);
    expect(applyChartPurpose(chartConfig, 'relationship')).toMatchObject({
      purpose: 'relationship',
      kind: 'scatter',
    });
  });

  it('resolves responsive grid and paging scenarios without CSS-only overrides', () => {
    expect(resolveGridPreviewPresentation('auto', 'phone')).toBe('cards');
    expect(resolveGridPreviewPresentation('auto', 'tablet')).toBe('cards');
    expect(resolveGridPreviewPresentation('auto', 'desktop')).toBe('table');
    expect(resolvePagingControlVisibility('cursor')).toEqual({
      listMode: false,
      siblingPages: false,
      firstLast: false,
      pageJump: false,
      pageNumbers: false,
    });
  });

  it('normalizes tree, wizard, and Kanban interaction constraints', () => {
    expect(resolveTreePresentation({
      pattern: 'navigation-tree',
      presentation: 'table',
      showHeader: true,
      showIdColumn: true,
    })).toEqual({
      layout: 'hybrid-stacked',
      showHeader: false,
      showIdColumn: false,
      showDataColumns: false,
    });
    expect(resolveEnabledWizardStep([
      { title: 'Disabled', disabled: true },
      { title: 'Ready' },
    ], 0)).toBe(1);
    expect(resolveKanbanInteraction({
      interactive: true,
      keyboardMove: false,
      state: 'default',
    })).toEqual({
      interactive: true,
      enableKeyboardMove: false,
    });
    expect(resolveKanbanInteraction({
      interactive: true,
      keyboardMove: true,
      state: 'saving',
    }).interactive).toBe(false);
    expect(resolveKanbanStateOptions({ interactive: false, wipLimits: true })).toEqual([
      'default',
      'empty',
    ]);
    expect(resolveKanbanStateOptions({ interactive: true, wipLimits: true })).toContain('invalid-drop');
  });
});
