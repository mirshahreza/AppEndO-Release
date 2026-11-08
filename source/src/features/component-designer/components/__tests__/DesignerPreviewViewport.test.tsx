// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DesignerPreviewViewport } from '../DesignerPreviewViewport';
import type { DesignerDocument } from '../../../../domain/component-designer/types';

vi.mock('../../../../app/platform/PlatformConfigProvider', () => {
  const value = {
    config: {
      version: 'application-host-v1',
      mounts: [],
      shells: [],
      shellRules: [],
      pageModules: [],
      bindings: [],
    },
  };
  return {
    usePlatformConfig: () => value,
    useOptionalPlatformConfig: () => value,
  };
});

vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    currentUser: { id: 1, email: 'admin@append.os', role: 'ADMIN', roles: ['ADMIN'] },
  })),
}));

vi.mock('../../../../app/platform/PlatformMountContext', () => ({
  usePlatformMount: () => ({
    mountId: 'test-mount',
    pathPrefix: '/test-prefix',
  }),
}));

vi.mock('../../../../components/AccentColorPicker', () => ({
  AccentColorPicker: () => null,
}));

vi.mock('../../../../hooks/useCurrentUserDisplay', () => ({
  useCurrentUserDisplay: () => ({ displayName: 'Test User', avatarInitial: 'T', primaryRole: 'ADMIN' }),
}));

vi.mock('../../../../layouts/adminShell/useAdminShellNav', () => ({
  useAdminShellNav: () => [],
}));

vi.mock('../../../../components/AppEndooPanel', () => ({
  AppEndooPanel: () => null,
}));

vi.mock('../../../../components/ProfileDrawer', () => ({
  ProfileDrawer: () => null,
}));

vi.mock('../../../../features/feedback/components/FeedbackSubmitDialog', () => ({
  FeedbackEntryButton: () => null,
  FeedbackSubmitDialog: () => null,
}));

const renderPreview = (document: DesignerDocument) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DesignerPreviewViewport
          document={document}
          selectedCultureId="en"
          portalShellKey={null}
          portalSegment="studio"
          portalOptions={[]}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('DesignerPreviewViewport a11y warnings panel', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a11y warnings panel and list of issues when document contains violations', () => {
    const documentWithViolations: DesignerDocument = {
      rootNodeId: 'root',
      name: 'Test Doc',
      folder: 'components',
      version: 1,
      nodes: {
        root: {
          id: 'root',
          type: 'root',
          parentId: null,
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: ['img-1', 'btn-1', 'input-1'],
        },
        'img-1': {
          id: 'img-1',
          type: 'image',
          parentId: 'root',
          order: 0,
          props: {}, // Missing alt prop!
          layout: {},
          binding: {},
          children: [],
        },
        'btn-1': {
          id: 'btn-1',
          type: 'button',
          parentId: 'root',
          order: 1,
          props: {}, // Missing text/ariaLabel!
          layout: {},
          binding: {},
          children: [],
        },
        'input-1': {
          id: 'input-1',
          type: 'field',
          parentId: 'root',
          order: 2,
          props: {
            _designerPaletteItemId: 'heroui.input-text', // Missing label/ariaLabel/placeholder!
          },
          layout: {},
          binding: {},
          children: [],
        },
      },
      diagnostics: [],
    };

    renderPreview(documentWithViolations);

    // Verify warnings panel is visible with count 3
    const panel = screen.getByTestId('a11y-warnings-panel');
    expect(panel).toBeInTheDocument();
    expect(screen.getByText(/Accessibility Warnings \(3\)/)).toBeInTheDocument();

    // The list details should be hidden initially
    expect(screen.queryByTestId('a11y-issues-list')).not.toBeInTheDocument();

    // Toggle details
    const toggleBtn = screen.getByTestId('a11y-toggle-details-btn');
    fireEvent.click(toggleBtn);

    // List details should now be visible
    expect(screen.getByTestId('a11y-issues-list')).toBeInTheDocument();

    // Verify specific warnings are rendered (Phase 50 canonical a11y diagnostic ids)
    expect(screen.getByTestId('a11y-issue-a11y-missing-alt:img-1')).toHaveTextContent(
      "Image is missing 'alt' text for screen readers. (img-1)"
    );
    expect(screen.getByTestId('a11y-issue-a11y-missing-aria-label:btn-1')).toHaveTextContent(
      "Button has no text content or ariaLabel. (btn-1)"
    );
    expect(screen.getByTestId('a11y-issue-a11y-missing-aria-label:input-1')).toHaveTextContent(
      "Form input field has no visible label, placeholder, or ariaLabel. (input-1)"
    );
  });

  it('does not render a11y warnings panel when document has no violations', () => {
    const cleanDocument: DesignerDocument = {
      rootNodeId: 'root',
      name: 'Test Doc',
      folder: 'components',
      version: 1,
      nodes: {
        root: {
          id: 'root',
          type: 'root',
          parentId: null,
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: ['img-clean', 'btn-clean'],
        },
        'img-clean': {
          id: 'img-clean',
          type: 'image',
          parentId: 'root',
          order: 0,
          props: {
            alt: 'Company Logo',
          },
          layout: {},
          binding: {},
          children: [],
        },
        'btn-clean': {
          id: 'btn-clean',
          type: 'button',
          parentId: 'root',
          order: 1,
          props: {
            text: 'Submit Form',
          },
          layout: {},
          binding: {},
          children: [],
        },
      },
      diagnostics: [],
    };

    renderPreview(cleanDocument);

    expect(screen.queryByTestId('a11y-warnings-panel')).not.toBeInTheDocument();
  });
});
