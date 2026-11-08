/**
 * Bug found (parity audit Phase 22): several Built-in layout presets were level-3 text/container
 * mockups (kanban columns, gradient chart placeholders, comparison matrix, raw KPI cards) instead
 * of real catalog widgets; dashboard-kpi duplicated kpi-metrics-grid; high-value pages (CRUD,
 * master-detail, 404/error, advanced search, tabbed profile/settings) were missing.
 * Fixed in presetExtendedTemplates.ts / enterprisePresetTemplates.ts / phase22BuiltInTemplates.ts /
 * newLayoutPresets.tsx: upgrade mockups to real viz/heroui/marketing widgets, alias dashboard-kpi
 * to kpi-metrics-grid, and register three new binding-ready built-ins.
 */
import { describe, expect, it } from 'vitest';
import { assertValidTsxSyntax } from './tsxSyntaxCheck';
import { generateDesignerTsx } from '../codegen';
import {
  createStateFromNewLayoutPreset,
  getTemplateForPreset,
  NEW_LAYOUT_PRESETS,
} from '../../../domain/component-designer/layout-presets/newLayoutPresets';
import {
  listBuiltInComponentSummaries,
  toBuiltInComponentId,
} from '../../../domain/component-designer/layout-presets/builtInComponents';
import { resolveBuiltInTemplateSeeds } from '../../../domain/component-designer/layout-presets/builtInTemplateResolver';
import type { NewLayoutPresetId } from '../../../domain/component-designer/layout-presets/types';
import type { TemplateNodeSeed } from '../types';

/** Dead Inspector fields removed across parity audits — must not appear as seed props. */
const REMOVED_DEAD_PROP_KEYS = [
  'fallbackSrc',
  'isLoaded',
  'closeOnSelect',
  'shouldCloseOnSelect',
  'allowCustomValue',
  'cardBelow', // only dead when misused on non-app-table-grid; we still allow on app-table-grid
] as const;

const STRICTLY_FORBIDDEN_PROP_KEYS = [
  'fallbackSrc',
  'isLoaded',
  'closeOnSelect',
  'shouldCloseOnSelect',
  'allowCustomValue',
] as const;

const PHASE22_UPGRADED_PRESETS: NewLayoutPresetId[] = [
  'kanban-board',
  'analytics-detail',
  'metrics-sidebar',
  'comparison-table',
  'dashboard-kpi',
];

const PHASE22_NEW_PRESETS: NewLayoutPresetId[] = [
  'crud-collection-page',
  'not-found-error-pages',
  'advanced-search-results',
];

const PHASE22_EXPANDED_PRESETS: NewLayoutPresetId[] = [
  'master-detail-header',
  'profile-overview',
  'user-account-settings',
];

const collectPaletteIds = (seed: TemplateNodeSeed, out = new Set<string>()): Set<string> => {
  if (typeof seed.paletteItemId === 'string' && seed.paletteItemId.trim()) {
    out.add(seed.paletteItemId.trim());
  }
  for (const child of seed.children ?? []) {
    collectPaletteIds(child, out);
  }
  return out;
};

const collectAllProps = (
  seed: TemplateNodeSeed,
  out: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> => {
  if (seed.props && typeof seed.props === 'object') {
    out.push(seed.props as Record<string, unknown>);
  }
  for (const child of seed.children ?? []) {
    collectAllProps(child, out);
  }
  return out;
};

const assertNoDeadProps = (presetId: NewLayoutPresetId, seeds: TemplateNodeSeed[]) => {
  for (const seed of seeds) {
    for (const props of collectAllProps(seed)) {
      for (const key of STRICTLY_FORBIDDEN_PROP_KEYS) {
        expect(props[key], `${presetId} must not use removed prop ${key}`).toBeUndefined();
      }
    }
  }
};

describe('builtInTemplatesPhase22UpgradeFix', () => {
  it.each(PHASE22_UPGRADED_PRESETS)('resolves upgraded preset %s with real catalog widgets', (presetId) => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId(presetId));
    expect(seeds).not.toBeNull();
    expect(seeds!.length).toBeGreaterThan(0);

    const paletteIds = collectPaletteIds(seeds![0]!);
    if (presetId === 'kanban-board') {
      expect(paletteIds.has('viz.kanban')).toBe(true);
    }
    if (presetId === 'analytics-detail') {
      expect(paletteIds.has('viz.chart-line')).toBe(true);
    }
    if (presetId === 'metrics-sidebar') {
      expect(paletteIds.has('viz.chart-bar')).toBe(true);
    }
    if (presetId === 'comparison-table') {
      expect(paletteIds.has('marketing.pricing-table')).toBe(false);
      expect(paletteIds.has('html.heading')).toBe(true);
      expect(paletteIds.has('heroui.button-solid')).toBe(true);
    }
    if (presetId === 'dashboard-kpi') {
      expect(paletteIds.has('content.stat-trend')).toBe(true);
      const kpiSeeds = getTemplateForPreset('kpi-metrics-grid');
      expect(JSON.stringify(seeds)).toBe(JSON.stringify(kpiSeeds));
    }

    assertNoDeadProps(presetId, seeds!);
  });

  it.each([...PHASE22_NEW_PRESETS, ...PHASE22_EXPANDED_PRESETS])(
    'resolves / clones / exports %s without syntax errors or dead props',
    (presetId) => {
      const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId(presetId));
      expect(seeds).not.toBeNull();
      assertNoDeadProps(presetId, seeds!);

      const { state } = createStateFromNewLayoutPreset(presetId);
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      assertValidTsxSyntax(`phase22-${presetId}`, tsx);
      expect(tsx).toContain('export const GeneratedComponent');

      for (const key of REMOVED_DEAD_PROP_KEYS) {
        if (key === 'cardBelow') {
          continue;
        }
        expect(tsx).not.toMatch(new RegExp(`\\b${key}=`));
      }
    },
  );

  it('registers new layout templates once with unique ids', () => {
    const catalog = listBuiltInComponentSummaries();
    const ids = catalog.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const presetId of PHASE22_NEW_PRESETS) {
      const componentId = toBuiltInComponentId(presetId);
      expect(ids).toContain(componentId);
      const preset = NEW_LAYOUT_PRESETS.find((entry) => entry.id === presetId);
      expect(preset).toBeTruthy();
      expect(preset!.category).toBe('app');
    }
  });

  it('crud-collection-page is binding-ready with app-table-grid + create modal form', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('crud-collection-page'));
    const paletteIds = collectPaletteIds(seeds![0]!);
    expect(paletteIds.has('heroui.app-table-grid')).toBe(true);
    expect(paletteIds.has('heroui.modal')).toBe(true);
    expect(paletteIds.has('html.form')).toBe(true);

    const json = JSON.stringify(seeds);
    expect(json).toContain('gridListResource');
    expect(json).toContain('apiRef');
  });

  it('not-found-error-pages includes shell.not-found and shell.error-page', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('not-found-error-pages'));
    const paletteIds = collectPaletteIds(seeds![0]!);
    expect(paletteIds.has('shell.not-found')).toBe(true);
    expect(paletteIds.has('shell.error-page')).toBe(true);
  });

  it('advanced-search-results combines entity-picker filters with data-grid', () => {
    const seeds = resolveBuiltInTemplateSeeds(toBuiltInComponentId('advanced-search-results'));
    const paletteIds = collectPaletteIds(seeds![0]!);
    expect(paletteIds.has('heroui.entity-picker')).toBe(true);
    expect(paletteIds.has('heroui.data-grid')).toBe(true);
  });

  it('master-detail / profile / settings use real interactive widgets', () => {
    const master = collectPaletteIds(resolveBuiltInTemplateSeeds(toBuiltInComponentId('master-detail-header'))![0]!);
    expect(master.has('html.form')).toBe(true);
    expect(master.has('heroui.data-grid')).toBe(true);

    const profile = collectPaletteIds(resolveBuiltInTemplateSeeds(toBuiltInComponentId('profile-overview'))![0]!);
    expect(profile.has('heroui.tabs')).toBe(true);

    const settings = collectPaletteIds(resolveBuiltInTemplateSeeds(toBuiltInComponentId('user-account-settings'))![0]!);
    expect(settings.has('heroui.tabs')).toBe(true);
    expect(settings.has('html.form')).toBe(true);
  });
});
