/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { BaseComponentsConfigToolbarControls, BaseComponentsResetButton } from '../BaseComponentsConfigDialog';
import {
  BaseComponentsPreviewViewportHost,
  BaseComponentsPreviewViewportProvider,
  clampPreviewCustomSize,
  resolveBaseComponentsPreviewFrameClass,
  resolvePreviewFrameSize,
  resolvePreviewViewportTier,
  BASE_COMPONENTS_PREVIEW_PRESET_SIZE,
} from '../BaseComponentsPreviewViewport';

afterEach(cleanup);

describe('preview viewport helpers', () => {
  it('constrains phone and tablet preview widths', () => {
    expect(resolveBaseComponentsPreviewFrameClass('phone')).toContain('max-w-[390px]');
    expect(resolveBaseComponentsPreviewFrameClass('tablet')).toContain('max-w-[760px]');
    expect(resolveBaseComponentsPreviewFrameClass('desktop')).not.toContain('max-w-');
  });

  it('maps responsive widths onto viewport tiers', () => {
    expect(resolvePreviewViewportTier('phone', 1200)).toBe('phone');
    expect(resolvePreviewViewportTier('responsive', 360)).toBe('phone');
    expect(resolvePreviewViewportTier('responsive', 800)).toBe('tablet');
    expect(resolvePreviewViewportTier('responsive', 1100)).toBe('desktop');
    expect(resolvePreviewViewportTier('responsive', 1400)).toBe('wide');
  });

  it('uses preset boxes for phone and tablet and fills desktop', () => {
    expect(resolvePreviewFrameSize('phone', BASE_COMPONENTS_PREVIEW_PRESET_SIZE.desktop)).toEqual({
      width: 390,
      height: 720,
    });
    expect(resolvePreviewFrameSize('tablet', BASE_COMPONENTS_PREVIEW_PRESET_SIZE.desktop)).toEqual({
      width: 760,
      height: 900,
    });
    expect(resolvePreviewFrameSize('desktop', BASE_COMPONENTS_PREVIEW_PRESET_SIZE.desktop)).toBeNull();
    expect(resolvePreviewFrameSize('responsive', { width: 480, height: 640 })).toEqual({
      width: 480,
      height: 640,
    });
  });

  it('clamps custom preview dimensions', () => {
    expect(clampPreviewCustomSize({ width: 10, height: 10 })).toEqual({ width: 320, height: 240 });
    expect(clampPreviewCustomSize({ width: 4000, height: 4000 })).toEqual({ width: 1920, height: 1600 });
  });
});

describe('BaseComponents preview size header control', () => {
  it('renders the size control between Reset and Preview config with separators', () => {
    const { container } = render(
      <BaseComponentsPreviewViewportProvider>
        <BaseComponentsConfigToolbarControls sectionId="grid" json="{}">
          <BaseComponentsResetButton onClick={() => undefined} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsPreviewViewportProvider>,
    );

    const reset = screen.getByRole('button', { name: 'Reset' });
    const size = screen.getByRole('button', { name: 'Preview size' });
    const previewConfig = screen.getByRole('button', { name: 'Preview config' });

    expect(reset.compareDocumentPosition(size) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(size.compareDocumentPosition(previewConfig) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThanOrEqual(2);
  });

  it('offers a responsive mode with custom dimensions', () => {
    render(
      <BaseComponentsPreviewViewportProvider>
        <BaseComponentsConfigToolbarControls sectionId="grid" json="{}">
          <BaseComponentsResetButton onClick={() => undefined} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsPreviewViewportProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview size' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Responsive/ }));

    expect(screen.getByLabelText('Preview width')).toBeInTheDocument();
    expect(screen.getByLabelText('Preview height')).toBeInTheDocument();
  });

  it('tags the preview host with the selected viewport', () => {
    const { container } = render(
      <BaseComponentsPreviewViewportProvider>
        <BaseComponentsPreviewViewportHost viewport="phone">
          <p>Preview body</p>
        </BaseComponentsPreviewViewportHost>
      </BaseComponentsPreviewViewportProvider>,
    );

    const host = container.querySelector('[data-bc-preview-viewport="phone"]');
    expect(host).not.toBeNull();
    expect(host?.getAttribute('data-bc-preview-width')).toBe('390');
    expect(host?.getAttribute('data-bc-preview-height')).toBe('720');
    expect(host?.firstElementChild).toHaveStyle({ width: '390px', height: '720px' });
  });
});
