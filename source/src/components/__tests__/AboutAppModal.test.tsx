// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AboutAppModal } from '../AboutAppModal';
import { CultureProvider } from '../../core/culture/CultureContext';
import { bootstrapCultureRegistry } from '../../core/culture/CultureRegistry';
import { DEFAULT_PORTAL_ABOUT_BODY, DEFAULT_PORTAL_ABOUT_TITLE } from '../../shared/api/contracts/platform/portalBrand';

describe('AboutAppModal portal brand', () => {
  beforeEach(() => {
    bootstrapCultureRegistry();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses built-in About copy when the portal has no identity fields', () => {
    render(
      <CultureProvider cultureId="us">
        <AboutAppModal
          open
          onClose={() => undefined}
          brand={{ title: 'Studio', hasCustomBrand: false }}
        />
      </CultureProvider>,
    );

    expect(screen.getByText(DEFAULT_PORTAL_ABOUT_TITLE)).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_PORTAL_ABOUT_BODY)).toBeInTheDocument();
    expect(screen.getByText(/Version/)).toBeInTheDocument();
    expect(screen.queryByText(/github\.com/i)).not.toBeInTheDocument();
  });

  it('renders portal about copy and never shows GitHub', () => {
    render(
      <CultureProvider cultureId="us">
        <AboutAppModal
          open
          onClose={() => undefined}
          brand={{
            title: 'Harbor',
            aboutTitle: 'About Harbor',
            aboutBody: 'A storefront portal.',
            hasCustomBrand: true,
          }}
        />
      </CultureProvider>,
    );

    expect(screen.getByText('About Harbor')).toBeInTheDocument();
    expect(screen.getByText('A storefront portal.')).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_PORTAL_ABOUT_TITLE)).not.toBeInTheDocument();
    expect(screen.queryByText(/github\.com/i)).not.toBeInTheDocument();
    expect(screen.queryByText('https://github.com/append-os/appendo')).not.toBeInTheDocument();
  });
});
