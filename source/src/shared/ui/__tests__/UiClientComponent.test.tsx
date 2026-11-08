/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { UiClientComponent } from '../UiClientComponent';
import { ViewportTierContext } from '../../lib/ViewportTierProvider';

describe('UiClientComponent', () => {
  it('keeps children when belowMin is continue', () => {
    render(
      <ViewportTierContext.Provider value="phone">
        <UiClientComponent minViewport="desktop" belowMin="continue">
          <span>adapted body</span>
        </UiClientComponent>
      </ViewportTierContext.Provider>,
    );
    expect(screen.getByText('adapted body')).toBeInTheDocument();
  });

  it('hides children when belowMin is hide', () => {
    const { container } = render(
      <ViewportTierContext.Provider value="phone">
        <UiClientComponent minViewport="desktop" belowMin="hide">
          <span>secret</span>
        </UiClientComponent>
      </ViewportTierContext.Provider>,
    );
    expect(container).toHaveTextContent('');
  });

  it('shows the desktop-only placeholder when requested', () => {
    render(
      <ViewportTierContext.Provider value="tablet">
        <UiClientComponent minViewport="desktop" belowMin="placeholder">
          <span>full layout</span>
        </UiClientComponent>
      </ViewportTierContext.Provider>,
    );
    expect(screen.getByRole('heading', { name: 'Desktop only' })).toBeInTheDocument();
    expect(screen.queryByText('full layout')).not.toBeInTheDocument();
  });
});
