// @vitest-environment jsdom
/**
 * p-10 / p-28 exit criteria — multi-culture routes (us · ir · iq).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import type { PlatformMount, PlatformRuntimeConfig } from '../../../shared/api/contracts/platform/types';
import { EXPERIENCE_MOUNT_DASHBOARD_PAGE_KEY } from '../../../shared/api/contracts/platform/experienceMountSeeds';
import {
  loadPlatformRegistryDefaultMount,
  loadPlatformRegistryDefaultRouteBindings,
  loadPlatformRegistryDefaultShellRules,
} from '../../../core/platform-registry/loadPlatformRegistryDefaults';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { formatGridDateForCalendar } from '../../../shared/lib/gridDateFormat';
import {
  getMountById,
  getPageModuleByKey,
  resolveCultureRouteMount,
  resolveMountCalendar,
  resolveMountDirection,
  resolveRouteBindingForRelativePath,
} from '../platformConfigHelpers';
import { resolvePageModule } from '../resolvers';
import { CultureProvider, useCulture } from '../CultureContext';
import { MountGridDateText } from '../MountGridDateText';
import { PlatformMountProvider } from '../PlatformMountContext';

const SAMPLE_UTC = '2026-06-15T14:30:00.000Z';

const CULTURE_ROUTE_IDS = ['ir', 'us', 'iq'] as const;

function buildCultureRuntimeConfig(): PlatformRuntimeConfig {
  const studioMount = loadPlatformRegistryDefaultMount('studio');
  if (!studioMount) {
    throw new Error('studio mount seed is required');
  }

  return {
    version: 'p28-exit-v1',
    mounts: [studioMount],
    shells: [
      {
        shellKey: 'admin',
        name: 'Admin Layout',
        entry: 'core:AdminLayout',
        surface: 'admin',
        enabled: true,
      },
    ],
    shellRules: loadPlatformRegistryDefaultShellRules(),
    pageModules: [
      {
        pageKey: EXPERIENCE_MOUNT_DASHBOARD_PAGE_KEY,
        title: 'Dashboard',
        loaderKind: 'core',
        loaderRef: 'core:Dashboard',
        enabled: true,
      },
    ],
    bindings: loadPlatformRegistryDefaultRouteBindings().filter((binding) => binding.mountId === 'studio'),
    navigations: [],
  };
}

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

describe('p-10 / p-28 multi-culture route exit criteria', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
    bootstrapCultureRegistry(['us', 'ir', 'iq']);
  });

  it('resolves the same dashboard page module on /ir, /us, and /iq culture routes', () => {
    bootstrapCultureRegistry();
    const config = buildCultureRuntimeConfig();
    const dashboardPage = getPageModuleByKey(config, 'dashboard');

    for (const cultureId of CULTURE_ROUTE_IDS) {
      const binding = resolveRouteBindingForRelativePath(config, cultureId, 'studio');
      expect(binding?.pageKey).toBe('dashboard');
      expect(dashboardPage?.loaderRef).toBe('core:Dashboard');
      expect(resolvePageModule(dashboardPage?.loaderRef ?? '')?.component).toBeTruthy();
    }
  });

  it('formats grid dates per culture calendar (jalali · gregorian)', () => {
    bootstrapCultureRegistry();
    const config = buildCultureRuntimeConfig();
    const ir = getMountById(config, 'ir')!;
    const us = getMountById(config, 'us')!;
    const iq = getMountById(config, 'iq')!;

    expect(formatGridDateForCalendar(SAMPLE_UTC, resolveMountCalendar(ir))).toBe('1405-03-25');
    expect(formatGridDateForCalendar(SAMPLE_UTC, resolveMountCalendar(us))).toBe('2026-06-15');
    expect(formatGridDateForCalendar(SAMPLE_UTC, resolveMountCalendar(iq))).toBe('2026-06-15');

    render(
      <MountCultureShell mount={ir}>
        <MountGridDateText value={SAMPLE_UTC} />
      </MountCultureShell>,
    );
    expect(screen.getByText('1405-03-25')).toBeTruthy();
    cleanup();

    render(
      <MountCultureShell mount={us}>
        <MountGridDateText value={SAMPLE_UTC} />
      </MountCultureShell>,
    );
    expect(screen.getByText('2026-06-15')).toBeTruthy();
    cleanup();

    render(
      <MountCultureShell mount={iq}>
        <MountGridDateText value={SAMPLE_UTC} />
      </MountCultureShell>,
    );
    expect(screen.getByText('2026-06-15')).toBeTruthy();
  });

  it('synthesizes culture route mounts from studio without per-culture registry entities', () => {
    bootstrapCultureRegistry();
    const config = buildCultureRuntimeConfig();

    expect(loadPlatformRegistryDefaultMount('ir')).toBeUndefined();
    expect(CULTURE_ROUTE_IDS.every((cultureId) => resolveCultureRouteMount(config, cultureId)?.cultureId === cultureId)).toBe(true);
  });

  it('applies RTL on ir/iq and LTR on us via CultureProvider', async () => {
    bootstrapCultureRegistry();
    const config = buildCultureRuntimeConfig();
    const ir = getMountById(config, 'ir')!;
    const us = getMountById(config, 'us')!;
    const iq = getMountById(config, 'iq')!;

    expect(resolveMountDirection(ir)).toBe('rtl');
    expect(resolveMountDirection(us)).toBe('ltr');
    expect(resolveMountDirection(iq)).toBe('rtl');

    const { unmount: unmountIr } = render(
      <MountCultureShell mount={ir}>
        <span>ir</span>
      </MountCultureShell>,
    );
    await waitFor(() => {
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });
    unmountIr();

    render(
      <MountCultureShell mount={us}>
        <span>us</span>
      </MountCultureShell>,
    );
    await waitFor(() => {
      expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    });
    cleanup();

    render(
      <MountCultureShell mount={iq}>
        <span>iq</span>
      </MountCultureShell>,
    );
    await waitFor(() => {
      expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    });
  });

  it('loads ir translation bundle via useCulture', async () => {
    bootstrapCultureRegistry();
    const ir = getMountById(buildCultureRuntimeConfig(), 'ir')!;

    render(
      <MountCultureShell mount={ir}>
        <CultureProbe />
      </MountCultureShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready')).toHaveTextContent('true');
      expect(screen.getByTestId('save-label')).toHaveTextContent('Save');
    });
  });

  it('falls back to us for missing ir keys with dev warning', async () => {
    bootstrapCultureRegistry();
    const ir = getMountById(buildCultureRuntimeConfig(), 'ir')!;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <MountCultureShell mount={ir}>
        <CultureFallbackProbe />
      </MountCultureShell>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('missing-key')).toHaveTextContent('Only in master bundle');
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

function CultureProbe() {
  const { t, ready } = useCulture();

  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="save-label">{t('actions.save')}</span>
    </div>
  );
}

function CultureFallbackProbe() {
  const { t, ready } = useCulture();

  return (
    <div>
      <span data-testid="ready">{String(ready)}</span>
      <span data-testid="missing-key">{t('culture.test.masterOnly')}</span>
    </div>
  );
}
