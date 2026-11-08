import { describe, expect, it } from 'vitest';
import { buildEuaFieldMapFromDocument, isPublishedFormAssistEnabled } from '../buildEuaFieldMapFromDocument';
import type { DesignerDocument } from '../../../../domain/component-designer/types';

const buildListWithModalFormDocument = (): DesignerDocument => ({
  schemaVersion: '1.0.0',
  id: 'list-with-modal',
  name: 'list-with-modal',
  rootNodeId: 'root',
  nodes: {
    root: {
      id: 'root',
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: ['grid', 'create-modal'],
    },
    grid: {
      id: 'grid',
      type: 'container',
      parentId: 'root',
      order: 0,
      props: { _designerPaletteItemId: 'heroui.app-table-grid' },
      layout: {},
      binding: {},
      children: [],
    },
    'create-modal': {
      id: 'create-modal',
      type: 'container',
      parentId: 'root',
      order: 1,
      props: {
        title: 'Create',
        _designerPaletteItemId: 'heroui.modal',
      },
      layout: {},
      binding: {},
      children: ['form'],
    },
    form: {
      id: 'form',
      type: 'container',
      parentId: 'create-modal',
      order: 0,
      props: { _designerPaletteItemId: 'html.form' },
      layout: {},
      binding: {},
      children: ['title-field'],
    },
    'title-field': {
      id: 'title-field',
      type: 'container',
      parentId: 'form',
      order: 0,
      props: {
        label: 'Title',
        _designerPaletteItemId: 'heroui.input-text',
      },
      layout: {},
      binding: {},
      children: [],
    },
  },
});

describe('buildEuaFieldMapFromDocument', () => {
  it('excludes fields nested inside modal shells from the published page toolbar map', () => {
    const entries = buildEuaFieldMapFromDocument(buildListWithModalFormDocument(), {});
    expect(entries).toEqual([]);
  });

  it('includes visible page-level form fields', () => {
    const document = buildListWithModalFormDocument();
    document.nodes['page-field'] = {
      id: 'page-field',
      type: 'container',
      parentId: 'root',
      order: 2,
      props: {
        label: 'Search note',
        _designerPaletteItemId: 'heroui.input-text',
      },
      layout: {},
      binding: {},
      children: [],
    };
    document.nodes.root.children.push('page-field');

    const entries = buildEuaFieldMapFromDocument(document, {});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.label).toBe('Search note');
  });

  it('respects root publishedFormAssist=false', () => {
    const document = buildListWithModalFormDocument();
    document.nodes.root.props = { publishedFormAssist: false };
    document.nodes['page-field'] = {
      id: 'page-field',
      type: 'container',
      parentId: 'root',
      order: 2,
      props: {
        label: 'Search note',
        _designerPaletteItemId: 'heroui.input-text',
      },
      layout: {},
      binding: {},
      children: [],
    };
    document.nodes.root.children.push('page-field');

    expect(isPublishedFormAssistEnabled(document)).toBe(false);
    expect(buildEuaFieldMapFromDocument(document, {})).toHaveLength(1);
  });
});
