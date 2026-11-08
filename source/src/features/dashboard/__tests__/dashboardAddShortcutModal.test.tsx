// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardMyShortcuts } from '../components/DashboardMyShortcuts';
import type { DashboardShortcutTarget } from '../dashboardShortcutPicker';

vi.mock('../../../core/culture/CultureContext', () => ({
  useCultureT: () => (key: string) => {
    const labels: Record<string, string> = {
      'actions.cancel': 'Cancel',
      'dashboard.myShortcuts.addLink': 'Add link',
      'dashboard.myShortcuts.addQueryParam': 'Add parameter',
      'dashboard.myShortcuts.appearance': 'Appearance',
      'dashboard.myShortcuts.chooseIcon': 'Choose icon',
      'dashboard.myShortcuts.empty': 'Drag a sidebar page here, pin it from the menu, or add a link.',
      'dashboard.myShortcuts.label': 'Label',
      'dashboard.myShortcuts.parameters': 'Parameters',
      'dashboard.myShortcuts.preview': 'Address',
      'dashboard.myShortcuts.queryName': 'Name',
      'dashboard.myShortcuts.queryValue': 'Value',
      'dashboard.myShortcuts.recordKey': 'Record',
      'dashboard.myShortcuts.search': 'Search pages',
      'dashboard.myShortcuts.selectPageHint': 'Choose a page on the left, then set a title, icon, and optional parameters.',
      'dashboard.myShortcuts.customLink': 'Custom link',
      'dashboard.myShortcuts.selectCustomLinkHint': 'Enter an address, then set a title and icon for Home.',
      'dashboard.myShortcuts.path': 'Address',
      'dashboard.myShortcuts.pathHint': 'A Studio path such as /studio/data-studio, or a web address.',
      'dashboard.myShortcuts.pathInvalid': 'Enter a Studio path or a web address.',
      'dashboard.myShortcuts.subtitle': 'Pin pages from the sidebar, or add your own links.',
      'dashboard.myShortcuts.title': 'My Shortcuts',
    };
    return labels[key] ?? key;
  },
}));

const addHomeShortcut = vi.fn(() => true);

vi.mock('../../../contexts/DashboardLayoutContext', () => ({
  useDashboardLayout: () => ({
    homeShortcuts: [],
    addHomeShortcut,
    removeHomeShortcut: vi.fn(),
    widgetChrome: {},
    isDesigning: false,
  }),
}));

vi.mock('../../../shared/ui/appFeedbackToast', () => ({
  showAppFeedbackToast: vi.fn(),
}));

const targets: DashboardShortcutTarget[] = [
  {
    id: 'workflows:/us/studio/workflows',
    pageKey: 'workflows',
    label: 'Workflows',
    path: '/us/studio/workflows',
    icon: 'Workflow',
    group: 'Development',
    itemMode: 'edit',
  },
  {
    id: 'users:/us/studio/users',
    pageKey: 'users',
    label: 'Users',
    path: '/us/studio/users',
    group: 'Records',
    itemMode: null,
  },
];

vi.mock('../hooks/useDashboardShortcutTargets', () => ({
  useDashboardShortcutTargets: () => targets,
}));

describe('DashboardMyShortcuts add-link modal', () => {
  afterEach(() => {
    cleanup();
    addHomeShortcut.mockClear();
  });

  it('opens a maximized picker with page targets and a custom link entry', () => {
    render(<DashboardMyShortcuts />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Custom link' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Workflows' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Users' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search pages')).toBeInTheDocument();
    expect(screen.getByText('Choose a page on the left, then set a title, icon, and optional parameters.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('lets the operator add a free-form Studio path or web address', () => {
    render(<DashboardMyShortcuts />);
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Custom link' })[0]!);

    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Docs' } });
    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'https://example.com/docs' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add link' })[1]!);

    expect(addHomeShortcut).toHaveBeenCalledWith({
      id: 'custom:https://example.com/docs',
      kind: 'custom',
      path: 'https://example.com/docs',
      label: 'Docs',
    });
  });

  it('lets the operator pick a page, attach a record key, and confirm', () => {
    render(<DashboardMyShortcuts />);
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workflows' }));

    expect(screen.getByText('Record')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Record'), { target: { value: 'order-approval' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add link' })[1]!);

    expect(addHomeShortcut).toHaveBeenCalledWith({
      id: 'custom:/us/studio/workflows/edit/order-approval',
      kind: 'custom',
      pageKey: 'workflows',
      path: '/us/studio/workflows/edit/order-approval',
      label: 'Workflows',
      icon: 'Workflow',
    });
  });
});
