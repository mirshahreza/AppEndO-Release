import { describe, expect, it } from 'vitest';
import {
  isPackageStudioSidebarRoute,
  isRetiredDesignerCatalogComponent,
  packageStudioSidebarChrome,
  packageStudioSidebarLabel,
  sortPackageStudioSidebarItems,
} from '../packageStudioSidebar';

describe('packageStudioSidebar', () => {
  it('keeps Contents and Settings and skips editor, vocab, and comments', () => {
    expect(isPackageStudioSidebarRoute('cms-contents-list')).toBe(true);
    expect(isPackageStudioSidebarRoute('cms-settings')).toBe(true);
    expect(isPackageStudioSidebarRoute('cms-contents-editor')).toBe(false);
    expect(isPackageStudioSidebarRoute('cms-vocab-languages')).toBe(false);
    expect(isPackageStudioSidebarRoute('cms-comments')).toBe(false);
    expect(isPackageStudioSidebarRoute('cms-site-home')).toBe(false);
    expect(isPackageStudioSidebarRoute('cms-site-article')).toBe(false);
  });

  it('hides the retired standalone CMS comments page from Client Components', () => {
    expect(isRetiredDesignerCatalogComponent('cms-comments')).toBe(true);
    expect(isRetiredDesignerCatalogComponent('CMS-Comments')).toBe(true);
    expect(isRetiredDesignerCatalogComponent('cms-contents-list')).toBe(false);
  });

  it('uses the CMS sidebar labels and live Studio routes', () => {
    expect(packageStudioSidebarLabel('cms-contents-list', 'Cms Contents List')).toBe('Contents');
    expect(packageStudioSidebarLabel('cms-settings', 'Cms Settings')).toBe('Settings');
    expect(packageStudioSidebarLabel('crm-contacts', 'Contacts')).toBe('Contacts');
    expect(packageStudioSidebarChrome('cms-contents-list')).toMatchObject({
      icon: 'Newspaper',
      routePattern: 'cms/contents',
    });
    expect(packageStudioSidebarChrome('rdp-hub')).toMatchObject({
      label: 'RDP',
      routePattern: 'rdp/*',
      group: 'Remote Hubs',
    });
    expect(packageStudioSidebarChrome('ssh-hub')?.label).toBe('SSH');
    expect(packageStudioSidebarChrome('file-hub')).toMatchObject({
      label: 'Sftp',
      routePattern: 'sftp/*',
    });
  });

  it('keeps Settings last even when it is listed first', () => {
    expect(sortPackageStudioSidebarItems([
      { pageKey: 'cms-settings' },
      { pageKey: 'cms-contents-list' },
    ]).map((item) => item.pageKey)).toEqual([
      'cms-contents-list',
      'cms-settings',
    ]);
  });
});
