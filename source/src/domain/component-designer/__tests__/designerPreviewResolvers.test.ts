import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { buildPreviewDesignerStore, mergeDesignerRouteParamsIntoStore, resolveRepeaterPreviewItems } from '../designerPreviewResolvers';

describe('designerPreviewResolvers', () => {
  describe('buildPreviewDesignerStore', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        location: {
          search: '?id=123&mode=edit',
        },
        parent: {
          location: {
            search: '?id=123&mode=edit',
          },
        },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('extracts search params from URL and injects them under parameters namespaces', () => {
      const store = buildPreviewDesignerStore({});
      expect(store.urlParams).toEqual({ id: '123', mode: 'edit' });
      expect(store.query).toEqual({ id: '123', mode: 'edit' });
      expect(store.params).toEqual({ id: '123', mode: 'edit' });
      expect(store.routeParams).toEqual({ id: '123', mode: 'edit' });
    });

    it('path routeParams override URL search and always sync selection.id', () => {
      const store = buildPreviewDesignerStore({}, { id: '42', editSlug: 'studio/cms/contents/edit/42' });
      expect(store.routeParams).toEqual({
        id: '42',
        mode: 'edit',
        editSlug: 'studio/cms/contents/edit/42',
      });
      expect((store.selection as { id: string }).id).toBe('42');

      const withStaleSelection = {
        ...store,
        selection: { id: '1' },
        routeParams: { id: '1', mode: 'edit' },
      };
      const next = mergeDesignerRouteParamsIntoStore(withStaleSelection, { id: '99' });
      expect((next.routeParams as { id: string }).id).toBe('99');
      expect((next.selection as { id: string }).id).toBe('99');
    });
  });

  describe('resolveRepeaterPreviewItems', () => {
    it('resolves items from store path', () => {
      const designerStore = {
        users: [{ id: 10, name: 'John' }],
      };
      const items = resolveRepeaterPreviewItems('store.users', designerStore, {});
      expect(items).toEqual([{ id: 10, name: 'John' }]);
    });

    it('resolves items relative to nested repeater scope item when path starts with item.', () => {
      const scopeItem = {
        subItems: [{ id: 20, name: 'SubJohn' }],
      };
      const items = resolveRepeaterPreviewItems('item.subItems', {}, {}, scopeItem);
      expect(items).toEqual([{ id: 20, name: 'SubJohn' }]);
    });

    it('resolves items from dataContext by default', () => {
      const dataContext = {
        itemsList: [{ id: 30, name: 'ContextJohn' }],
      };
      const items = resolveRepeaterPreviewItems('itemsList', {}, dataContext);
      expect(items).toEqual([{ id: 30, name: 'ContextJohn' }]);
    });

    it('falls back to default preview items if source is empty or not an array', () => {
      const items = resolveRepeaterPreviewItems('nonexistent', {}, {});
      expect(items).toHaveLength(3);
      expect(items[0]).toEqual({ id: 1, label: 'Preview item 1' });
    });
  });
});
