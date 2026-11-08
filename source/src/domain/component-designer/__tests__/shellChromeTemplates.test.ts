import { describe, expect, it } from 'vitest';
import { createInitialDesignerState } from '../state';
import { canInsertTemplateSeeds } from '../builtInTemplateClone';
import { buildShellChromePaletteItems } from '../shellChromePalette';
import {
  resolveShellChromeTemplateSeeds,
  SHELL_ADMIN_SIDEBAR_TEMPLATE,
  SHELL_HEADER_BAR_TEMPLATE,
} from '../shellChromeTemplates';

describe('shellChromeTemplates', () => {
  it('exposes palette items for all shell chrome blocks', () => {
    const items = buildShellChromePaletteItems();
    expect(items.length).toBeGreaterThanOrEqual(15);
    expect(items.map((item) => item.id)).toContain('shell.chrome.header-region');
    expect(items.map((item) => item.id)).toContain('shell.chrome.slot-logo');
    expect(items.every((item) => item.category === 'platform-workspace')).toBe(true);
    expect(items.map((item) => item.id)).toContain('shell.chrome.sidebar');
    expect(items.map((item) => item.id)).toContain('shell.chrome.header');
    expect(items.map((item) => item.id)).toContain('shell.chrome.sticky-action-bar');
    expect(items.map((item) => item.id)).toContain('shell.chrome.route-outlet');
    expect(items.map((item) => item.id)).toContain('shell.chrome.app-layout');
  });

  it('resolves admin sidebar template with logo, portal menu, and platform navigation', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.sidebar');
    expect(seeds).toEqual(SHELL_ADMIN_SIDEBAR_TEMPLATE);

    const root = seeds?.[0];
    expect(root?.type).toBe('container');
    expect(root?.children?.some((child) => child.type === 'system-slot' && child.props?.slotId === 'core.shell.sidebar-toggle')).toBe(true);

    const navSeed = JSON.stringify(seeds);
    expect(navSeed).toContain('core:TreeNavTwoLevel');
    expect(navSeed).toContain('navigationRef');
    expect(navSeed).toContain('core.shell.logo');
    expect(navSeed).toContain('core.shell.portal-menu');
    expect(navSeed).not.toContain('menu-line-pattern');
    expect(navSeed).not.toContain('header-line-pattern');
    expect(navSeed).not.toContain('shell-chrome-trim');
  });

  it('resolves header bar template with shell header slot', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.header');
    expect(seeds).toEqual(SHELL_HEADER_BAR_TEMPLATE);
    expect(seeds?.[0]?.children?.[0]?.props?.slotId).toBe('core.shell.header');
    expect(JSON.stringify(seeds)).not.toContain('header-line-pattern');
    expect(JSON.stringify(seeds)).not.toContain('menu-line-pattern');
  });

  it('resolves custom header region as an empty styled container', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.header-region');
    expect(seeds?.[0]?.type).toBe('container');
    expect(seeds?.[0]?.children).toEqual([]);
    expect(seeds?.[0]?.props?.className).toContain('admin-shell-chrome');
  });

  it('resolves shell logo slot shortcut', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.slot-logo');
    expect(seeds?.[0]?.type).toBe('system-slot');
    expect(seeds?.[0]?.props?.slotId).toBe('core.shell.logo');
  });

  it('allows inserting children into custom header region roots', () => {
    const state = createInitialDesignerState();
    const root = state.document.nodes[state.document.rootNodeId];
    const headerRegionSeeds = resolveShellChromeTemplateSeeds('shell.chrome.header-region');
    expect(headerRegionSeeds).not.toBeNull();
    expect(canInsertTemplateSeeds(headerRegionSeeds!, root)).toBe(true);

    const headerRegionItem = buildShellChromePaletteItems().find((item) => item.id === 'shell.chrome.header-region');
    expect(headerRegionItem?.canHaveChildren).toBe(true);
  });

  it('resolves route outlet template with core.shell.route-outlet slot', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.route-outlet');
    expect(seeds?.[0]?.children?.[0]?.type).toBe('system-slot');
    expect(seeds?.[0]?.children?.[0]?.props?.slotId).toBe('core.shell.route-outlet');
  });

  it('resolves full app shell layout template', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.app-layout');
    expect(seeds).not.toBeNull();
    expect(JSON.stringify(seeds)).toContain('core.shell.route-outlet');
  });

  it('resolves sticky action bar template with placeholder content and buttons', () => {
    const seeds = resolveShellChromeTemplateSeeds('shell.chrome.sticky-action-bar');
    expect(seeds).not.toBeNull();
    expect(seeds?.[0]?.type).toBe('container');
    expect(seeds?.[0]?.props?.className).toContain('sticky bottom-0');
    expect(JSON.stringify(seeds)).toContain('Save Changes');
  });

  it('resolves error and not-found shell page presets', () => {
    const errorSeeds = resolveShellChromeTemplateSeeds('shell.error-page');
    const notFoundSeeds = resolveShellChromeTemplateSeeds('shell.not-found');
    expect(errorSeeds).not.toBeNull();
    expect(notFoundSeeds).not.toBeNull();
    expect(JSON.stringify(errorSeeds)).toContain('Something went wrong');
    expect(JSON.stringify(notFoundSeeds)).toContain('Page not found');
  });

  it('bug found (P3.19): "Go to dashboard" button links to a real path, not the palette default dead href="#"', () => {
    const errorSeeds = resolveShellChromeTemplateSeeds('shell.error-page');
    const notFoundSeeds = resolveShellChromeTemplateSeeds('shell.not-found');
    expect(JSON.stringify(errorSeeds)).toContain('"href":"/"');
    expect(JSON.stringify(notFoundSeeds)).toContain('"href":"/"');
    expect(JSON.stringify(errorSeeds)).not.toContain('"href":"#"');
    expect(JSON.stringify(notFoundSeeds)).not.toContain('"href":"#"');
  });

  it('allows inserting shell chrome templates into document root', () => {
    const state = createInitialDesignerState();
    const root = state.document.nodes[state.document.rootNodeId];
    const sidebarSeeds = resolveShellChromeTemplateSeeds('shell.chrome.sidebar');
    expect(sidebarSeeds).not.toBeNull();
    expect(canInsertTemplateSeeds(sidebarSeeds!, root)).toBe(true);
  });
});
