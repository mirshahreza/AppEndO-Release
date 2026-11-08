import { describe, expect, it } from 'vitest';
import {
  overlayOriginFromFixedMenuStyle,
  resolveFixedOverlayMenuStyle,
} from '../AppSplitButton';

const viewport = { width: 1024, height: 768 };

describe('resolveFixedOverlayMenuStyle', () => {
  it('keeps start-aligned dropdowns when flip is off', () => {
    const style = resolveFixedOverlayMenuStyle({
      anchor: { top: 40, right: 1004, bottom: 64, left: 980, width: 24, height: 24 },
      viewport,
      align: 'start',
      minWidth: 192,
    });

    expect(style.left).toBe(980);
    expect(style.right).toBeUndefined();
    expect(style.top).toBe(70);
  });

  it('flips last-column start menus to the start of the viewport', () => {
    const style = resolveFixedOverlayMenuStyle({
      anchor: { top: 40, right: 1004, bottom: 64, left: 980, width: 24, height: 24 },
      viewport,
      align: 'start',
      minWidth: 192,
      panelWidth: 192,
      panelHeight: 140,
      flip: true,
    });

    expect(style.right).toBe(20);
    expect(style.left).toBeUndefined();
    expect(style.top).toBe(70);
    expect(overlayOriginFromFixedMenuStyle(style)).toBe('top-end');
  });

  it('keeps start alignment when there is room toward the end', () => {
    const style = resolveFixedOverlayMenuStyle({
      anchor: { top: 40, right: 48, bottom: 64, left: 24, width: 24, height: 24 },
      viewport,
      align: 'start',
      minWidth: 192,
      panelWidth: 192,
      panelHeight: 140,
      flip: true,
    });

    expect(style.left).toBe(24);
    expect(style.right).toBeUndefined();
  });

  it('opens above when there is more room above than below', () => {
    const style = resolveFixedOverlayMenuStyle({
      anchor: { top: 720, right: 48, bottom: 744, left: 24, width: 24, height: 24 },
      viewport,
      align: 'start',
      minWidth: 192,
      panelWidth: 192,
      panelHeight: 140,
      flip: true,
    });

    expect(style.bottom).toBe(54);
    expect(style.top).toBeUndefined();
    expect(overlayOriginFromFixedMenuStyle(style)).toBe('bottom-start');
  });
});
