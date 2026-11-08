// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CultureProvider } from '../../../../core/culture/CultureContext';
import { DEFAULT_CATALOG_KIND_FILTER } from '../../../../domain/component-designer/layout-presets/catalogSystemTags';
import { DesignerPaletteSidebar } from '../DesignerPaletteSidebar';

afterEach(() => {
  cleanup();
});

describe('DesignerPaletteSidebar catalog Create', () => {
  it('offers CRUD Set and Based on Templates on the Create dropdown', () => {
    const onOpenCreate = vi.fn();
    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={onOpenCreate}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{}}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Create component/i }));
    expect(screen.getByTestId('catalog-create-crud-set')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-create-templates')).toHaveTextContent('Based on Templates');
    expect(screen.queryByTestId('catalog-create-empty')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('catalog-create-crud-set'));
    expect(onOpenCreate).toHaveBeenCalledWith('crud-set');
  });

  it('filters type and BuiltIn independently', async () => {
    const onCatalogKindFilterChange = vi.fn();
    const onCatalogBuiltInFilterChange = vi.fn();

    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter={DEFAULT_CATALOG_KIND_FILTER}
          onCatalogKindFilterChange={onCatalogKindFilterChange}
          catalogBuiltInFilter=""
          onCatalogBuiltInFilterChange={onCatalogBuiltInFilterChange}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{}}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    const kindFilter = screen.getByRole('button', { name: /Kind/i });
    expect(kindFilter.textContent).toMatch(/All/);

    await act(async () => {
      fireEvent.click(kindFilter);
    });

    expect(await screen.findByRole('option', { name: /All/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: 'Custom' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: 'Shell' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: 'Template' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('option', { name: 'BuiltIn' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Not BuiltIn' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'Template' }));
    });

    expect(onCatalogKindFilterChange.mock.calls.at(-1)?.[0]).toBe('template');

    const builtInFilter = screen.getByRole('button', { name: /BuiltIn/i });
    expect(builtInFilter.textContent).toMatch(/All/);

    await act(async () => {
      fireEvent.click(builtInFilter);
    });

    expect(await screen.findByRole('option', { name: 'BuiltIn' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Not BuiltIn' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: 'BuiltIn' }));
    });

    expect(onCatalogBuiltInFilterChange.mock.calls.at(-1)?.[0]).toBe('builtin');
  });

  it('shows saved components without the Templates folder when built-ins are hidden', () => {
    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            general: [{
              id: 'draft-cms-contents-list',
              name: 'cms-contents-list',
              folder: 'general',
              createdAt: '2026-08-01T10:48:14.340Z',
              updatedAt: '2026-08-12T01:06:26.543Z',
            }],
          }}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    expect(screen.getByText('cms-contents-list')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-folder-templates')).not.toBeInTheDocument();
  });

  it('places built-in starters in the same list as saved components when All Items is on', () => {
    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            general: [{
              id: 'draft-cms-contents-list',
              name: 'cms-contents-list',
              folder: 'general',
              createdAt: '2026-08-01T10:48:14.340Z',
              updatedAt: '2026-08-12T01:06:26.543Z',
            }],
            templates: [{
              id: 'builtin-blog-list',
              name: 'blog-list',
              folder: 'templates',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              isBuiltIn: true,
            }],
          }}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    expect(screen.getByText('cms-contents-list')).toBeInTheDocument();
    expect(screen.getByText('blog-list')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-folder-templates')).not.toBeInTheDocument();
    expect(screen.queryByText('templates/')).not.toBeInTheDocument();
  });

  it('keeps built-in shells in the main catalog, not the Templates folder', () => {
    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            general: [
              {
                id: 'draft-cms-contents-list',
                name: 'cms-contents-list',
                folder: 'general',
                createdAt: '2026-08-01T10:48:14.340Z',
                updatedAt: '2026-08-12T01:06:26.543Z',
              },
              {
                id: 'builtin-app-shell',
                name: 'app-shell',
                folder: 'general',
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
                isBuiltIn: true,
              },
            ],
            templates: [{
              id: 'builtin-blog-list',
              name: 'blog-list',
              folder: 'templates',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              isBuiltIn: true,
            }],
          }}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    expect(screen.getByText('app-shell')).toBeInTheDocument();
    expect(screen.getByText('cms-contents-list')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-type-badge-custom')).toBeInTheDocument();
    expect(screen.getAllByTestId('catalog-type-badge-builtin')).toHaveLength(2);
    expect(screen.queryByTestId('catalog-type-badge-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-type-badge-template')).not.toBeInTheDocument();
    expect(screen.getByText('blog-list')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-type-dots')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-folder-templates')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Templates' })).not.toBeInTheDocument();
  });

  it('shows saved components in the same list and keeps them editable', () => {
    const onOpenLiveDesigner = vi.fn();
    const onEditComponent = vi.fn();
    const onDuplicateComponent = vi.fn();

    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={onEditComponent}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={onDuplicateComponent}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            general: [
              {
                id: 'draft-home-hero',
                name: 'home-hero',
                folder: 'general',
                tags: ['template'],
                createdAt: '2026-08-01T10:48:14.340Z',
                updatedAt: '2026-08-12T01:06:26.543Z',
              },
              {
                id: 'draft-invoice-list',
                name: 'invoice-list',
                folder: 'general',
                tags: ['cms'],
                createdAt: '2026-08-01T10:48:14.340Z',
                updatedAt: '2026-08-12T01:06:26.543Z',
              },
            ],
          }}
          activeDraftId={null}
          loadingComponentId={null}
          onOpenLiveDesigner={onOpenLiveDesigner}
        />
      </CultureProvider>,
    );

    expect(screen.getByText('home-hero')).toBeInTheDocument();
    expect(screen.getByText('invoice-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('catalog-type-badge-custom')).toHaveLength(2);
    expect(screen.queryByTestId('catalog-card-type-dots')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-folder-templates')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-tags')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-mid')).not.toBeInTheDocument();
    expect(screen.queryByText('cms')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'home-hero' }));
    expect(onOpenLiveDesigner).toHaveBeenCalledWith('draft-home-hero');
    fireEvent.click(screen.getByLabelText('Rename home-hero'));
    expect(onEditComponent).toHaveBeenCalledWith('draft-home-hero');
  });

  it('opens Live Designer from a built-in card title and still offers Duplicate', () => {
    const onDuplicateComponent = vi.fn();
    const onOpenLiveDesigner = vi.fn();

    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={onDuplicateComponent}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            templates: [{
              id: 'builtin-blog-list',
              name: 'blog-list',
              folder: 'templates',
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              isBuiltIn: true,
            }],
          }}
          activeDraftId={null}
          loadingComponentId={null}
          onOpenLiveDesigner={onOpenLiveDesigner}
        />
      </CultureProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'blog-list' }));
    expect(onOpenLiveDesigner).toHaveBeenCalledWith('builtin-blog-list');
    expect(screen.getByTestId('catalog-type-badge-builtin')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-type-badge-template')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-type-dots')).not.toBeInTheDocument();
    expect(onDuplicateComponent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Duplicate blog-list'));
    expect(onDuplicateComponent).toHaveBeenCalledWith('builtin-blog-list');
    expect(screen.getByLabelText('Rename blog-list')).toBeInTheDocument();
  });

  it('does not show a package-source badge on installed package UI cards', () => {
    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter=""
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            general: [{
              id: 'pkg-ui-cms-cms-contents-list',
              name: 'cms-contents-list',
              folder: 'general',
              createdAt: '2026-08-01T10:48:14.340Z',
              updatedAt: '2026-08-12T01:06:26.543Z',
              isPackageComponent: true,
              packageId: 'cms',
              packageDisplayName: 'cms',
            }],
          }}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    expect(screen.getByText('cms-contents-list')).toBeInTheDocument();
    expect(screen.getByTestId('catalog-type-badge-custom')).toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-mid')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-card-tags')).not.toBeInTheDocument();
    expect(screen.queryByText('cms')).not.toBeInTheDocument();
  });

  it('locks catalog paging at 1000 without page-size or infinite switches', () => {
    render(
      <CultureProvider cultureId="us">
        <DesignerPaletteSidebar
          layout="page"
          paletteSearch=""
          onPaletteSearchChange={vi.fn()}
          onOpenCreate={vi.fn()}
          onRefreshComponents={vi.fn()}
          catalogKindFilter="custom"
          onCatalogKindFilterChange={vi.fn()}
          onEditComponent={vi.fn()}
          onEditComponentTags={vi.fn()}
          onDuplicateComponent={vi.fn()}
          onDeleteComponent={vi.fn()}
          isComponentActionBusy={false}
          isDraftsLoading={false}
          groups={{
            general: [{
              id: 'draft-cms-contents-list',
              name: 'cms-contents-list',
              folder: 'general',
              createdAt: '2026-08-01T10:48:14.340Z',
              updatedAt: '2026-08-12T01:06:26.543Z',
            }],
          }}
          activeDraftId={null}
          loadingComponentId={null}
        />
      </CultureProvider>,
    );

    expect(screen.queryByLabelText('Items per page')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('List mode')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 1-1 of 1/)).toBeInTheDocument();
  });
});
