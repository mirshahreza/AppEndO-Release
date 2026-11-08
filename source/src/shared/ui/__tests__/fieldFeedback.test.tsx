/**
 * @vitest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FieldFeedbackShell,
  getFieldFeedbackClipRect,
  isFieldFeedbackClippingOverflow,
  measureFieldFeedbackOverlaySpace,
  resolveFieldFeedbackOverlaySide,
} from '../fieldFeedback';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rect = (top: number, height: number, left = 0, width = 200): DOMRect => ({
  x: left,
  y: top,
  left,
  top,
  right: left + width,
  bottom: top + height,
  width,
  height,
  toJSON: () => ({}),
});

describe('resolveFieldFeedbackOverlaySide', () => {
  it('prefers above when the balloon fits', () => {
    expect(resolveFieldFeedbackOverlaySide({
      availableAbove: 80,
      availableBelow: 40,
      overlayHeight: 36,
    })).toBe('above');
  });

  it('flips below when there is not enough room above', () => {
    expect(resolveFieldFeedbackOverlaySide({
      availableAbove: 10,
      availableBelow: 200,
      overlayHeight: 36,
    })).toBe('below');
  });

  it('picks the side with more room when neither side fits', () => {
    expect(resolveFieldFeedbackOverlaySide({
      availableAbove: 8,
      availableBelow: 20,
      overlayHeight: 36,
    })).toBe('below');
    expect(resolveFieldFeedbackOverlaySide({
      availableAbove: 24,
      availableBelow: 10,
      overlayHeight: 36,
    })).toBe('above');
  });
});

describe('measureFieldFeedbackOverlaySpace', () => {
  it('subtracts gap and margin from the clip edges', () => {
    expect(measureFieldFeedbackOverlaySpace(
      { top: 100, bottom: 132 },
      { top: 0, bottom: 400 },
    )).toEqual({
      availableAbove: 86,
      availableBelow: 254,
    });
  });
});

describe('isFieldFeedbackClippingOverflow', () => {
  it('treats scroll and hidden ancestors as clipping', () => {
    expect(isFieldFeedbackClippingOverflow('auto')).toBe(true);
    expect(isFieldFeedbackClippingOverflow('hidden')).toBe(true);
    expect(isFieldFeedbackClippingOverflow('visible')).toBe(false);
  });
});

describe('getFieldFeedbackClipRect', () => {
  it('intersects the viewport with an overflow-clipping ancestor', () => {
    const clipper = document.createElement('div');
    const host = document.createElement('div');
    clipper.appendChild(host);
    document.body.appendChild(clipper);

    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === clipper) {
        return { overflowY: 'auto', overflow: 'auto' } as CSSStyleDeclaration;
      }
      return { overflowY: 'visible', overflow: 'visible' } as CSSStyleDeclaration;
    });
    vi.spyOn(clipper, 'getBoundingClientRect').mockReturnValue(rect(40, 200));

    expect(getFieldFeedbackClipRect(host, 800)).toEqual({ top: 40, bottom: 240 });

    clipper.remove();
  });
});

describe('FieldFeedbackShell overlay balloon', () => {
  const mockOverlayLayout = ({
    controlTop,
    controlHeight = 32,
    overlayHeight = 36,
    viewportHeight = 800,
  }: {
    controlTop: number;
    controlHeight?: number;
    overlayHeight?: number;
    viewportHeight?: number;
  }) => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewportHeight });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: viewportHeight });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      if (this.getAttribute('role') === 'alert') {
        return rect(0, overlayHeight);
      }
      if (this.getAttribute('data-field-feedback-host') === 'true') {
        return rect(controlTop, controlHeight);
      }
      return rect(0, viewportHeight);
    });
  };

  it('keeps the balloon above when there is room', () => {
    mockOverlayLayout({ controlTop: 200 });
    render(
      <FieldFeedbackShell isInvalid errorMessage="Name is required." placement="overlay">
        <input aria-label="Name" />
      </FieldFeedbackShell>,
    );

    const balloon = screen.getByRole('alert');
    expect(balloon).toHaveAttribute('data-side', 'above');
    expect(balloon.className).toContain('bottom-[calc(100%+6px)]');
  });

  it('opens the balloon below when there is not enough room above', () => {
    mockOverlayLayout({ controlTop: 20 });
    render(
      <FieldFeedbackShell isInvalid errorMessage="Name is required." placement="overlay">
        <input aria-label="Name" />
      </FieldFeedbackShell>,
    );

    const balloon = screen.getByRole('alert');
    expect(balloon).toHaveAttribute('data-side', 'below');
    expect(balloon.className).toContain('top-[calc(100%+6px)]');
  });
});
