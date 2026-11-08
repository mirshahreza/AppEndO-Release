import { describe, expect, it } from 'vitest';
import { resolveCatalogInspectorGroup } from '../catalogInspectorGroups';

describe('resolveCatalogInspectorGroup', () => {
  it('keeps composite families on their dedicated sections', () => {
    expect(resolveCatalogInspectorGroup('crudSet.listApi')).toBe('APIs');
    expect(resolveCatalogInspectorGroup('crudSet.paging.pageSize')).toBe('Paging');
    expect(resolveCatalogInspectorGroup('crudSet.grid.chrome')).toBe('Body');
    expect(resolveCatalogInspectorGroup('editView.sidePanelPlacement')).toBe('Side panel');
    expect(resolveCatalogInspectorGroup('editView.formSize')).toBe('Form');
  });

  it('puts shared size, height, and width in Layout across components', () => {
    expect(resolveCatalogInspectorGroup('dialog.size')).toBe('Layout');
    expect(resolveCatalogInspectorGroup('avatar.size')).toBe('Layout');
    expect(resolveCatalogInspectorGroup('chip.size')).toBe('Layout');
    expect(resolveCatalogInspectorGroup('chart.height')).toBe('Layout');
    expect(resolveCatalogInspectorGroup('flexRow.height')).toBe('Layout');
    expect(resolveCatalogInspectorGroup('wrapper.width')).toBe('Layout');
    expect(resolveCatalogInspectorGroup('componentLayout.heightMode')).toBe('Layout');
  });

  it('puts shared appearance and state tokens in the same groups', () => {
    expect(resolveCatalogInspectorGroup('chip.variant')).toBe('Appearance');
    expect(resolveCatalogInspectorGroup('chip.tone')).toBe('Appearance');
    expect(resolveCatalogInspectorGroup('surfaceBox.tone')).toBe('Appearance');
    expect(resolveCatalogInspectorGroup('calendarGrid.disabled')).toBe('State');
    expect(resolveCatalogInspectorGroup('sortableList.disabled')).toBe('State');
    expect(resolveCatalogInspectorGroup('buttons.state', undefined, 'state')).toBe('State');
  });

  it('falls back to the catalog axis title when the leaf is not a shared token', () => {
    expect(resolveCatalogInspectorGroup('gantt.allowTaskDrag', undefined, 'behavior')).toBe('Behavior');
    expect(resolveCatalogInspectorGroup('plainText.text', undefined, 'content')).toBe('Content');
  });

  it('honors an explicit inspector group', () => {
    expect(resolveCatalogInspectorGroup('chart.height', 'Chart')).toBe('Chart');
  });
});
