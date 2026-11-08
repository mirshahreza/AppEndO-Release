// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { slotRegistry } from '../../../../core/slots/SlotRegistry';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../../../shared/lib/shellRouteOutlet';
import { DASHBOARD_WIDGETS_SLOT_ID, DesignerSlotPreview } from '../DesignerSlotPreview';

describe('DesignerSlotPreview', () => {
  afterEach(() => {
    slotRegistry.unregisterByPackage('preview-test-package');
    cleanup();
  });

  it('renders placeholder when no components are registered', () => {
    render(
      <DesignerSlotPreview
        slotId="core.settings.sections"
        label="Settings Sections"
        surface="settings"
      />,
    );

    expect(screen.getByText('Platform Slot')).toBeTruthy();
    expect(screen.getByText('Settings Sections')).toBeTruthy();
    expect(screen.getByText('core.settings.sections')).toBeTruthy();
  });

  it('renders registered dashboard widgets in the dashboard grid shell', () => {
    const Widget = () => <div data-testid="dashboard-widget">Widget</div>;

    slotRegistry.register({
      id: 'widget-preview-1',
      packageId: 'preview-test-package',
      target: DASHBOARD_WIDGETS_SLOT_ID,
      order: 10,
      component: Widget,
    });

    const { container } = render(
      <DesignerSlotPreview
        slotId={DASHBOARD_WIDGETS_SLOT_ID}
        label="Dashboard Widgets"
        surface="portal"
      />,
    );

    expect(screen.getByTestId('dashboard-widget')).toBeTruthy();
    expect(container.querySelector('.grid.w-full')).toBeTruthy();
  });

  it('shows the design-time placeholder for the route-outlet slot inside the editing canvas', () => {
    render(
      <DesignerSlotPreview
        slotId={SHELL_ROUTE_OUTLET_SLOT_ID}
        label="Route Outlet"
        surface="admin-shell"
        isDesignCanvas
      />,
    );

    expect(screen.getByText('Route Outlet')).toBeTruthy();
    expect(screen.getByText('Page content loads here')).toBeTruthy();
  });

  it('renders the real ShellRouteOutlet (a live react-router Outlet) for the route-outlet slot outside the editing canvas', () => {
    render(
      <MemoryRouter initialEntries={['/child']}>
        <Routes>
          <Route
            path="/"
            element={(
              <DesignerSlotPreview
                slotId={SHELL_ROUTE_OUTLET_SLOT_ID}
                label="Route Outlet"
                surface="admin-shell"
              />
            )}
          >
            <Route path="child" element={<div data-testid="real-routed-page">Real routed page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('shell-route-outlet')).toBeTruthy();
    expect(screen.getByTestId('real-routed-page')).toBeTruthy();
    expect(screen.queryByText('Page content loads here')).toBeNull();
  });
});
