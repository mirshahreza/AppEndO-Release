// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AdminShellNavGroup } from '../../types';
import { TreeNavTwoLevel } from '../TreeNavTwoLevel';
import { setDashboardDesignMode } from '../../../../shared/lib/dashboardHomeShortcuts';

vi.mock('../../../../shared/lib/useViewportTier', () => ({
  useViewportTier: () => 'desktop',
}));

vi.mock('../../../../shared/ui/UiTooltip', () => ({
  UiTooltip: ({ children }: { children: unknown }) => children,
}));

const groups: AdminShellNavGroup[] = [
  {
    heading: 'Platform',
    icon: 'Home',
    items: [
      {
        label: 'Dashboard',
        path: '/studio',
        icon: 'Home',
      },
    ],
  },
  {
    heading: 'Settings',
    icon: 'Settings',
    items: [
      {
        label: 'Users',
        path: '/studio/users',
        icon: 'Settings',
      },
    ],
  },
];

describe('TreeNavTwoLevel', () => {
  afterEach(() => {
    setDashboardDesignMode(false);
    cleanup();
  });

  it('keeps the active group expanded and blocks collapsing it', () => {
    const onExpandedGroupsChange = vi.fn();

    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));

    expect(onExpandedGroupsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();
  });

  it('renders navigation items as anchor links', () => {
    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const dashboardLink = screen.getByRole('link', { name: /Dashboard/i });
    expect(dashboardLink.getAttribute('href')).toBe('/studio');
    expect(dashboardLink.getAttribute('aria-current')).toBe('page');
    expect(dashboardLink.className).toContain('admin-nav-item-active');
    expect(dashboardLink.className).not.toContain('admin-nav-item-collapsed');
    expect(dashboardLink.querySelector('.admin-nav-item-label')?.className).toContain('text-xs');
    expect(dashboardLink.querySelector('.admin-nav-item-label-sizer')?.getAttribute('aria-hidden')).toBe('true');
    expect(dashboardLink.querySelector('.admin-nav-item-label-text')?.textContent).toBe('Dashboard');
    const usersLink = screen.getByRole('link', { name: /Users/i });
    expect(usersLink.getAttribute('aria-current')).toBeNull();
    expect(usersLink.querySelector('.admin-nav-item-label')?.className).toContain('text-xs');
    expect(usersLink.className).not.toContain('admin-nav-item-active');
    expect(screen.getByRole('button', { name: /Platform/i }).getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('button', { name: /Platform/i }).getAttribute('data-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Platform/i }).className).toContain('admin-nav-group-header');
    expect(screen.getByRole('button', { name: /Settings/i }).className).toContain('admin-nav-group-header');
    expect(screen.getByRole('button', { name: /Settings/i }).getAttribute('data-active')).toBeNull();
  });

  it('renders nested children indented under their parent item', () => {
    const nestedGroups: AdminShellNavGroup[] = [
      {
        heading: 'Development',
        items: [
          {
            label: 'Data Studio',
            path: '/studio/data-studio',
            icon: 'Database',
            children: [
              { label: 'SQL Console', path: '/studio/sql-console', icon: 'Terminal' },
              { label: 'Data Sources', path: '/studio/data-sources', icon: 'Database' },
            ],
          },
        ],
      },
    ];

    render(
      <TreeNavTwoLevel
        groups={nestedGroups}
        pathname="/studio/sql-console"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Development'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByRole('link', { name: /Data Studio/i }).getAttribute('href')).toBe('/studio/data-studio');
    const sqlLink = screen.getByRole('link', { name: /SQL Console/i });
    expect(sqlLink.getAttribute('href')).toBe('/studio/sql-console');
    expect(sqlLink.className).toContain('admin-nav-item-nested');
    expect(sqlLink.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: /Data Sources/i }).className).toContain('admin-nav-item-nested');
  });

  it('uses the same active row recipe for grouped items as for Home', () => {
    const mixedGroups: AdminShellNavGroup[] = [
      {
        items: [{ label: 'Home', path: '/studio', icon: 'Home' }],
      },
      {
        heading: 'CMS',
        icon: 'Layout',
        items: [{ label: 'Contents', path: '/studio/cms', icon: 'FileText' }],
      },
    ];

    render(
      <TreeNavTwoLevel
        groups={mixedGroups}
        pathname="/studio/cms"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['CMS'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const homeLink = screen.getByRole('link', { name: /^Home$/i });
    const contentsLink = screen.getByRole('link', { name: /Contents/i });
    expect(contentsLink.className).toContain('admin-nav-item-active');
    expect(homeLink.className).not.toContain('admin-nav-item-active');
    expect(homeLink.className).toContain('admin-nav-item-expanded');
    expect(contentsLink.className).toContain('admin-nav-item-expanded');
    expect(contentsLink.className).toContain('admin-nav-item-in-group');
    expect(homeLink.className).not.toContain('admin-nav-item-in-group');
    expect(homeLink.className).toContain('ps-3');
    expect(contentsLink.className).toContain('ps-3');
    expect(homeLink.querySelector('.admin-nav-item-label')?.className).toContain('text-xs');
    expect(contentsLink.querySelector('.admin-nav-item-label')?.className).toContain('text-xs');
  });

  it('persists manual expand and collapse for inactive groups', () => {
    const onExpandedGroupsChange = vi.fn();

    const { rerender } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        requireOpenGroup={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set(['Settings']));

    onExpandedGroupsChange.mockClear();

    rerender(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Settings'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        requireOpenGroup={false}
      />,
    );

    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set());
  });

  it('truncates long collapsed item labels from the end in rtl mode', () => {
    const arabicGroups: AdminShellNavGroup[] = [
      {
        heading: null,
        items: [{ label: 'ادارة الاشخاص', path: '/people', icon: 'Users' }],
      },
    ];

    render(
      <TreeNavTwoLevel
        groups={arabicGroups}
        pathname="/other"
        isSidebarCollapsed
        isRtl
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const link = screen.getByRole('link', { name: 'لاشخاص' });
    expect(link.querySelector('span.font-mono')?.textContent).toBe('لاشخاص');
    expect(document.querySelector('.admin-nav-group-header')).toBeNull();
  });

  it('shows only category triggers when collapsed on desktop and reveals items in a flyout on hover', () => {
    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.queryByRole('link', { name: /Dashboard/i })).toBeNull();
    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    const settingsTrigger = screen.getByRole('button', { name: 'Settings' });
    expect(platformTrigger.querySelector('span.font-mono')?.textContent).toBe('atform');
    expect(settingsTrigger.querySelector('span.font-mono')?.textContent).toBe('ttings');
    expect(platformTrigger.className).toContain('admin-nav-item-collapsed');
    expect(settingsTrigger.className).toContain('admin-nav-item-collapsed');

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('link', { name: /Users/i })).toBeTruthy();
  });

  it('keeps a single shared flyout backdrop when moving between collapsed group triggers', () => {
    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const platformTrigger = screen.getByRole('button', { name: 'Platform' });
    const settingsTrigger = screen.getByRole('button', { name: 'Settings' });

    fireEvent.mouseEnter(platformTrigger);
    expect(document.querySelectorAll('.admin-nav-flyout-backdrop')).toHaveLength(1);

    fireEvent.mouseLeave(platformTrigger);
    fireEvent.mouseEnter(settingsTrigger);

    expect(document.querySelectorAll('.admin-nav-flyout-backdrop')).toHaveLength(1);
    expect(screen.getByRole('link', { name: /Users/i })).toBeTruthy();
  });

  it('aligns the flyout backdrop with the docked sidebar edge', () => {
    const sidebar = document.createElement('aside');
    sidebar.id = 'admin-shell-sidebar';
    sidebar.getBoundingClientRect = () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 96,
      bottom: 800,
      width: 96,
      height: 800,
      toJSON: () => ({}),
    });
    document.body.appendChild(sidebar);

    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Settings' }));

    const backdrop = document.querySelector('.admin-nav-flyout-backdrop') as HTMLElement | null;
    expect(backdrop?.style.insetInlineStart).toBe('96px');

    sidebar.remove();
  });

  it('navigates directly when collapsed and the group is a single ungrouped item', () => {
    const onNavigate = vi.fn();
    const groupsWithUngroupedDashboard: AdminShellNavGroup[] = [
      {
        heading: null,
        items: [{ label: 'Dashboard', path: '/studio', icon: 'LayoutDashboard' }],
      },
      groups[1],
    ];

    render(
      <TreeNavTwoLevel
        groups={groupsWithUngroupedDashboard}
        pathname="/other"
        isSidebarCollapsed
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={onNavigate}
      />,
    );

    const dashboardLink = screen.getByRole('link', { name: 'hboard' });
    expect(dashboardLink.getAttribute('href')).toBe('/studio');
    expect(dashboardLink.className).toContain('admin-nav-item-collapsed');
    expect(screen.queryByRole('button', { name: 'Dashboard' })).toBeNull();

    fireEvent.click(dashboardLink);
    expect(onNavigate).toHaveBeenCalledWith('/studio');
  });

  it('closes other manually expanded groups when accordion mode is enabled', () => {
    const onExpandedGroupsChange = vi.fn();

    const { rerender } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Settings'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Platform/i }));
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set(['Platform']));

    onExpandedGroupsChange.mockClear();

    rerender(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set(['Settings']));
  });

  it('closes the active group when another section opens in accordion mode', () => {
    const onExpandedGroupsChange = vi.fn();

    const { rerender } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
        lockActiveGroup={false}
      />,
    );

    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Platform/i }));
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set(['Platform']));

    rerender(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
        lockActiveGroup={false}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
  });

  it('allows collapsing the selected section in accordion mode', () => {
    const onExpandedGroupsChange = vi.fn();

    const { rerender } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Settings'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
        lockActiveGroup={false}
      />,
    );

    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set());

    rerender(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
        lockActiveGroup={false}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  });

  it('shows only one expanded group when accordion is given multiple expanded headings', () => {
    const onExpandedGroupsChange = vi.fn();

    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        accordion
      />,
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set(['Platform']));
  });

  it('allows collapsing the active group when lockActiveGroup is disabled', () => {
    const onExpandedGroupsChange = vi.fn();

    const { rerender } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        lockActiveGroup={false}
        requireOpenGroup={false}
      />,
    );

    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onExpandedGroupsChange).not.toHaveBeenCalled();

    rerender(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio/users"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        lockActiveGroup={false}
        requireOpenGroup={false}
      />,
    );

    expect(screen.queryByRole('link', { name: 'Users' })).toBeNull();
  });

  it('uses a fill-height layout with per-section scroll regions when enabled', () => {
    const { container } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
        fillHeight
      />,
    );

    expect(container.querySelector('[data-sidebar-menu-fill-height="true"]')).toBeTruthy();
    expect(container.querySelectorAll('[data-ui-scroll-area][data-variant="nudge"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.overflow-y-auto.scrollbar-hide').length).toBe(0);
  });

  it('pads group headers and items from the top of each section', () => {
    const { container } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const headers = container.querySelectorAll('[data-sidebar-menu-group-header]');
    expect(headers.length).toBe(2);
    headers.forEach((el) => {
      expect(el.getAttribute('data-expanded')).toBe('true');
      expect((el as HTMLElement).style.paddingTop).toBe('9px');
      expect((el as HTMLElement).style.paddingBottom).toBe('9px');
    });

    const itemStacks = container.querySelectorAll('[data-sidebar-menu-items]');
    expect(itemStacks.length).toBe(2);
    itemStacks.forEach((el) => {
      expect((el as HTMLElement).style.paddingTop).toBe('6px');
    });
  });

  it('applies configurable vertical gap between groups', () => {
    const { container } = render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
        groupGapPx={12}
      />,
    );

    const stack = container.querySelector('[data-sidebar-menu-group-gap="12"]') as HTMLElement;
    expect(stack).toBeTruthy();
    expect(stack.style.rowGap).toBe('12px');
  });

  it('places menu search between leading ungrouped items and headed groups', () => {
    const groupsWithUngroupedStart: AdminShellNavGroup[] = [
      {
        items: [
          {
            label: 'Dashboard',
            path: '/studio',
            icon: 'Home',
          },
        ],
      },
      ...groups,
    ];

    const { container } = render(
      <TreeNavTwoLevel
        groups={groupsWithUngroupedStart}
        pathname="/studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const stack = container.querySelector('[data-sidebar-menu-group-gap]') as HTMLElement;
    const children = Array.from(stack.children);
    expect(children[0]?.textContent).toContain('Dashboard');
    expect(children[1]?.querySelector('[data-sidebar-menu-search]')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Search menu' })).toBeTruthy();
  });

  it('filters headed groups as the menu search value changes', () => {
    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const search = screen.getByRole('textbox', { name: 'Search menu' });
    fireEvent.change(search, { target: { value: 'Users' } });

    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Settings/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Platform/i })).toBeNull();
    expect(screen.getByLabelText('Search results').className).toContain('ui-scroll-area-hide-thumb');
  });

  it('adds extra spacing below leading ungrouped groups when the sidebar is collapsed', () => {
    const groupsWithUngroupedStart: AdminShellNavGroup[] = [
      {
        items: [
          {
            label: 'Dashboard',
            path: '/studio',
            icon: 'Home',
          },
        ],
      },
      ...groups,
    ];

    const { container } = render(
      <TreeNavTwoLevel
        groups={groupsWithUngroupedStart}
        pathname="/studio"
        isSidebarCollapsed
        isRtl={false}
        expandedGroups={new Set(['Platform', 'Settings'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const ungroupedWrapper = container.querySelector('[data-sidebar-menu-group-gap] > div') as HTMLElement;
    expect(ungroupedWrapper?.style.marginBottom).toBe('6px');
    expect(container.querySelector('[data-sidebar-menu-search]')).toBeNull();
  });

  it('blocks collapsing the last open headed group when requireOpenGroup is enabled', () => {
    const onExpandedGroupsChange = vi.fn();

    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Settings'])}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        lockActiveGroup={false}
        requireOpenGroup
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Settings/i }));
    expect(onExpandedGroupsChange).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Users' })).toBeTruthy();
  });

  it('opens a fallback group when requireOpenGroup is enabled and none are expanded', () => {
    const onExpandedGroupsChange = vi.fn();

    render(
      <TreeNavTwoLevel
        groups={groups}
        pathname="/nowhere"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set()}
        onExpandedGroupsChange={onExpandedGroupsChange}
        onNavigate={vi.fn()}
        lockActiveGroup={false}
        requireOpenGroup
      />,
    );

    expect(onExpandedGroupsChange).toHaveBeenCalledWith(new Set(['Platform']));
  });

  it('keeps sidebar pages undraggable until Home design mode', () => {
    const pinGroups: AdminShellNavGroup[] = [
      {
        heading: 'Platform',
        items: [
          { label: 'Home', path: '/studio', pageKey: 'dashboard', icon: 'Home' },
          { label: 'Data Studio', path: '/studio/data-studio', pageKey: 'data-studio', icon: 'Database' },
        ],
      },
    ];

    const { rerender } = render(
      <TreeNavTwoLevel
        groups={pinGroups}
        pathname="/studio/data-studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const studioLink = screen.getByRole('link', { name: /Data Studio/i });
    expect(studioLink.getAttribute('draggable')).toBe('false');
    expect(studioLink.className).not.toContain('admin-nav-item-drag');

    setDashboardDesignMode(true);
    rerender(
      <TreeNavTwoLevel
        groups={pinGroups}
        pathname="/studio/data-studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const homeLink = screen.getByRole('link', { name: /^Home$/i });
    const designingStudioLink = screen.getByRole('link', { name: /Data Studio/i });
    expect(homeLink.getAttribute('draggable')).toBe('false');
    expect(designingStudioLink.getAttribute('draggable')).toBe('true');
    expect(designingStudioLink.className).toContain('admin-nav-item-drag');
  });

  it('lets operators drag and pin sidebar pages onto Home', () => {
    setDashboardDesignMode(true);
    const pinGroups: AdminShellNavGroup[] = [
      {
        heading: 'Platform',
        items: [
          { label: 'Home', path: '/studio', pageKey: 'dashboard', icon: 'Home' },
          { label: 'Data Studio', path: '/studio/data-studio', pageKey: 'data-studio', icon: 'Database' },
        ],
      },
    ];

    render(
      <TreeNavTwoLevel
        groups={pinGroups}
        pathname="/studio/data-studio"
        isSidebarCollapsed={false}
        isRtl={false}
        expandedGroups={new Set(['Platform'])}
        onExpandedGroupsChange={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    const homeLink = screen.getByRole('link', { name: /^Home$/i });
    const studioLink = screen.getByRole('link', { name: /Data Studio/i });
    expect(homeLink.getAttribute('draggable')).toBe('false');
    expect(studioLink.getAttribute('draggable')).toBe('true');

    const pinButton = screen.getByRole('button', { name: /pin to home/i });
    expect(studioLink.contains(pinButton)).toBe(true);
    expect(studioLink.lastElementChild?.contains(pinButton)).toBe(true);
    expect(studioLink.lastElementChild?.className).toContain('admin-nav-item-trailing');
    fireEvent.click(pinButton);
    expect(studioLink.getAttribute('href')).toBe('/studio/data-studio');

    const dataTransfer = {
      setData: vi.fn(),
      effectAllowed: 'none',
    };
    fireEvent.dragStart(studioLink, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalled();
  });
});
