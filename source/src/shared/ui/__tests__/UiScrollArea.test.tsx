/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  applyUiScrollAreaDrag,
  applyUiScrollAreaStep,
  lockUiScrollAreaTextSelection,
  uiScrollAreaTargetAllowsPan,
  clampUiScrollAreaNudgeIconSize,
  resolveUiScrollAreaBarPhysicalSide,
  resolveUiScrollAreaBarViewportDir,
  resolveUiScrollAreaContentDir,
  resolveUiScrollAreaNudgeChrome,
  resolveUiScrollAreaNudgeEdgeVisibility,
  resolveUiScrollAreaNudgeIconStroke,
  resolveUiScrollAreaNudgeState,
  resolveUiScrollAreaViewportClass,
  UiScrollArea,
} from '../UiScrollArea';

afterEach(() => {
  cleanup();
  document.body.style.removeProperty('user-select');
  document.body.style.removeProperty('-webkit-user-select');
});

function mockViewport(
  node: HTMLElement,
  { scrollSize = 800, clientSize = 200, offset = 0 } = {},
) {
  Object.defineProperty(node, 'scrollHeight', { configurable: true, value: scrollSize });
  Object.defineProperty(node, 'clientHeight', { configurable: true, value: clientSize });
  Object.defineProperty(node, 'scrollWidth', { configurable: true, value: scrollSize });
  Object.defineProperty(node, 'clientWidth', { configurable: true, value: clientSize });
  node.scrollTop = offset;
  node.scrollLeft = offset;
}

describe('UiScrollArea helpers', () => {
  it('clamps steps and drag offsets to the scroll range', () => {
    expect(applyUiScrollAreaStep(0, 1, 72, 400)).toBe(72);
    expect(applyUiScrollAreaStep(380, 1, 72, 400)).toBe(400);
    expect(applyUiScrollAreaStep(40, -1, 72, 400)).toBe(0);
    expect(applyUiScrollAreaDrag(120, 30, 400)).toBe(90);
    expect(applyUiScrollAreaDrag(10, 40, 400)).toBe(0);
    expect(uiScrollAreaTargetAllowsPan(null)).toBe(true);
  });

  it('keeps grab-to-pan off buttons, sliders, and links', () => {
    document.body.innerHTML = '<p id="copy">note</p><button id="look" type="button">Look</button><input id="size" type="range"><a id="nav" href="#x">Nav</a>';
    expect(uiScrollAreaTargetAllowsPan(document.getElementById('copy'))).toBe(true);
    expect(uiScrollAreaTargetAllowsPan(document.getElementById('look'))).toBe(false);
    expect(uiScrollAreaTargetAllowsPan(document.getElementById('size'))).toBe(false);
    expect(uiScrollAreaTargetAllowsPan(document.getElementById('nav'))).toBe(false);
    document.body.innerHTML = '';
  });

  it('locks and restores document text selection', () => {
    const unlock = lockUiScrollAreaTextSelection();
    expect(document.body.style.getPropertyValue('user-select')).toBe('none');
    const blocked = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(blocked)).toBe(false);
    unlock();
    expect(document.body.style.getPropertyValue('user-select')).toBe('');
    const allowed = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(allowed)).toBe(true);
  });

  it('resolves occupy vs overlay chrome, pointer reveal, and overlay opacity', () => {
    expect(resolveUiScrollAreaNudgeChrome({})).toMatchObject({
      occupy: true,
      overlay: false,
      showBand: true,
      visible: true,
      opacity: 1,
    });
    expect(resolveUiScrollAreaNudgeChrome({
      reveal: 'pointer',
      placement: 'overlay',
      slot: 'icons',
      opacity: 0.35,
      pointerActive: false,
    })).toMatchObject({
      occupy: false,
      overlay: true,
      showBand: false,
      visible: false,
      opacity: 0,
    });
    expect(resolveUiScrollAreaNudgeChrome({
      reveal: 'pointer',
      placement: 'overlay',
      opacity: 0.35,
      pointerActive: true,
    })).toMatchObject({
      visible: true,
      opacity: 0.35,
    });
  });

  it('exposes nudge enablement and hides the native thumb on hidden and nudge', () => {
    expect(resolveUiScrollAreaNudgeState(0, 400)).toEqual({ canDecrease: false, canIncrease: true });
    expect(resolveUiScrollAreaNudgeState(400, 400)).toEqual({ canDecrease: true, canIncrease: false });
    expect(resolveUiScrollAreaNudgeEdgeVisibility(true, false, true)).toEqual({
      showDecrease: false,
      showIncrease: true,
    });
    expect(resolveUiScrollAreaNudgeEdgeVisibility(false, true, true)).toEqual({
      showDecrease: false,
      showIncrease: false,
    });
    expect(resolveUiScrollAreaViewportClass('nudge', 'vertical')).toContain('ui-scroll-area-hide-thumb');
    expect(resolveUiScrollAreaViewportClass('hidden', 'vertical')).toContain('ui-scroll-area-hide-thumb');
    expect(resolveUiScrollAreaViewportClass('bar', 'vertical')).not.toContain('ui-scroll-area-hide-thumb');
  });

  it('places the standard thumb on the left, right, or trailing edge of direction', () => {
    expect(resolveUiScrollAreaBarPhysicalSide('direction', 'ltr')).toBe('right');
    expect(resolveUiScrollAreaBarPhysicalSide('direction', 'rtl')).toBe('left');
    expect(resolveUiScrollAreaBarPhysicalSide('left', 'ltr')).toBe('left');
    expect(resolveUiScrollAreaBarPhysicalSide('right', 'rtl')).toBe('right');
    expect(resolveUiScrollAreaBarViewportDir('left', 'ltr')).toBe('rtl');
    expect(resolveUiScrollAreaBarViewportDir('right', 'rtl')).toBe('ltr');
    expect(resolveUiScrollAreaBarViewportDir('direction', 'ltr')).toBe('ltr');
    expect(resolveUiScrollAreaBarViewportDir('direction', 'rtl')).toBe('rtl');
    expect(resolveUiScrollAreaContentDir('rtl')).toBe('rtl');
    const previous = document.documentElement.dir;
    document.documentElement.dir = 'rtl';
    expect(resolveUiScrollAreaContentDir()).toBe('rtl');
    document.documentElement.dir = previous;
  });

  it('clamps the without-bar caret size to 6–18px', () => {
    expect(clampUiScrollAreaNudgeIconSize(10)).toBe(10);
    expect(clampUiScrollAreaNudgeIconSize(3)).toBe(6);
    expect(clampUiScrollAreaNudgeIconSize(40)).toBe(18);
    expect(resolveUiScrollAreaNudgeIconStroke(18)).toBeGreaterThan(resolveUiScrollAreaNudgeIconStroke(6));
  });
});

describe('UiScrollArea', () => {
  it('keeps the bar model free of nudge marks', () => {
    render(
      <UiScrollArea variant="bar" className="h-40">
        <p>Release notes</p>
      </UiScrollArea>,
    );
    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();
    expect(document.querySelector('[data-variant="bar"]')).not.toBeNull();
    expect(screen.getByLabelText('Scrollable region')).not.toHaveAttribute('data-hide-thumb');
    expect(screen.getByLabelText('Scrollable region')).not.toHaveClass('ui-scroll-area-hide-thumb');
  });

  it('forces the native thumb to the left without mirroring content', () => {
    const { container } = render(
      <UiScrollArea variant="bar" barSide="left" dir="ltr" className="h-40">
        <p>Pinned left thumb</p>
      </UiScrollArea>,
    );
    const host = container.querySelector('[data-ui-scroll-area]');
    const viewport = screen.getByLabelText('Scrollable region');
    expect(host).toHaveAttribute('data-bar-side', 'left');
    expect(host).toHaveAttribute('data-bar-edge', 'left');
    expect(host).toHaveAttribute('dir', 'ltr');
    expect(viewport).toHaveAttribute('dir', 'rtl');
    expect(viewport.querySelector('[dir="ltr"]')).toHaveTextContent('Pinned left thumb');
  });

  it('follows writing direction for the default thumb edge', () => {
    const { container } = render(
      <UiScrollArea variant="bar" barSide="direction" dir="rtl" className="h-40">
        <p>Trailing edge</p>
      </UiScrollArea>,
    );
    const host = container.querySelector('[data-ui-scroll-area]');
    const viewport = screen.getByLabelText('Scrollable region');
    expect(host).toHaveAttribute('data-bar-side', 'direction');
    expect(host).toHaveAttribute('data-bar-edge', 'left');
    expect(host).toHaveAttribute('dir', 'rtl');
    expect(viewport).not.toHaveAttribute('dir');
  });

  it('hides the standard thumb without end marks', () => {
    render(
      <UiScrollArea variant="hidden" className="h-40">
        <p>Quiet overflow</p>
      </UiScrollArea>,
    );
    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();
    expect(document.querySelector('[data-variant="hidden"]')).not.toBeNull();
    expect(screen.getByLabelText('Scrollable region')).toHaveAttribute('data-hide-thumb');
    expect(screen.getByLabelText('Scrollable region')).toHaveClass('ui-scroll-area-hide-thumb');
  });

  it('hides without-bar marks and their slots until that direction can scroll', () => {
    const { container } = render(
      <UiScrollArea variant="nudge" className="h-40">
        <p>Long release log</p>
      </UiScrollArea>,
    );
    const viewport = screen.getByLabelText('Scrollable region');
    mockViewport(viewport, { offset: 0 });
    fireEvent.scroll(viewport);

    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(container.querySelector('[data-ui-scroll-nudge-slot="decrease"]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Scroll down' })).toBeEnabled();

    mockViewport(viewport, { offset: 600 });
    fireEvent.scroll(viewport);
    expect(screen.getByRole('button', { name: 'Scroll up' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();
    expect(container.querySelector('[data-ui-scroll-nudge-slot="increase"]')).toBeNull();
  });

  it('steps with the nudge marks and pans when the canvas is dragged', () => {
    const { container } = render(
      <UiScrollArea variant="nudge" className="h-40">
        <p>Long release log</p>
      </UiScrollArea>,
    );
    const viewport = screen.getByLabelText('Scrollable region');
    mockViewport(viewport, { offset: 80 });
    fireEvent.scroll(viewport);

    expect(screen.getByRole('button', { name: 'Scroll up' })).toBeEnabled();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Scroll down' }), { button: 0 });
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Scroll down' }));
    expect(viewport.scrollTop).toBe(152);

    fireEvent.pointerDown(viewport, { button: 0, pointerId: 1, clientY: 180 });
    fireEvent.pointerMove(viewport, { pointerId: 1, clientY: 120 });
    expect(viewport.scrollTop).toBe(212);
    expect(viewport).toHaveAttribute('data-dragging');
    expect(document.body.style.getPropertyValue('user-select')).toBe('none');
    fireEvent.pointerUp(viewport, { pointerId: 1 });
    expect(viewport).not.toHaveAttribute('data-dragging');
    expect(document.body.style.getPropertyValue('user-select')).toBe('');
    expect(container.querySelector('[data-ui-scroll-nudge-slot="decrease"]')).not.toBeNull();
    expect(container.querySelector('[data-ui-scroll-nudge-slot="increase"]')).not.toBeNull();
    expect(viewport).toHaveAttribute('data-hide-thumb');
    expect(viewport).toHaveClass('ui-scroll-area-hide-thumb');
  });

  it('does not capture pointer when a control inside the canvas is pressed', () => {
    render(
      <UiScrollArea variant="nudge" className="h-40">
        <button type="button">Look</button>
        <input aria-label="Size" type="range" min={1} max={10} />
      </UiScrollArea>,
    );
    const viewport = screen.getByLabelText('Scrollable region');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Look' }), { button: 0, pointerId: 3 });
    expect(viewport).not.toHaveAttribute('data-dragging');
    fireEvent.pointerDown(screen.getByLabelText('Size'), { button: 0, pointerId: 4 });
    expect(viewport).not.toHaveAttribute('data-dragging');
  });

  it('blocks text selection for the drag gesture and restores it on release', () => {
    render(
      <UiScrollArea variant="nudge" className="h-40">
        <p>Selectable copy</p>
      </UiScrollArea>,
    );
    const viewport = screen.getByLabelText('Scrollable region');
    fireEvent.pointerDown(viewport, { button: 0, pointerId: 7, clientY: 40 });
    const selectStart = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(selectStart)).toBe(false);
    fireEvent.pointerUp(viewport, { pointerId: 7 });
    const afterRelease = new Event('selectstart', { cancelable: true });
    expect(document.dispatchEvent(afterRelease)).toBe(true);
  });

  it('overlays end marks while the pointer stays over the host', () => {
    const { container } = render(
      <UiScrollArea
        variant="nudge"
        className="h-40"
        nudgePlacement="overlay"
        nudgeReveal="pointer"
        nudgeSlot="icons"
        nudgeOpacity={0.55}
      >
        <p>Overlay marks</p>
      </UiScrollArea>,
    );
    const host = container.querySelector('[data-ui-scroll-area]');
    const viewport = screen.getByLabelText('Scrollable region');
    mockViewport(viewport, { offset: 0 });
    fireEvent.scroll(viewport);
    expect(host).toHaveAttribute('data-nudge-placement', 'overlay');
    expect(host).toHaveAttribute('data-nudge-slot', 'icons');
    expect(host).not.toHaveAttribute('data-nudge-visible');
    expect(container.querySelector('[data-nudge-band]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();

    fireEvent.pointerEnter(host!);
    expect(host).toHaveAttribute('data-nudge-visible');
    expect(screen.queryByRole('button', { name: 'Scroll up' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Scroll down' })).toBeEnabled();
    expect(container.querySelector('[data-ui-scroll-nudge-slot="increase"]')).toHaveClass('absolute');
    expect(container.querySelector('[data-ui-scroll-nudge-slot="increase"]')).toHaveClass('justify-center');

    fireEvent.pointerLeave(host!);
    expect(host).not.toHaveAttribute('data-nudge-visible');
    expect(screen.queryByRole('button', { name: 'Scroll down' })).toBeNull();
  });

  it('sizes the without-bar carets from the icon size option', () => {
    const { container } = render(
      <UiScrollArea variant="nudge" nudgeIconSize={8} className="h-40">
        <p>Small marks</p>
      </UiScrollArea>,
    );
    const host = container.querySelector('[data-ui-scroll-area]');
    const viewport = screen.getByLabelText('Scrollable region');
    mockViewport(viewport, { offset: 80 });
    fireEvent.scroll(viewport);
    const caret = container.querySelector('[data-ui-scroll-nudge="decrease"] svg');
    expect(host).toHaveAttribute('data-nudge-icon-size', '8');
    expect(caret).toHaveAttribute('width', '8');
    expect(caret).toHaveAttribute('height', '8');
  });

  it('renders without-bar marks as a bare icon or a square/circle button', () => {
    const { container, rerender } = render(
      <UiScrollArea variant="nudge" className="h-40">
        <p>Mark chrome</p>
      </UiScrollArea>,
    );
    const viewport = screen.getByLabelText('Scrollable region');
    mockViewport(viewport, { offset: 80 });
    fireEvent.scroll(viewport);
    const host = container.querySelector('[data-ui-scroll-area]');
    const mark = container.querySelector('[data-ui-scroll-nudge="decrease"]');
    expect(host).toHaveAttribute('data-nudge-mark', 'icon');
    expect(host).not.toHaveAttribute('data-nudge-shape');
    expect(mark).toHaveAttribute('data-nudge-mark', 'icon');

    rerender(
      <UiScrollArea variant="nudge" nudgeMark="button" nudgeMarkShape="square" className="h-40">
        <p>Mark chrome</p>
      </UiScrollArea>,
    );
    mockViewport(screen.getByLabelText('Scrollable region'), { offset: 80 });
    fireEvent.scroll(screen.getByLabelText('Scrollable region'));
    const buttonHost = container.querySelector('[data-ui-scroll-area]');
    const button = container.querySelector('[data-ui-scroll-nudge="decrease"]');
    expect(buttonHost).toHaveAttribute('data-nudge-mark', 'button');
    expect(buttonHost).toHaveAttribute('data-nudge-shape', 'square');
    expect(button).toHaveAttribute('data-nudge-shape', 'square');
  });
});
