/**
 * @vitest-environment jsdom
 */
import * as React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PlatformMountProvider } from '../../../../app/platform/PlatformMountContext';
import { BaseComponentsNav } from '../BaseComponentsNav';

const studioMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none' as const,
  authProfile: { requireAuth: true },
};

function renderNav() {
  return render(
    <MemoryRouter>
      <PlatformMountProvider mount={studioMount}>
        <BaseComponentsNav
          page={{
            activeSection: 'toolbar',
            setActiveSection: () => undefined,
          }}
        />
      </PlatformMountProvider>
    </MemoryRouter>,
  );
}

describe('BaseComponentsNav search', () => {
  afterEach(cleanup);

  it('filters the section list from the catalog search box', () => {
    renderNav();

    expect(screen.getByRole('link', { name: 'Toolbar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Toolbar' })).toHaveAttribute('href', '/studio/base-components/toolbar');
    expect(screen.getByRole('link', { name: 'Buttons' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search base components' }), {
      target: { value: 'where builder' },
    });

    expect(screen.getByRole('link', { name: 'Where builder' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Toolbar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Buttons' })).not.toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', () => {
    renderNav();

    fireEvent.change(screen.getByRole('textbox', { name: 'Search base components' }), {
      target: { value: 'no-such-component' },
    });

    expect(screen.getByText('No components match “no-such-component”.')).toBeInTheDocument();
  });

  it('hosts the section list in the page Scroll Area chrome', () => {
    const { container } = renderNav();
    const host = container.querySelector('[data-ui-scroll-area]');
    expect(host).toHaveAttribute('data-variant', 'nudge');
    expect(host).toHaveAttribute('data-axis', 'vertical');
    expect(host).toHaveAttribute('data-nudge-placement', 'overlay');
    expect(host).not.toHaveAttribute('data-nudge-visible');
    expect(host).toHaveAttribute('data-nudge-reveal', 'pointer');
    expect(host).toHaveAttribute('data-nudge-slot', 'band');
    expect(host).toHaveAttribute('data-nudge-icon-size', '18');
    expect(host).toHaveAttribute('data-nudge-mark', 'button');
    expect(host).toHaveAttribute('data-nudge-shape', 'circle');
    expect(screen.getByLabelText('Base components')).toHaveClass('ui-scroll-area-hide-thumb');
  });
});
