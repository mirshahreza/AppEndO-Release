import { describe, expect, it } from 'vitest';
import { getCatalogProductionOptions } from '../../base-components/catalogAccess';
import { applyCatalogProp, readCatalogProp } from '../applyCatalogProp';
import {
  catalogOptionGroupTitle,
  compileInspectorFromCatalog,
  compileInspectorForPaletteItem,
} from '../compileInspectorFromCatalog';
import {
  DESIGNER_CATALOG_IDENTITY,
  getCompileComponentId,
} from '../designerCatalogIdentity';
import { resolveInspectorFieldSections } from '../inspectorRegistry';
import { createInitialDesignerState, designerReducer } from '../state';

describe('compileInspectorFromCatalog', () => {
  it('compiles exactly the public-prop + composition-prop options for crud-set', () => {
    const options = getCatalogProductionOptions('crud-set');
    const fields = compileInspectorFromCatalog('crud-set');
    expect(options.length).toBeGreaterThan(40);
    expect(fields).toHaveLength(options.length);
    expect(fields.every((field) => field.propPath.length > 0)).toBe(true);
    expect(fields.some((field) => field.catalogOptionId === 'crudSet.listBody')).toBe(true);
    expect(fields.some((field) => field.catalogOptionId === 'crudSet.state')).toBe(false);
    expect(fields.some((field) => field.catalogOptionId === 'crudSet.relations.parent')).toBe(false);
    expect(catalogOptionGroupTitle('crudSet.grid.chrome')).toBe('Body');
    expect(catalogOptionGroupTitle('crudSet.paging.pattern')).toBe('Paging');
    expect(catalogOptionGroupTitle('crudSet.createCount')).toBe('APIs');
    expect(catalogOptionGroupTitle('crudSet.listApi')).toBe('APIs');
    expect(fields.some((field) => field.catalogOptionId === 'crudSet.listApi')).toBe(true);
    expect(fields.some((field) => field.catalogOptionId === 'crudSet.readOneApi')).toBe(true);
    expect(fields.filter((field) => field.catalogGroup === 'APIs').length).toBeGreaterThan(0);
    expect(fields.every((field) => field.catalogGroup.length > 0)).toBe(true);
  });

  it('groups shared production props on the same axis titles across components', () => {
    const dialogSize = compileInspectorFromCatalog('dialog').find((field) => field.catalogOptionId === 'dialog.size');
    const avatarSize = compileInspectorFromCatalog('avatar').find((field) => field.catalogOptionId === 'avatar.size');
    const chipVariant = compileInspectorFromCatalog('chip').find((field) => field.catalogOptionId === 'chip.variant');
    const chipTone = compileInspectorFromCatalog('chip').find((field) => field.catalogOptionId === 'chip.tone');
    const chartHeight = compileInspectorFromCatalog('chart').find((field) => field.catalogOptionId === 'chart.height');
    expect(dialogSize?.catalogGroup).toBe('Layout');
    expect(avatarSize?.catalogGroup).toBe('Layout');
    expect(chartHeight?.catalogGroup).toBe('Layout');
    expect(chipVariant?.catalogGroup).toBe('Appearance');
    expect(chipTone?.catalogGroup).toBe('Appearance');
  });

  it('compiles edit-view production options', () => {
    const options = getCatalogProductionOptions('edit-view');
    const fields = compileInspectorFromCatalog('edit-view');
    expect(fields).toHaveLength(options.length);
    expect(fields.some((field) => field.key === 'mode')).toBe(true);
    expect(fields.some((field) => field.propPath === 'sidePanelPlacement')).toBe(true);
  });

  it('maps palette ids through the identity table', () => {
    expect(compileInspectorForPaletteItem('heroui.crud-set')?.length).toBe(
      compileInspectorFromCatalog('crud-set').length,
    );
    expect(compileInspectorForPaletteItem('heroui.record-form')?.length).toBe(
      compileInspectorFromCatalog('edit-view').length,
    );
    expect(getCompileComponentId('heroui.table')).toBe('grid');
    expect(getCompileComponentId('viz.chart-pie')).toBe('chart');
  });

  it('writes nested CrudSet spec paths without a parallel schema', () => {
    const props = {
      spec: '{"name":"Records","listApi":{"endpointId":"/api/x"},"listBody":"grid","pagination":true,"columns":[{"field":"id","label":"Id"}],"createApis":[],"patches":[]}',
    };
    const next = applyCatalogProp(props, { propPath: 'spec.listBody' }, 'kanban');
    expect(readCatalogProp(next, { propPath: 'spec.listBody' })).toBe('kanban');
    expect((next.spec as { listBody: string }).listBody).toBe('kanban');
  });

  it('surfaces compiled CRUD options in Properties instead of the raw spec JSON box', () => {
    const inserted = designerReducer(createInitialDesignerState(), {
      type: 'insert-palette-item',
      itemId: 'heroui.crud-set',
      parentId: createInitialDesignerState().document.rootNodeId,
    });
    const nodeId = inserted.document.nodes[inserted.document.rootNodeId].children[0]!;
    const sections = resolveInspectorFieldSections(inserted.document.nodes[nodeId]);
    const contentKeys = sections.find((section) => section.id === 'content')?.fields.map((field) => field.key) ?? [];
    const keys = sections.flatMap((section) => section.fields.map((field) => field.key));
    expect(contentKeys).toEqual(expect.arrayContaining([
      'crudSet.listBody',
      'crudSet.pagination',
      'crudSet.grid.chrome',
      'crudSet.filterBar',
      'crudSet.export',
    ]));
    expect(keys).not.toContain('spec');
  });

  it('applies composition paths onto the real CrudSetSpec shape', () => {
    const props = {
      spec: '{"name":"Records","listApi":{"endpointId":"/api/x"},"listBody":"grid","pagination":true,"columns":[{"field":"id","label":"Id"}],"createApis":[],"patches":[]}',
    };
    const withCreates = applyCatalogProp(props, { propPath: 'spec.createApis.length' }, 2);
    expect(readCatalogProp(withCreates, { propPath: 'spec.createApis.length' })).toBe(2);
    const withDelete = applyCatalogProp(withCreates, { propPath: 'spec.deleteApi' }, true);
    expect(readCatalogProp(withDelete, { propPath: 'spec.deleteApi' })).toBe(true);
  });
});

describe('designer catalog identity', () => {
  it('gives every compile / add-to-toolbox row a Base Components componentId', () => {
    const incomplete = DESIGNER_CATALOG_IDENTITY.filter((row) =>
      (row.kind === 'compile' || row.kind === 'add-to-toolbox') && !row.componentId,
    );
    expect(incomplete).toEqual([]);
  });

  it('marks merge losers as legacy of a surviving id', () => {
    const losers = DESIGNER_CATALOG_IDENTITY.filter((row) => row.kind === 'legacy');
    expect(losers.length).toBeGreaterThan(0);
    expect(losers.every((row) => Boolean(row.legacyOf))).toBe(true);
  });
});
