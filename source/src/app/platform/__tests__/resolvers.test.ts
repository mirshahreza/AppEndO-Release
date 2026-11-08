import { describe, expect, it } from 'vitest';
import { resolvePageModule, resolveShellComponent } from '../resolvers';

describe('platform resolvers', () => {
  it('resolves core shell entries lazily', () => {
    const adminShell = resolveShellComponent('core:AdminLayout');
    const appShell = resolveShellComponent('core:AppShell');
    const siteShell = resolveShellComponent('core:SiteLayout');
    const aloneShell = resolveShellComponent('core:ComponentAlone');
    const designerShell = resolveShellComponent('core:DesignerShell');

    expect(adminShell).toBeTruthy();
    expect(appShell).toBeTruthy();
    expect(siteShell).toBeTruthy();
    expect(aloneShell).toBeTruthy();
    expect(designerShell).toBeTruthy();
    expect(resolveShellComponent('core:AdminLayout')).toBe(adminShell);
    expect(resolveShellComponent('package:demo:shell')).toBeNull();
  });

  it('resolves designer shell entries', () => {
    const customShell = resolveShellComponent('designer:portal-layouts/my-portal');
    expect(customShell).toBeTruthy();
    expect(resolveShellComponent('designer:portal-layouts/my-portal')).toBe(customShell);
  });

  it('resolves seeded studio page modules', () => {
    expect(resolvePageModule('core:Dashboard')?.component).toBeTruthy();
    expect(resolvePageModule('core:Users')?.component).toBeTruthy();
    expect(resolvePageModule('core:ComponentDesigner')?.lazy).toBe(true);
    expect(resolvePageModule('core:Git')?.lazy).toBe(true);
    expect(resolvePageModule('core:SshHub')).toBeNull();
    expect(resolvePageModule('core:CmsSiteHome')).toBeNull();
    expect(resolvePageModule('package:demo:page')).toBeNull();
  });
});
