// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import {
  canPersistDesignerViewportPrefs,
  getDesignerViewportStorageKey,
  normalizeDesignerViewport,
  readDesignerViewportPrefs,
  resolveDesignerViewportForComponent,
  writeDesignerViewportPrefs,
} from '../designerViewportPrefs';

describe('designerViewportPrefs', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('normalizes valid viewport payloads', () => {
    expect(normalizeDesignerViewport({
      preset: 'custom',
      width: 900,
      height: 640,
      fillMode: 'manual',
    })).toEqual({
      preset: 'custom',
      width: 900,
      height: 640,
      fillMode: 'manual',
    });
  });

  it('rejects invalid viewport payloads', () => {
    expect(normalizeDesignerViewport({ preset: 'desktop', width: 'bad' })).toBeNull();
  });

  it('reads and writes viewport prefs per component name', () => {
    const viewport = {
      preset: 'tablet' as const,
      width: 834,
      height: 1112,
      fillMode: 'fill-width' as const,
    };

    writeDesignerViewportPrefs('orders-grid', viewport);
    expect(window.localStorage.getItem(getDesignerViewportStorageKey('orders-grid'))).toBeTruthy();
    expect(readDesignerViewportPrefs('orders-grid')).toEqual(viewport);
    expect(readDesignerViewportPrefs('general/orders-grid')).toEqual(viewport);
  });

  it('prefers localStorage over persisted draft viewport', () => {
    writeDesignerViewportPrefs('orders-grid', {
      preset: 'mobile',
      width: 390,
      height: 844,
      fillMode: 'manual',
    });

    const resolved = resolveDesignerViewportForComponent('orders-grid', {
      preset: 'custom',
      width: 1024,
      height: 768,
      fillMode: 'manual',
    });

    expect(resolved).toEqual({
      preset: 'mobile',
      width: 390,
      height: 844,
      fillMode: 'manual',
    });
  });

  it('falls back to persisted draft viewport when localStorage is empty', () => {
    const persisted = {
      preset: 'desktop' as const,
      width: 1280,
      height: 800,
      fillMode: 'manual' as const,
    };

    expect(resolveDesignerViewportForComponent('orders-grid', persisted)).toEqual(persisted);
  });

  it('skips placeholder editor names', () => {
    expect(canPersistDesignerViewportPrefs('live-designer')).toBe(false);
    expect(canPersistDesignerViewportPrefs('')).toBe(false);
    writeDesignerViewportPrefs('live-designer', {
      preset: 'desktop',
      width: 1280,
      height: 800,
      fillMode: 'manual',
    });
    expect(window.localStorage.getItem(getDesignerViewportStorageKey('live-designer'))).toBeNull();
  });
});
