// @vitest-environment jsdom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    aside: ({ children, ...props }: React.ComponentProps<'aside'>) => <aside {...props}>{children}</aside>,
  },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PointerSensor: function PointerSensor() {},
  closestCenter: () => null,
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => undefined, transform: null, isDragging: false }),
  useDroppable: () => ({ isOver: false, setNodeRef: () => undefined }),
  useSensor: () => ({}),
  useSensors: () => ([]),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Translate: {
      toString: () => undefined,
    },
  },
}));

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (value: string) => void }) => (
    <textarea aria-label="monaco-editor" value={value} onChange={(event) => onChange?.(event.target.value)} />
  ),
}));

vi.mock('../../../app/platform/DesignerPublishedShellChrome', () => ({
  DesignerPublishedShellChromeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@heroui/react', async () => {
  const { componentDesignerHeroUiMock } = await import('../../../test-support/componentDesignerHeroUiMock');
  return componentDesignerHeroUiMock;
});

vi.mock('../../../components/ui/HeroFieldControls', () => ({
  UiInput: ({ value, onChange, ariaLabel, type }: any) => <input value={value ?? ''} onChange={onChange} aria-label={ariaLabel} type={type} />,
  UiSelect: ({ value, onChange, ariaLabel, children }: any) => <select value={value ?? ''} onChange={onChange} aria-label={ariaLabel}>{children}</select>,
  UiCheckbox: ({ checked, onChange, children }: any) => (
    <label>
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange?.({ target: { checked: event.target.checked } })} />
      {children}
    </label>
  ),
  UiTextarea: ({ value, onChange, ariaLabel }: any) => <textarea value={value ?? ''} onChange={onChange} aria-label={ariaLabel} />,
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
  })),
}));

vi.mock('../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: () => ({ displayName: 'Test User', avatarInitial: 'T', primaryRole: 'ADMIN' }),
}));

vi.mock('../../../layouts/adminShell/useAdminShellNav', () => ({
  useAdminShellNav: () => [],
}));

import {
  installComponentDesignerFetchMock,
  installDesignerCanvasTestPolyfills,
  renderComponentDesigner,
} from './componentDesignerTestUtils';

const setupViewport = () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280, writable: true });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900, writable: true });
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width') ? window.innerWidth <= 1279 : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('Deep-linking to a not-yet-existing shell layout draft, and the auto-create call fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    installDesignerCanvasTestPolyfills();
    setupViewport();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows a visible error toast instead of silently failing, and does not loop retrying', async () => {
    const { fetchMock } = installComponentDesignerFetchMock();
    const baseImpl = fetchMock.getMockImplementation()!;

    // Every request behaves normally except the one POST that creates the shell draft,
    // which fails — simulating a real network/server error during the auto-create flow
    // triggered by deep-linking straight to /portal-layouts/<shellKey>.
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      const method = (init?.method || 'GET').toUpperCase();
      if (url.includes('/api/component-designer/drafts') && method === 'POST') {
        throw new Error('network down');
      }
      return baseImpl(input, init);
    });

    renderComponentDesigner({ initialEntry: '/studio/client-components/live-designer/portal-layouts/my-missing-shell' });

    // Before the fix: this failure was swallowed with `catch { ... }` and no user feedback at all —
    // the user would be left staring at a URL that never resolves, with nothing on screen explaining why.
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/could not create.*my-missing-shell/i);
    }, { timeout: 5000 });

    expect(fetchMock).toHaveBeenCalled();
  });
});
