import { describe, expect, it } from 'vitest';
import { ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX } from '../../adminShellSidebarWidth';
import { resolveLayoutWidthChromeFromAppearance } from '../shellLayoutWidthAppearance';

const baseSession = {
  portalDefaults: {
    version: 1 as const,
    layoutWidth: 'bounded' as const,
    layoutWidthUserControl: true,
  },
  effective: {
    sidebarCollapsed: false,
    sidebarCollapsePolicy: 'rail' as const,
    allowUserSidebarPreference: true,
    sidebarExpandedWidthPx: ADMIN_SHELL_SIDEBAR_WIDTH_EXPANDED_DEFAULT_PX,
    layoutWidth: 'bounded' as const,
    layoutWidthUserControl: true,
    navExpandedGroups: [],
  },
};

describe('resolveLayoutWidthChromeFromAppearance', () => {
  it('uses fluid chrome when portal default is fluid', () => {
    const state = resolveLayoutWidthChromeFromAppearance({
      ...baseSession,
      portalDefaults: { ...baseSession.portalDefaults, layoutWidth: 'fluid' },
      effective: { ...baseSession.effective, layoutWidth: 'fluid' },
    });
    expect(state.activeWidth).toBe('fluid');
    expect(state.canUserToggle).toBe(true);
    expect(state.expanded).toBe(true);
  });

  it('honors user bounded override when portal default is fluid', () => {
    const state = resolveLayoutWidthChromeFromAppearance({
      ...baseSession,
      portalDefaults: { ...baseSession.portalDefaults, layoutWidth: 'fluid' },
      effective: { ...baseSession.effective, layoutWidth: 'bounded' },
    });
    expect(state.activeWidth).toBe('bounded');
    expect(state.canUserToggle).toBe(true);
    expect(state.expanded).toBe(false);
  });

  it('allows expand when portal is bounded and effective layout is fluid', () => {
    const state = resolveLayoutWidthChromeFromAppearance({
      ...baseSession,
      effective: { ...baseSession.effective, layoutWidth: 'fluid' },
    });
    expect(state.canUserToggle).toBe(true);
    expect(state.expanded).toBe(true);
    expect(state.activeWidth).toBe('fluid');
  });
});
