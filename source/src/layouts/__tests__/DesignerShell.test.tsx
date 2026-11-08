// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DesignerShell } from '../DesignerShell';

vi.mock('../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../shared/ui/shell/ShellAppEndooControl', () => ({
  ShellAppEndooControl: () => null,
}));

describe('DesignerShell', () => {
  it('renders a full-viewport outlet without admin chrome', () => {
    render(
      <MemoryRouter initialEntries={['/studio/client-components']}>
        <Routes>
          <Route path="/studio/client-components" element={<DesignerShell />}>
            <Route index element={<div data-testid="designer-page">Designer workspace</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('designer-page')).toBeInTheDocument();
    expect(document.querySelector('.designer-shell')).toHaveClass('h-screen');
    expect(document.querySelector('.designer-shell main > div')).toHaveClass('flex-1');
    expect(document.querySelector('.admin-shell-surface')).toBeNull();
  });

  it('keeps designer shell overflow hidden for canvas-heavy routes', () => {
    render(
      <MemoryRouter initialEntries={['/studio/client-components']}>
        <Routes>
          <Route path="/studio/client-components" element={<DesignerShell />}>
            <Route index element={<div data-testid="designer-page">Designer workspace</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(document.querySelector('.designer-shell')).toHaveClass('overflow-hidden');
  });
});
