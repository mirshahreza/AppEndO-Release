import { describe, expect, it } from 'vitest';
import {
  overlayMotionBackdropProps,
  overlayMotionPanelProps,
  overlayOriginFromPopoverPlacement,
} from '../overlayMotion';

describe('overlayMotion', () => {
  it('maps popover placement to the edge that stays against the trigger', () => {
    expect(overlayOriginFromPopoverPlacement('bottom-start')).toBe('top-start');
    expect(overlayOriginFromPopoverPlacement('bottom-end')).toBe('top-end');
    expect(overlayOriginFromPopoverPlacement('top-start')).toBe('bottom-start');
    expect(overlayOriginFromPopoverPlacement('top-end')).toBe('bottom-end');
  });

  it('builds drawer toggle props from the start edge', () => {
    const props = overlayMotionPanelProps({
      kind: 'drawer',
      origin: 'start',
      open: false,
      dir: 'rtl',
    });

    expect(props.className).toContain('overlay-motion-panel');
    expect(props.className).not.toContain('overlay-motion-enter');
    expect(props['data-overlay-kind']).toBe('drawer');
    expect(props['data-overlay-origin']).toBe('start');
    expect(props['data-overlay-open']).toBe('false');
    expect(props['data-overlay-dir']).toBe('rtl');
  });

  it('uses enter-on-mount for flyouts and popovers', () => {
    const flyout = overlayMotionPanelProps({ kind: 'flyout', origin: 'start', dir: 'ltr' });
    expect(flyout.className).toContain('overlay-motion-enter');
    expect(flyout['data-overlay-open']).toBeUndefined();
  });

  it('keeps a closed backdrop from intercepting clicks', () => {
    const closed = overlayMotionBackdropProps({ open: false });
    expect(closed.className).toContain('overlay-motion-backdrop');
    expect(closed['data-overlay-open']).toBe('false');
  });
});
