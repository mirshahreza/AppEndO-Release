// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { AboutAppModal } from '../AboutAppModal';
import { CultureProvider } from '../../core/culture/CultureContext';
import { bootstrapCultureRegistry } from '../../core/culture/CultureRegistry';
import { DEFAULT_PORTAL_ABOUT_BODY, DEFAULT_PORTAL_ABOUT_TITLE } from '../../shared/api/contracts/platform/portalBrand';

const renderAbout = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe('AboutAppModal portal brand', () => {
  beforeEach(() => {
    bootstrapCultureRegistry();
  });

  afterEach(() => {
    cleanup();
  });

  it('uses built-in About copy when the portal has no identity fields', () => {
    renderAbout(
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
    expect(screen.getByText(/Standards/)).toBeInTheDocument();
    expect(screen.queryByText(/Hawiety package/)).not.toBeInTheDocument();
    expect(screen.queryByText(/github\.com/i)).not.toBeInTheDocument();
  });

  it('renders portal about copy and never shows GitHub', () => {
    renderAbout(
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

  it('shows Hawiety package version when requested', () => {
    renderAbout(
      <CultureProvider cultureId="us">
        <AboutAppModal
          open
          onClose={() => undefined}
          brand={{ title: 'Hawiety', hasCustomBrand: false }}
          showHawietyPackageVersion
        />
      </CultureProvider>,
    );

    expect(screen.getByText(/v0\.3\.6/)).toBeInTheDocument();
  });

  it('uses culture About copy and RTL for Hawiety public', () => {
    renderAbout(
      <CultureProvider cultureId="iq" translationBundleSource="embedded">
        <AboutAppModal
          open
          onClose={() => undefined}
          brand={{
            title: 'Hawiety electronic identity system',
            aboutTitle: 'Hawiety electronic identity system',
            aboutBody: 'Official Hawiety membership registration and public identity flows for the National Wisdom Movement.',
            hasCustomBrand: true,
          }}
          showHawietyPackageVersion
        />
      </CultureProvider>,
    );

    expect(screen.getByText('هويتي', { selector: 'h3' })).toBeInTheDocument();
    expect(screen.getByText(/منظومة متكاملة لإدارة العلاقات/)).toBeInTheDocument();
    expect(screen.queryByText(/electronic identity system/i)).not.toBeInTheDocument();
    const content = screen.getByText(/منظومة متكاملة لإدارة العلاقات/).closest('[dir="rtl"]');
    expect(content).not.toBeNull();
  });
});
