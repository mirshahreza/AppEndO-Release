/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyPersistedDesignerStoreSegments,
  buildDesignerStorePersistStorageKey,
  DESIGNER_ALWAYS_LOCAL_STORE_SEGMENTS,
  persistDesignerStoreSegments,
  resolveDesignerStoreDocumentKey,
  resolveDesignerStoreSegmentPersistMode,
} from '../bindingStorePersistence';
import type { DesignerBindingDefinitions } from '../types';

describe('bindingStorePersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('always persists gridToolbar to localStorage even without an explicit segment', () => {
    expect(DESIGNER_ALWAYS_LOCAL_STORE_SEGMENTS.has('gridToolbar')).toBe(true);
    expect(resolveDesignerStoreSegmentPersistMode('gridToolbar')).toBe('local');
    expect(resolveDesignerStoreSegmentPersistMode('selection')).toBe('none');
    expect(resolveDesignerStoreSegmentPersistMode('selection', {
      id: 'selection',
      persist: 'session',
    })).toBe('session');
  });

  it('round-trips multi-select filter selections via localStorage', () => {
    const bindingDefinitions = {
      definitions: {},
      dataSources: {},
      lovs: {},
      storeSegments: {},
    } satisfies DesignerBindingDefinitions;

    const documentKey = 'cms-contents-list';
    persistDesignerStoreSegments({
      gridToolbar: {
        search: 'hello',
        filters: {
          contentTypeCode: '102.001.001,102.001.002',
          statusCode: '102.002.003',
          languageCode: '',
        },
      },
    }, bindingDefinitions, documentKey);

    expect(window.localStorage.getItem(
      buildDesignerStorePersistStorageKey(documentKey, 'gridToolbar'),
    )).toContain('102.001.001,102.001.002');

    const restored = applyPersistedDesignerStoreSegments(
      { gridToolbar: { search: '', filters: {} } },
      bindingDefinitions,
      documentKey,
    );

    expect(restored.gridToolbar).toEqual({
      search: 'hello',
      filters: {
        contentTypeCode: '102.001.001,102.001.002',
        statusCode: '102.002.003',
        languageCode: '',
      },
    });
  });

  it('uses document name as the persistence key', () => {
    expect(resolveDesignerStoreDocumentKey({
      id: 'draft-cms-contents-list',
      name: 'cms-contents-list',
    })).toBe('cms-contents-list');
  });
});
