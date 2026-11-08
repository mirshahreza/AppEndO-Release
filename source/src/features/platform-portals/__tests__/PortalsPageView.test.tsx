// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

vi.mock('../../../core/culture/builtinTranslationLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../core/culture/builtinTranslationLoader')>();
  const { BUILTIN_TRANSLATION_MASTER_EN } = await import('../../../core/culture/translations/masterEn');
  return {
    ...actual,
    loadBuiltinTranslationBundle: async () => ({ ...BUILTIN_TRANSLATION_MASTER_EN }),
    loadMasterTranslationBundle: async () => ({ ...BUILTIN_TRANSLATION_MASTER_EN }),
  };
});

vi.mock('../../../shared/api/queries/roles', () => ({
  useRolesListQuery: () => ({
    data: [{ id: 1, name: 'ADMIN' }],
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../../shared/api/queries/users', () => ({
  useUsersListQuery: () => ({
    data: { items: [] },
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

import { fireEvent, render, screen, within, cleanup, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PortalsPageView } from '../components/PortalsPageView';
import type { PortalsPageModel } from '../hooks/usePortalsPage';
import { defaultHomePortal, defaultStudioPortal, defaultComponentAlonePortal, isOperatorHiddenBuiltinPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { DEFAULT_PORTAL_ABOUT_TITLE, DEFAULT_PORTAL_LOGO_URL, DEFAULT_PORTAL_TITLE } from '../../../shared/api/contracts/platform/portalBrand';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import { BUILT_IN_STUDIO_SHELL_ENTRY, BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY, SITE_PORTAL_SEGMENT, SITE_SHELL_LAYOUT_KEY } from '../../../shared/api/contracts/platform/mountConstants';
import { componentDesignerQueryKeys } from '../../../shared/api/queries/component-designer';
import { BUILTIN_FILTER_ALL, BUILTIN_FILTER_NO } from '../../../shared/lib/builtInFilter';
import { CultureProvider } from '../../../app/platform/CultureContext';
import { bootstrapCultureRegistry } from '../../../core/culture/CultureRegistry';
import { AppToastHost } from '../../../shared/ui/AppToastHost';

async function renderPortalsPageView(page: PortalsPageModel, queryClient = new QueryClient()) {
  const result = render(
    <QueryClientProvider client={queryClient}>
      <CultureProvider cultureId="us">
        <MemoryRouter>
          <AppToastHost />
          <PortalsPageView page={page} />
        </MemoryRouter>
      </CultureProvider>
    </QueryClientProvider>,
  );

  await waitFor(() => {
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
  });

  return result;
}

const customPortal: ExperienceManifestPortal = {
  segment: 'my-portal',
  name: 'My Portal',
  shellKey: 'my-portal',
  entryMode: 'shell',
  enabled: true,
  auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
  pages: [],
};

function buildPageModel(options?: {
  hideBuiltinPortals?: boolean;
  portals?: ExperienceManifestPortal[];
  query?: string;
}): PortalsPageModel {
  const portals = options?.portals ?? [
    defaultHomePortal(),
    defaultStudioPortal(),
    defaultComponentAlonePortal(),
    customPortal,
  ];
  const hideBuiltinPortals = options?.hideBuiltinPortals ?? true;
  const builtInFilter = hideBuiltinPortals ? BUILTIN_FILTER_NO : BUILTIN_FILTER_ALL;
  const query = options?.query ?? '';
  const displayPortals = hideBuiltinPortals
    ? portals.filter((portal) => !isOperatorHiddenBuiltinPortal(portal))
    : portals;

  return {
    manifestQuery: {
      isLoading: false,
      isError: false,
      error: null,
      data: {
        id: 'admin',
        cultureId: 'us',
        portals,
      },
      refetch: vi.fn(),
    } as PortalsPageModel['manifestQuery'],
    portals,
    displayPortals,
    builtInFilter,
    setBuiltInFilter: vi.fn(),
    query,
    setQuery: vi.fn(),
    shellPortals: [defaultStudioPortal(), defaultComponentAlonePortal()],
    createEmptyPortal: vi.fn(),
    isSaving: false,
    formError: null,
    savePortal: vi.fn(),
    removePortal: vi.fn(),
    duplicatePortal: vi.fn(),
    retryLoad: vi.fn(),
  };
}

describe('PortalsPageView', () => {
  beforeEach(() => {
    bootstrapCultureRegistry();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders portals grid without compile or root selector', async () => {
    await renderPortalsPageView(buildPageModel());

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.queryByText('Studio')).not.toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.queryByText('/studio')).not.toBeInTheDocument();
    expect(screen.queryByText(BUILT_IN_STUDIO_SHELL_ENTRY)).not.toBeInTheDocument();
    expect(screen.queryByText(BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY)).not.toBeInTheDocument();
    expect(screen.getByText('my-portal')).toBeInTheDocument();
    expect(screen.getByText('→ us/studio')).toBeInTheDocument();
    expect(screen.queryByText('Compile')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Default root application')).not.toBeInTheDocument();
  });

  it('renders catalog-style search and BuiltIn filter in the toolbar', async () => {
    const page = buildPageModel();
    await renderPortalsPageView(page);

    const search = screen.getByLabelText('Search');
    expect(search).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'studio' } });
    expect(page.setQuery).toHaveBeenCalledWith('studio');
    expect(screen.getByRole('button', { name: /BuiltIn/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Kind/i })).not.toBeInTheDocument();
  });

  it('treats home portal as not built-in in the grid badge', async () => {
    await renderPortalsPageView(buildPageModel());

    const homeRow = screen.getAllByText('Home')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(homeRow).toBeDefined();
    expect(within(homeRow!).queryByText('builtin')).not.toBeInTheDocument();
  });

  it('shows built-in portals when hide filter is off', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    expect(screen.getByText('Studio')).toBeInTheDocument();
    expect(screen.getByText('/studio')).toBeInTheDocument();
    expect(screen.getAllByText('builtin').length).toBeGreaterThan(0);
  });

  it('keeps root delete disabled and opens duplicate modal for studio', async () => {
    const page = buildPageModel({ hideBuiltinPortals: false });
    await renderPortalsPageView(page);

    const homeRow = screen.getAllByText('Home')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    const studioRow = screen.getAllByText('Studio')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(homeRow).toBeDefined();
    expect(studioRow).toBeDefined();

    expect(within(homeRow!).getByLabelText('Duplicate application')).toBeDisabled();
    expect(within(homeRow!).getByLabelText('Delete application')).toBeDisabled();
    expect(within(studioRow!).getByLabelText('Duplicate application')).not.toBeDisabled();
    expect(within(studioRow!).getByLabelText('Delete application')).toBeDisabled();

    fireEvent.click(within(studioRow!).getByLabelText('Duplicate application'));
    expect(screen.getByLabelText('Duplicate application URL segment')).toBeInTheDocument();
    expect(screen.getByLabelText('Duplicate application display name')).toBeInTheDocument();
    expect(screen.getByLabelText('Duplicate application URL segment')).toHaveValue('');
    expect(screen.getByLabelText('Duplicate application display name')).toHaveValue('');
  });

  it('opens duplicate modal with suggested defaults for custom applications', async () => {
    const page = buildPageModel();
    await renderPortalsPageView(page);

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    fireEvent.click(within(customRow!).getByLabelText('Duplicate application'));
    expect(screen.getByLabelText('Duplicate application URL segment')).toHaveValue('my-portal-copy');
    expect(screen.getByLabelText('Duplicate application display name')).toHaveValue('My Portal (copy)');
    expect(page.duplicatePortal).not.toHaveBeenCalled();
  });

  it('opens create modal with no layout pre-selected', async () => {
    const page = buildPageModel();
    page.createEmptyPortal = vi.fn(() => ({
      segment: '',
      name: '',
      shellKey: '',
      entryMode: 'shell' as const,
      enabled: true,
      auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
      pages: [],
    }));
    await renderPortalsPageView(page);

    fireEvent.click(screen.getByRole('button', { name: /add portal/i }));
    expect(page.createEmptyPortal).toHaveBeenCalled();
    expect(screen.getByLabelText('Layout')).toBeInTheDocument();
    expect(screen.queryByText('admin-layout')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /enabled/i })).not.toBeInTheDocument();
  });

  it('opens edit portal modal with save action and update mode', async () => {
    const page = buildPageModel();
    page.savePortal = vi.fn().mockResolvedValue(undefined);
    await renderPortalsPageView(page);

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    fireEvent.click(within(customRow!).getByLabelText(/^Edit portal My Portal$/));
    expect(screen.getByText('Edit portal')).toBeInTheDocument();
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByLabelText('Portal title')).toHaveValue(DEFAULT_PORTAL_TITLE);
    expect(screen.getByLabelText('About page headline')).toHaveValue(DEFAULT_PORTAL_ABOUT_TITLE);
    expect(screen.getByRole('img', { name: 'Image preview' })).toHaveAttribute('src', DEFAULT_PORTAL_LOGO_URL);
    expect(screen.getByLabelText('About page text')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Portal title'), { target: { value: 'Harbor' } });
    fireEvent.change(screen.getByLabelText('About page text'), { target: { value: 'A storefront portal' } });
    fireEvent.change(screen.getByLabelText('Application name'), { target: { value: 'Updated Portal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(page.savePortal).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({
          name: 'Updated Portal',
          segment: 'my-portal',
          brand: expect.objectContaining({
            title: 'Harbor',
            aboutBody: 'A storefront portal',
          }),
        }),
        'my-portal',
        { suppressFormError: true },
      );
    });
  });

  it('shows save errors as a top-center toast instead of inline in the dialog', async () => {
    const page = buildPageModel();
    page.formError = 'segment "home" is duplicated.';
    page.savePortal = vi.fn().mockRejectedValue(new Error('segment "home" is duplicated.'));
    await renderPortalsPageView(page);

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    fireEvent.click(within(customRow!).getByLabelText(/^Edit portal My Portal$/));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('segment "home" is duplicated.');
    });
    expect(screen.getAllByText('segment "home" is duplicated.')).toHaveLength(1);
  });

  it('shows core AdminLayout in studio edit modal', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const studioRow = screen.getAllByText('Studio')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(studioRow).toBeDefined();

    fireEvent.click(within(studioRow!).getByLabelText(/^Edit portal Studio$/));
    expect(screen.getAllByText(BUILT_IN_STUDIO_SHELL_ENTRY).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByLabelText('Layout', { selector: 'select' })).not.toBeInTheDocument();
    expect(screen.queryByText('portal-layouts/studio')).not.toBeInTheDocument();
  });

  it('enables navigations for home when it uses a shell instead of redirect', async () => {
    const shellHome = {
      ...defaultHomePortal(),
      entryMode: 'shell' as const,
      redirectToSegment: null,
      redirectToCulture: null,
      shellKey: 'home-shell',
    };
    const page = buildPageModel({
      portals: [shellHome, defaultStudioPortal(), defaultComponentAlonePortal(), customPortal],
    });
    await renderPortalsPageView(page);

    const homeRow = screen.getAllByText('Home')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(homeRow).toBeDefined();
    expect(within(homeRow!).getByLabelText('Manage navigations')).not.toBeDisabled();
  });

  it('keeps redirect culture field visible but disabled for layout applications', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const studioRow = screen.getAllByText('Studio')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(studioRow).toBeDefined();

    fireEvent.click(within(studioRow!).getByLabelText(/^Edit portal Studio$/));
    expect(screen.getByLabelText('Redirect target culture')).toBeDisabled();
    expect(screen.getByLabelText('Redirect target application')).toBeInTheDocument();
  });

  it('locks built-in portal edit form and shows System Protected beside Enabled', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const studioRow = screen.getAllByText('Studio')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(studioRow).toBeDefined();

    fireEvent.click(within(studioRow!).getByLabelText(/^Edit portal Studio$/));
    expect(screen.getByText('System Protected')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /enabled/i })).toBeDisabled();
    expect(screen.getByLabelText('Application name')).toBeDisabled();
    expect(screen.getByLabelText('Redirect target application')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('locks component-alone portal edit form as system protected', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const componentAloneRow = screen.getAllByText('Component Alone')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(componentAloneRow).toBeDefined();

    fireEvent.click(within(componentAloneRow!).getByLabelText(/^Edit portal Component Alone$/));
    expect(screen.getByText('System Protected')).toBeInTheDocument();
    expect(screen.getByLabelText('Application name')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('does not lock custom or home portal edit forms', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    fireEvent.click(within(customRow!).getByLabelText(/^Edit portal My Portal$/));
    expect(screen.queryByText('System Protected')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Application name')).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    const homeRow = screen.getAllByText('Home')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(homeRow).toBeDefined();

    fireEvent.click(within(homeRow!).getByLabelText(/^Edit portal Home$/));
    expect(screen.queryByText('System Protected')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('saves home layout when the portal already uses a shell', async () => {
    const shellHome = {
      ...defaultHomePortal(),
      entryMode: 'shell' as const,
      redirectToSegment: null,
      redirectToCulture: null,
      shellKey: SITE_PORTAL_SEGMENT,
    };
    const page = buildPageModel({
      hideBuiltinPortals: false,
      portals: [shellHome, defaultStudioPortal(), defaultComponentAlonePortal(), customPortal],
    });
    page.savePortal = vi.fn().mockResolvedValue(undefined);
    await renderPortalsPageView(page);

    const homeRow = screen.getAllByText('Home')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(homeRow).toBeDefined();

    fireEvent.click(within(homeRow!).getByLabelText(/^Edit portal Home$/));
    expect(screen.getByLabelText('Layout')).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(page.savePortal).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({
          segment: 'home',
          entryMode: 'shell',
          shellKey: SITE_SHELL_LAYOUT_KEY,
          redirectToSegment: null,
        }),
        'home',
        { suppressFormError: true },
      );
    });
  });

  it('links layout column to designer for editable applications only', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const studioRow = screen.getAllByText('Studio')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(studioRow).toBeDefined();
    expect(within(studioRow!).queryByLabelText('Edit layout')).not.toBeInTheDocument();

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    const editLayoutLink = within(customRow!).getByLabelText('Edit layout');
    expect(editLayoutLink.tagName).toBe('A');
    expect(editLayoutLink).toHaveAttribute(
      'href',
      '/us/studio/client-components/edit/my-portal',
    );
    expect(editLayoutLink).toHaveTextContent('my-portal');
  });

  it('does not link layout column to designer for core shells', async () => {
    const corePortal: ExperienceManifestPortal = {
      ...customPortal,
      segment: 'admin-app',
      name: 'Admin App',
      shellKey: BUILT_IN_STUDIO_SHELL_ENTRY,
    };
    await renderPortalsPageView(buildPageModel({
      hideBuiltinPortals: true,
      portals: [corePortal],
    }));

    const coreRow = screen.getAllByText('Admin App')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(coreRow).toBeDefined();
    expect(within(coreRow!).queryByLabelText('Edit layout')).not.toBeInTheDocument();
    expect(within(coreRow!).getByText(BUILT_IN_STUDIO_SHELL_ENTRY)).toBeInTheDocument();
  });

  it('links layout column with draft load id when designer draft exists', async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      componentDesignerQueryKeys.drafts(),
      [{
        id: 'draft-my-portal',
        name: 'my-portal',
        folder: 'portal-layouts',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        createdBy: 'admin',
        updatedBy: 'admin',
        isBuiltIn: false,
      }],
    );

    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }), queryClient);

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    const editLayoutLink = within(customRow!).getByLabelText('Edit layout');
    expect(editLayoutLink).toHaveAttribute(
      'href',
      '/us/studio/client-components?load=draft-my-portal',
    );
  });

  it('enables redirect culture field when redirect entry is active', async () => {
    await renderPortalsPageView(buildPageModel({ hideBuiltinPortals: false }));

    const homeRow = screen.getAllByText('Home')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(homeRow).toBeDefined();

    fireEvent.click(within(homeRow!).getByLabelText(/^Edit portal Home$/));
    expect(screen.getByLabelText('Redirect target culture')).toBeEnabled();
  });

  it('saves public access from the Access column', async () => {
    const page = buildPageModel();
    page.savePortal = vi.fn().mockResolvedValue(undefined);
    await renderPortalsPageView(page);

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    fireEvent.click(within(customRow!).getByLabelText(/Configure access control/));
    fireEvent.click(screen.getByRole('radio', { name: /Public/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Access' }));

    await waitFor(() => {
      expect(page.savePortal).toHaveBeenCalledWith(
        'update',
        expect.objectContaining({
          segment: 'my-portal',
          auth: null,
        }),
        'my-portal',
        expect.anything(),
      );
    });
  });

  it('keeps the Access dialog open when save fails', async () => {
    const page = buildPageModel();
    page.savePortal = vi.fn().mockRejectedValue(new Error('Access save blocked.'));
    await renderPortalsPageView(page);

    const customRow = screen.getAllByText('My Portal')
      .map((element) => element.closest('tr'))
      .find((row): row is HTMLTableRowElement => row != null);
    expect(customRow).toBeDefined();

    fireEvent.click(within(customRow!).getByLabelText(/Configure access control/));
    fireEvent.click(screen.getByRole('button', { name: 'Save Access' }));

    await waitFor(() => {
      expect(screen.getByText('Access save blocked.')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Save Access' })).toBeInTheDocument();
  });
});
