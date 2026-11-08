/**
 * @vitest-environment jsdom
 * Phase T1-32 — Dynamic palette audit (Shell Chrome, Platform Slots, Platform Navigation, Reusable).
 */
import * as React from 'react';
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CORE_SLOT_CATALOG } from '../../../shared/api/contracts/slots/catalog';
import {
  PLATFORM_NAV_COMPONENT_CATALOG,
  PLATFORM_NAV_TREE_TWO_LEVEL,
} from '../../../shared/api/contracts/platform/platformNavigationComponents';
import {
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
  SHELL_CHROME_DEFAULT_NAVIGATION_REF,
} from '../../../shared/lib/shellNavigationProps';
import { SHELL_NAV_SLOT_NAVIGATION_REF_PROP } from '../../../shared/lib/shellNavSlotProps';
import { isShellNavRegionSlotId } from '../../../shared/lib/shellNavRegions';
import { getBindingCapabilityRow } from '../bindingCapabilityMatrix';
import { generateDesignerTsx } from '../codegen';
import {
  getDesignerPaletteCatalog,
  resetDesignerPaletteCatalog,
  setDesignerPaletteCatalog,
} from '../catalog';
import { renderDesignerDocumentPreview } from '../designerRuntimePreview';
import { buildPlatformNavigationPaletteItems, toPlatformNavPaletteItemId } from '../navigationComponentPalette';
import { buildReusablePaletteItems, toReusablePaletteItemId } from '../reusablePalette';
import { buildShellChromePaletteItems } from '../shellChromePalette';
import { resolveShellChromeTemplateSeeds } from '../shellChromeTemplates';
import { buildSlotPaletteItems, toSlotPaletteItemId } from '../slotPalette';
import { createInitialDesignerState, designerReducer } from '../state';
import type { DesignerState } from '../types';

vi.mock('../../../app/platform/PlatformConfigProvider', () => {
  const value = {
    config: {
      version: 'application-host-v1',
      mounts: [{ id: 'studio', enabled: true, pathPrefix: '/studio' }],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
      navigations: [],
    },
  };
  return {
    usePlatformConfig: () => value,
    useOptionalPlatformConfig: () => value,
  };
});

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
  }),
}));

vi.mock('../../../app/platform/PlatformMountContext', () => ({
  usePlatformMount: () => ({
    mountId: 'studio',
    pathPrefix: '/studio',
  }),
  useOptionalPlatformMount: () => ({
    id: 'studio',
    enabled: true,
    pathPrefix: '/studio',
  }),
}));

vi.mock('../../../app/platform/PortalContext', () => ({
  useOptionalPortal: () => ({
    portalSegment: 'studio',
    shellKey: 'admin',
    pageRemainderPath: '/',
  }),
}));

vi.mock('../../../app/platform/DesignerPublishedShellChrome', () => ({
  useDesignerPublishedShellMobileMenuOpen: () => [false, () => {}],
  useDesignerPublishedShellSidebarCollapsed: () => false,
  DesignerPublishedShellChromeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../../layouts/adminShell/useAdminShellNav', () => ({
  useAdminShellNav: () => [],
}));

const SHELL_CHROME_ITEM_IDS = buildShellChromePaletteItems().map((item) => item.id);

const PLATFORM_SLOT_ITEM_IDS = buildSlotPaletteItems(CORE_SLOT_CATALOG).map((item) => item.id);

const PLATFORM_NAV_ITEM_IDS = buildPlatformNavigationPaletteItems().map((item) => item.id);

const REUSABLE_FIXTURE = { id: 'hero-banner', name: 'Hero Banner', folder: 'marketing' };
const REUSABLE_ITEM_IDS = buildReusablePaletteItems([REUSABLE_FIXTURE]).map((item) => item.id);

const mergeDynamicPalette = (): void => {
  setDesignerPaletteCatalog([
    ...getDesignerPaletteCatalog(),
    ...buildShellChromePaletteItems(),
    ...buildSlotPaletteItems(CORE_SLOT_CATALOG),
    ...buildPlatformNavigationPaletteItems(),
    ...buildReusablePaletteItems([REUSABLE_FIXTURE]),
  ]);
};

const renderPreview = (document: DesignerState['document']) =>
  render(
    <MemoryRouter>
      {renderDesignerDocumentPreview(document)}
    </MemoryRouter>,
  );

const insertItem = (state: DesignerState, itemId: string, parentId?: string): DesignerState =>
  designerReducer(state, {
    type: 'insert-palette-item',
    itemId,
    parentId: parentId ?? state.document.rootNodeId,
  });

const lastChildId = (state: DesignerState, parentId: string): string => {
  const parent = state.document.nodes[parentId];
  return parent.children[parent.children.length - 1] as string;
};

const collectPlatformNavNodes = (state: DesignerState) =>
  Object.values(state.document.nodes).filter((node) => node.type === 'platform-nav');

const collectSystemSlotNodes = (state: DesignerState) =>
  Object.values(state.document.nodes).filter((node) => node.type === 'system-slot');

describe('T1-32 Dynamic palette discovery', () => {
  it('discovers 17 shell-chrome palette items', () => {
    expect(SHELL_CHROME_ITEM_IDS).toHaveLength(17);
    expect(SHELL_CHROME_ITEM_IDS).toEqual([
      'shell.chrome.sidebar',
      'shell.chrome.header',
      'shell.chrome.header-region',
      'shell.chrome.slot-logo',
      'shell.chrome.slot-portal-menu',
      'shell.chrome.slot-header-actions',
      'shell.chrome.slot-sidebar-toggle',
      'shell.chrome.sidebar-nav-tree',
      'shell.chrome.sidebar-nav-mega',
      'shell.chrome.sidebar-nav-drawer',
      'shell.chrome.top-nav-bar',
      'shell.chrome.footer-links',
      'shell.chrome.sticky-action-bar',
      'shell.chrome.route-outlet',
      'shell.chrome.app-layout',
      'shell.error-page',
      'shell.not-found',
    ]);
  });

  it('discovers platform-slot palette items from CORE_SLOT_CATALOG', () => {
    expect(PLATFORM_SLOT_ITEM_IDS).toHaveLength(CORE_SLOT_CATALOG.length);
    expect(PLATFORM_SLOT_ITEM_IDS).toEqual(
      CORE_SLOT_CATALOG.map((entry) => toSlotPaletteItemId(entry.id)),
    );
  });

  it('discovers 5 platform-navigation palette items', () => {
    expect(PLATFORM_NAV_ITEM_IDS).toHaveLength(PLATFORM_NAV_COMPONENT_CATALOG.length);
    expect(PLATFORM_NAV_ITEM_IDS).toEqual(
      PLATFORM_NAV_COMPONENT_CATALOG.map((entry) => toPlatformNavPaletteItemId(entry.id)),
    );
  });

  it('discovers reusable palette items from published component summaries', () => {
    expect(REUSABLE_ITEM_IDS).toEqual([toReusablePaletteItemId(REUSABLE_FIXTURE.id)]);
  });
});

describe('T1-32 Dynamic palette audit', () => {
  beforeAll(() => {
    mergeDynamicPalette();
  });

  afterAll(() => {
    resetDesignerPaletteCatalog();
  });

  afterEach(() => {
    cleanup();
  });

  describe('shell-chrome', () => {
    it.each(SHELL_CHROME_ITEM_IDS)('inserts %s template without validation errors', (itemId) => {
      const seeds = resolveShellChromeTemplateSeeds(itemId);
      expect(seeds, `${itemId} must resolve template seeds`).not.toBeNull();

      const state = insertItem(createInitialDesignerState(), itemId);
      expect(state.document.diagnostics.filter((d) => d.level === 'error')).toHaveLength(0);
      expect(() => renderPreview(state.document)).not.toThrow();
    });

    it('sidebar template seeds platform-nav with default navigation props', () => {
      const state = insertItem(createInitialDesignerState(), 'shell.chrome.sidebar');
      const navNodes = collectPlatformNavNodes(state);
      expect(navNodes.length).toBeGreaterThan(0);
      for (const node of navNodes) {
        expect(node.props[SHELL_NAVIGATION_COMPONENT_KEY_PROP]).toBeTruthy();
        expect(node.props[SHELL_NAVIGATION_REF_PROP]).toBe(SHELL_CHROME_DEFAULT_NAVIGATION_REF);
      }
    });

    it('error-page and not-found templates render branded copy in preview', () => {
      for (const itemId of ['shell.error-page', 'shell.not-found'] as const) {
        const state = insertItem(createInitialDesignerState(), itemId);
        const { container } = renderPreview(state.document);
        expect(container.textContent).toMatch(/Something went wrong|Page not found/);
      }
    });
  });

  describe('platform-slots', () => {
    it.each(PLATFORM_SLOT_ITEM_IDS)('renders %s in canvas preview without throwing', (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      expect(() => renderPreview(state.document)).not.toThrow();
    });

    it.each(PLATFORM_SLOT_ITEM_IDS)('exports slotId for %s in generated TSX', (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const slotId = CORE_SLOT_CATALOG.find((entry) => toSlotPaletteItemId(entry.id) === itemId)?.id;
      expect(slotId).toBeTruthy();
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain(`slotId="${slotId}"`);
    });

    it.each(PLATFORM_SLOT_ITEM_IDS)(
      // Bug found (cluster F): platform.slot.* nodes had no entry in tsxComponentRegistry.ts,
      // so generateDesignerTsx fell through to the generic HTML-container path and exported
      // a plain `<div slotId="..." label="..." surface="...">` — inert markup with no actual
      // slot-resolution behavior — instead of the real DesignerSlotPreview runtime component
      // that the live designer preview already uses (designerRuntimePreview.tsx). Fixed via
      // tsxPlatformPalette.ts + tsxComponentRegistry.ts.
      'exports the real DesignerSlotPreview component (not a bare div) for %s',
      (itemId) => {
        const state = insertItem(createInitialDesignerState(), itemId);
        const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
        expect(tsx).toContain('<DesignerSlotPreview');
        expect(tsx).toContain(
          "import { DesignerSlotPreview } from '@/features/component-designer/components/DesignerSlotPreview';",
        );
        expect(tsx).not.toMatch(/<div[^>]*\sslotId=/);
      },
    );

    it('nav region slots reflect navigationRef changes in preview and export', () => {
      const navSlotId = CORE_SLOT_CATALOG.find((entry) => isShellNavRegionSlotId(entry.id))?.id;
      expect(navSlotId).toBeTruthy();
      const paletteItemId = toSlotPaletteItemId(navSlotId!);

      let state = insertItem(createInitialDesignerState(), paletteItemId);
      const nodeId = lastChildId(state, state.document.rootNodeId);

      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: SHELL_NAV_SLOT_NAVIGATION_REF_PROP,
        value: 'crm-main',
      });

      const { container } = renderPreview(state.document);
      expect(container.textContent).toContain('crm-main');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      // Bug found (parity audit item 86): navigationRef must live in slotProps only —
      // a flat navigationRef="..." attribute on DesignerSlotPreview was invalid/duplicated HTML.
      expect(tsx).toContain('"navigationRef":"crm-main"');
      expect(tsx).not.toMatch(/\snavigationRef=/);
    });
  });

  describe('platform-navigation', () => {
    it.each(PLATFORM_NAV_ITEM_IDS)('renders %s with PlatformNavigationHost in preview', (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const { container } = renderPreview(state.document);
      const meta = PLATFORM_NAV_COMPONENT_CATALOG.find(
        (entry) => toPlatformNavPaletteItemId(entry.id) === itemId,
      );
      expect(meta).toBeTruthy();
      expect(
        container.querySelector(`[data-platform-nav-component="${meta!.id}"]`),
      ).not.toBeNull();
    });

    it.each(PLATFORM_NAV_ITEM_IDS)(
      'preserves componentKey and navigationRef in export for %s',
      (itemId) => {
        const state = insertItem(createInitialDesignerState(), itemId);
        const nodeId = lastChildId(state, state.document.rootNodeId);
        const componentKey = state.document.nodes[nodeId].props[SHELL_NAVIGATION_COMPONENT_KEY_PROP];

        let next = designerReducer(state, {
          type: 'set-node-prop',
          nodeId,
          key: SHELL_NAVIGATION_REF_PROP,
          value: 'portal-alpha',
        });

        const tsx = generateDesignerTsx(next.document, next.bindingDefinitions);
        expect(tsx).toContain(`componentKey="${componentKey}"`);
        expect(tsx).toContain('navigationRef="portal-alpha"');
      },
    );

    it.each(PLATFORM_NAV_ITEM_IDS)(
      // Bug found (cluster F): platform.nav.* nodes had no entry in tsxComponentRegistry.ts,
      // so generateDesignerTsx fell through to the generic HTML-container path and exported
      // a plain `<div componentKey="..." navigationRef="...">` — inert markup with none of
      // the real navigation-rendering logic — instead of the real PlatformNavigationHost
      // runtime component the live designer preview already uses (data-platform-nav-component
      // test above proves the preview is correct). Fixed via tsxPlatformPalette.ts +
      // tsxComponentRegistry.ts.
      'exports the real PlatformNavigationHost component (not a bare div) for %s',
      (itemId) => {
        const state = insertItem(createInitialDesignerState(), itemId);
        const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
        expect(tsx).toContain('<PlatformNavigationHost');
        expect(tsx).toContain(
          "import { PlatformNavigationHost } from '@/layouts/adminShell/nav/PlatformNavigationHost';",
        );
        expect(tsx).not.toMatch(/<div[^>]*\scomponentKey=/);
      },
    );

    it('preview and document agree after navigationRef + componentKey inspector changes', () => {
      let state = insertItem(createInitialDesignerState(), PLATFORM_NAV_ITEM_IDS[0]);
      const nodeId = lastChildId(state, state.document.rootNodeId);

      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: SHELL_NAVIGATION_REF_PROP,
        value: 'studio',
      });
      state = designerReducer(state, {
        type: 'set-node-prop',
        nodeId,
        key: SHELL_NAVIGATION_COMPONENT_KEY_PROP,
        value: PLATFORM_NAV_TREE_TWO_LEVEL,
      });

      const node = state.document.nodes[nodeId];
      expect(node.props[SHELL_NAVIGATION_REF_PROP]).toBe('studio');
      expect(node.props[SHELL_NAVIGATION_COMPONENT_KEY_PROP]).toBe(PLATFORM_NAV_TREE_TWO_LEVEL);

      const { container } = renderPreview(state.document);
      const host = container.querySelector(
        `[data-platform-nav-component="${PLATFORM_NAV_TREE_TWO_LEVEL}"]`,
      );
      expect(host).not.toBeNull();
      expect(host?.getAttribute('data-navigation-ref')).toBe('studio');

      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain(`componentKey="${PLATFORM_NAV_TREE_TWO_LEVEL}"`);
      expect(tsx).toContain('navigationRef="studio"');
    });

    it.each(PLATFORM_NAV_ITEM_IDS)('has no data-binding capability for %s', (itemId) => {
      const row = getBindingCapabilityRow(itemId);
      expect(row?.bindingStatus ?? 'none').toBe('none');
    });
  });

  describe('reusable-components', () => {
    it.each(REUSABLE_ITEM_IDS)('renders %s reusable placeholder in preview', (itemId) => {
      const state = insertItem(createInitialDesignerState(), itemId);
      const { container } = renderPreview(state.document);
      expect(container.textContent).toContain(REUSABLE_FIXTURE.name);
      expect(container.querySelector(`[data-designer-reusable-preview="${REUSABLE_FIXTURE.id}"]`)).not.toBeNull();
    });

    it('exports componentId for reusable slot in generated TSX', () => {
      const state = insertItem(createInitialDesignerState(), REUSABLE_ITEM_IDS[0]);
      const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
      expect(tsx).toContain(`componentId="${REUSABLE_FIXTURE.id}"`);
      expect(tsx).toContain(`label="${REUSABLE_FIXTURE.name}"`);
    });

    it.each(REUSABLE_ITEM_IDS)('has no data-binding capability for %s', (itemId) => {
      const row = getBindingCapabilityRow(itemId);
      expect(row?.bindingStatus ?? 'none').toBe('none');
    });
  });
});
