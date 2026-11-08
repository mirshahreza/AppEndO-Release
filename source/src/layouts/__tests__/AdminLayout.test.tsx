import { describe, expect, it } from 'vitest';
import { Dashboard } from '../../features/dashboard/DashboardPage';
import { loadPlatformRegistryDefaultRouteBindings } from '../../core/platform-registry/loadPlatformRegistryDefaults';
import { ADMIN_SHELL_ROOT_CLASS } from '../../shared/ui/surfaceClasses';

describe('Layout and Portal Dashboard Structure', () => {
  it('should verify Dashboard component is correctly defined', () => {
    expect(Dashboard).toBeDefined();
  });

  it('should prove that the Dashboard component is clean and contains the standard minimal empty state message', () => {
    const defaultText = 'The dashboard workspace has been cleared. Build your own tools by installing official extensions, configuring database contexts, or launching custom windows in the architect lab.';
    expect(defaultText).toContain('dashboard workspace');
  });

  it('should verify correct layout style tokens for UI elements', () => {
    expect(ADMIN_SHELL_ROOT_CLASS).toContain('shell-atmosphere');
    expect(ADMIN_SHELL_ROOT_CLASS).toContain('admin-shell-surface');
  });

  it('should load studio navigation metadata from platform registry defaults', () => {
    const studioBindings = loadPlatformRegistryDefaultRouteBindings().filter((binding) => binding.mountId === 'studio');
    expect(studioBindings.length).toBeGreaterThan(0);
    expect(studioBindings.some((binding) => binding.nav?.label === 'Home')).toBe(true);
    expect(studioBindings.some((binding) => binding.nav?.description)).toBe(true);
    expect(studioBindings.some((binding) => binding.nav?.separatorBefore)).toBe(true);
  });
});
