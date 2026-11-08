import { describe, expect, it } from 'vitest';
import { isDesignerViewDirty, normalizeDesignerViewport, parseDesignerView, serializeDesignerView } from '../lib/designerViewState';

describe('designerViewState', () => {
  it('round-trips node positions and viewport', () => {
    const view = {
      nodePositions: { 'node-1': { x: 10, y: 20 } },
      viewport: { x: -120, y: 45, zoom: 0.85 },
    };
    expect(parseDesignerView(serializeDesignerView(view))).toEqual(view);
  });

  it('ignores invalid viewport values', () => {
    expect(normalizeDesignerViewport({ x: 1, y: 2, zoom: 0 })).toBeUndefined();
    expect(parseDesignerView(JSON.stringify({ nodePositions: {}, viewport: { x: 'bad' } }))).toEqual({ nodePositions: {} });
  });

  it('treats invalid persisted viewport as clean after canonical load', () => {
    const savedViewJson = JSON.stringify({ nodePositions: {}, viewport: { x: 0, y: 0, zoom: 0 } });
    const loadedView = parseDesignerView(savedViewJson);
    expect(isDesignerViewDirty(loadedView, savedViewJson)).toBe(false);
  });

  it('detects real designer-view edits', () => {
    const savedViewJson = serializeDesignerView({ nodePositions: { 'node-1': { x: 1, y: 2 } } });
    const editedView = parseDesignerView(savedViewJson);
    editedView.nodePositions['node-1'] = { x: 3, y: 2 };
    expect(isDesignerViewDirty(editedView, savedViewJson)).toBe(true);
  });
});
