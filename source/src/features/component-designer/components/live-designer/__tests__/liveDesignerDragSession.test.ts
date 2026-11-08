/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  acquireLiveDesignerDragSelectionLock,
  beginLiveDesignerExternalDrag,
  endLiveDesignerExternalDrag,
  getLiveDesignerExternalDrag,
  hasLiveDesignerExternalDragType,
  LIVE_DESIGNER_PALETTE_DRAG_MIME,
  releaseLiveDesignerDragSelectionLock,
} from '../liveDesignerDragSession';

afterEach(() => {
  endLiveDesignerExternalDrag();
  releaseLiveDesignerDragSelectionLock();
});

describe('liveDesignerDragSession', () => {
  it('stores and clears an external palette drag', () => {
    expect(getLiveDesignerExternalDrag()).toBeNull();
    beginLiveDesignerExternalDrag({ kind: 'palette', itemId: 'html.text', label: 'Text' });
    expect(getLiveDesignerExternalDrag()).toEqual({
      kind: 'palette',
      itemId: 'html.text',
      label: 'Text',
    });
    expect(hasLiveDesignerExternalDragType([LIVE_DESIGNER_PALETTE_DRAG_MIME])).toBe(true);
    endLiveDesignerExternalDrag();
    expect(getLiveDesignerExternalDrag()).toBeNull();
  });

  it('blocks document text selection while a palette drag is in progress', () => {
    beginLiveDesignerExternalDrag({ kind: 'palette', itemId: 'html.text', label: 'Text' });
    expect(document.body.style.getPropertyValue('user-select')).toBe('none');
    const blocked = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(blocked)).toBe(false);
    endLiveDesignerExternalDrag();
    expect(document.body.style.getPropertyValue('user-select')).toBe('');
    const allowed = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(allowed)).toBe(true);
  });

  it('keeps the selection lock until overlapping canvas and palette drags both end', () => {
    beginLiveDesignerExternalDrag({ kind: 'palette', itemId: 'html.text', label: 'Text' });
    acquireLiveDesignerDragSelectionLock();
    endLiveDesignerExternalDrag();
    expect(document.body.style.getPropertyValue('user-select')).toBe('none');
    const stillBlocked = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(stillBlocked)).toBe(false);
    releaseLiveDesignerDragSelectionLock();
    expect(document.body.style.getPropertyValue('user-select')).toBe('');
  });
});
