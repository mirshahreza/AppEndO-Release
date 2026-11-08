// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { CultureProvider } from '../../app/platform/CultureContext';
import { RouteNotFoundPage } from '../RouteNotFoundPage';

const renderRouteNotFound = (ui: React.ReactElement) => render(
  <CultureProvider cultureId="us">
    {ui}
  </CultureProvider>,
);

describe('RouteNotFoundPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the current pathname without redirecting', () => {
    renderRouteNotFound(
      <MemoryRouter initialEntries={['/unknown/path']}>
        <RouteNotFoundPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('route-not-found-page')).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText('/unknown/path')).toBeInTheDocument();
  });

  it('links to a custom home path in embedded mode', () => {
    renderRouteNotFound(
      <MemoryRouter initialEntries={['/us/studio/missing']}>
        <RouteNotFoundPage variant="embedded" homeTo="/us/studio" homeLabel="Go to dashboard" />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: 'Go to dashboard' });
    expect(link).toHaveAttribute('href', '/us/studio');
  });
});
