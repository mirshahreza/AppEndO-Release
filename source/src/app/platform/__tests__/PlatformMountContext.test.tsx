// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import type { PlatformMount } from '../../../shared/api/contracts/platform/types';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { STUDIO_NO_SELECT_DOCUMENT_ATTR, resetStudioNoSelectDocumentForTests } from '../../../shared/ui/shell/studioNoSelect';
import { MountGridDateText } from '../MountGridDateText';
import { CultureProvider } from '../CultureContext';
import { PlatformMountProvider, usePlatformMount } from '../PlatformMountContext';

const irMount: PlatformMount = {
  id: 'ir',
  pathPrefix: '/ir',
  name: 'Iran',
  enabled: true,
  defaultRoute: '/ir',
  designerRoutePropagation: 'auto',
  authProfile: {},
  cultureId: 'ir',
  experienceConfig: {
    locale: 'fa-IR',
    calendar: 'jalali',
    direction: 'rtl',
  },
};

const usMount: PlatformMount = {
  id: 'us',
  pathPrefix: '/us',
  name: 'United States',
  enabled: true,
  defaultRoute: '/us',
  designerRoutePropagation: 'auto',
  authProfile: {},
  cultureId: 'us',
  experienceConfig: {
    locale: 'en-US',
    calendar: 'gregorian',
    direction: 'ltr',
  },
};

const studioMount: PlatformMount = {
  id: 'studio',
  pathPrefix: '/studio',
  name: 'Studio',
  enabled: true,
  defaultRoute: '/studio',
  designerRoutePropagation: 'none',
  authProfile: { requireAuth: true },
};

function MountCultureShell({
  mount,
  children,
}: {
  mount: PlatformMount;
  children: React.ReactNode;
}) {
  return (
    <PlatformMountProvider mount={mount}>
      <CultureProvider
        cultureId={mount.cultureId ?? 'us'}
        timezoneOverride={mount.timezoneOverride}
      >
        {children}
      </CultureProvider>
    </PlatformMountProvider>
  );
}

function MountProbe() {
  const { mountId, pathPrefix, calendar, toMountPath } = usePlatformMount();

  return (
    <div>
      <span data-testid="mount-id">{mountId}</span>
      <span data-testid="path-prefix">{pathPrefix}</span>
      <span data-testid="calendar">{calendar}</span>
      <span data-testid="dashboard-path">{toMountPath('')}</span>
      <span data-testid="users-path">{toMountPath('users')}</span>
      <span data-testid="nested-path">{toMountPath('/reports/summary')}</span>
    </div>
  );
}

describe('PlatformMountContext', () => {
  // resolveMountCalendar (platformConfigHelpers.ts) always resolves via the culture registry
  // (resolveMountCulture → CultureRegistry), ignoring mount.experienceConfig directly — the
  // registry starts empty until bootstrapped, so every lookup silently fell back to 'us'.
  beforeEach(() => {
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  afterEach(() => {
    cleanup();
    resetStudioNoSelectDocumentForTests();
  });

  it('exposes mount metadata and toMountPath for experience mounts', () => {
    render(
      <PlatformMountProvider mount={irMount}>
        <MountProbe />
      </PlatformMountProvider>,
    );

    expect(screen.getByTestId('mount-id')).toHaveTextContent('ir');
    expect(screen.getByTestId('path-prefix')).toHaveTextContent('/ir');
    expect(screen.getByTestId('calendar')).toHaveTextContent('jalali');
    expect(screen.getByTestId('dashboard-path')).toHaveTextContent('/ir');
    expect(screen.getByTestId('users-path')).toHaveTextContent('/ir/users');
    expect(screen.getByTestId('nested-path')).toHaveTextContent('/ir/reports/summary');
  });

  it('defaults calendar to gregorian when experience config is missing', () => {
    render(
      <PlatformMountProvider mount={studioMount}>
        <MountProbe />
      </PlatformMountProvider>,
    );

    expect(screen.getByTestId('calendar')).toHaveTextContent('gregorian');
    expect(screen.getByTestId('users-path')).toHaveTextContent('/studio/users');
  });

  it('sets document direction from culture provider', () => {
    const { unmount: unmountFa } = render(
      <MountCultureShell mount={irMount}>
        <span>child</span>
      </MountCultureShell>,
    );

    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    unmountFa();

    const { unmount: unmountEn } = render(
      <MountCultureShell mount={usMount}>
        <span>child</span>
      </MountCultureShell>,
    );

    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    unmountEn();
  });

  it('formats grid dates using mount calendar context', () => {
    const { container } = render(
      <PlatformMountProvider mount={irMount}>
        <MountGridDateText value="2026-06-15T14:30:00.000Z" />
      </PlatformMountProvider>,
    );

    const glyph = screen.getByText('1405-03-25');
    expect(glyph).toBeTruthy();
    expect(glyph.getAttribute('dir')).toBe('ltr');
    expect(glyph.className).toContain('w-[10ch]');
    expect(glyph.className).toContain('font-mono');
    expect(container.querySelector('.justify-center')).toBeTruthy();
  });

  it('locks text selection on the document for the studio mount only', () => {
    const { unmount: unmountStudio } = render(
      <PlatformMountProvider mount={studioMount}>
        <MountProbe />
      </PlatformMountProvider>,
    );

    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(true);
    unmountStudio();
    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(false);

    render(
      <PlatformMountProvider mount={irMount}>
        <MountProbe />
      </PlatformMountProvider>,
    );

    expect(document.documentElement.hasAttribute(STUDIO_NO_SELECT_DOCUMENT_ATTR)).toBe(false);
  });
});
