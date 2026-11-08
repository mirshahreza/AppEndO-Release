import { describe, expect, it } from 'vitest';
import { formatAdminShellBrowserDocumentTitle } from '../adminShellDocumentTitle';

describe('formatAdminShellBrowserDocumentTitle', () => {
  it('uses only the page label and portal window title', () => {
    expect(formatAdminShellBrowserDocumentTitle(
      { label: 'All People', groupLabel: 'Person management' },
      'Dashboard',
      'Hawiyati',
    )).toBe('Hawiyati / All People');
  });

  it('uses the last title-trail segment for nested editors', () => {
    expect(formatAdminShellBrowserDocumentTitle(
      {
        label: 'All People',
        groupLabel: 'Person management',
        titleTrail: ['Edit', 'Record'],
      },
      'Dashboard',
      'Hawiyati',
    )).toBe('Hawiyati / Record');
  });

  it('omits portal suffix when window title is empty', () => {
    expect(formatAdminShellBrowserDocumentTitle(
      { label: 'Settings', groupLabel: 'Operations' },
      'Dashboard',
      '',
    )).toBe('Settings');
  });

  it('shows window title with ellipsis while the page label is loading', () => {
    expect(formatAdminShellBrowserDocumentTitle({
      module: { label: 'Dashboard', groupLabel: null },
      fallbackLabel: 'Dashboard',
      portalWindowTitle: 'Hawiyati',
      pageTitleReady: false,
    })).toBe('Hawiyati ...');
  });
});
