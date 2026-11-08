import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, vi } from 'vitest';
import { generateDesignerTsx } from '../../../domain/component-designer/codegen';
import type { DesignerBindingDefinitions, DesignerDocument } from '../../../domain/component-designer/types';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import { ComponentDesignerPage } from '../ComponentDesignerPage';

export const installDesignerCanvasTestPolyfills = () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
};

export const getToolbarSaveButton = () => screen.getByRole('button', { name: 'Save draft' });

export const getOpenDialogSaveButton = () => {
  const dialog = screen.getByRole('dialog');
  return within(dialog).getByRole('button', { name: 'Save' });
};

export const getCanvasResizeCornerHandle = () =>
  screen.getByRole('button', { name: 'Resize canvas from bottom-right corner' });

export const getManualCanvasBox = () => {
  const canvasBox = getCanvasResizeCornerHandle().closest('.relative.self-start');
  if (!(canvasBox instanceof HTMLElement)) {
    throw new Error('Manual canvas box not found.');
  }
  return canvasBox;
};

export const expectManualCanvasDimensions = (width: number, height: number) => {
  const canvasBox = getManualCanvasBox();
  expect(canvasBox.style.width).toBe(`${width}px`);
  const actualHeight = canvasBox.style.height || canvasBox.style.minHeight;
  expect(actualHeight).toBe(`${height}px`);
};

export const openDesignerCodePanel = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle code column visibility' }));
  await waitFor(() => {
    expect(screen.getByLabelText('monaco-editor')).toBeInTheDocument();
  });
};

const CONTAINER_NODE_PROPS = { _designerPaletteItemId: 'html.container' };

export const syncDesignerDocumentViaCodeEditor = async (
  designerDocument: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
) => {
  await openDesignerCodePanel();
  const tsxCode = generateDesignerTsx(designerDocument, bindingDefinitions);
  fireEvent.change(screen.getByLabelText('monaco-editor'), { target: { value: tsxCode } });

  await waitFor(() => {
    expect(getToolbarSaveButton()).toBeEnabled();
  }, { timeout: 5000 });
};

export const closeDesignerCodePanel = async () => {
  const codeToggle = screen.getByRole('button', { name: 'Toggle code column visibility' });
  if (codeToggle.getAttribute('aria-pressed') === 'true') {
    fireEvent.click(codeToggle);
    await waitFor(() => {
      expect(codeToggle).toHaveAttribute('aria-pressed', 'false');
    });
  }
};

export { CONTAINER_NODE_PROPS };

export const openViewportPresetMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: / viewport preset$/i }));
};

export const selectViewportPreset = (label: 'Desktop' | 'Tablet' | 'Mobile') => {
  fireEvent.click(screen.getByRole('menuitem', { name: label }));
};

export const dismissOpenDesignerDialog = () => {
  const dialog = screen.getByRole('dialog');
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
};

type StoredDraft = {
  id: string;
  name: string;
  folder: string;
  document: any;
  bindingDefinitions: Record<string, unknown>;
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
};

type PublishState = {
  publishedVersion: number | null;
  loaderRef: string | null;
  publishedAt: string | null;
};

type MockApiOptions = {
  previewShouldFail?: boolean;
  delayDraftLoadMs?: number;
  initialDrafts?: Array<{
    id: string;
    name: string;
    folder?: string;
  }>;
};

const makeJsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

export const expectDraftsListFetched = () => {
  expect(fetch).toHaveBeenCalledWith(
    expect.stringMatching(/\/api\/component-designer\/drafts(?:\?|$)/),
    expect.anything(),
  );
};

export const installComponentDesignerFetchMock = (options: MockApiOptions = {}) => {
  const drafts = new Map<string, StoredDraft>();
  const publishByDraftId = new Map<string, PublishState>();

  const buildComponentPath = (draft: StoredDraft) => `${draft.folder || 'general'}/${draft.name}`;

  for (const seed of options.initialDrafts ?? []) {
    const now = '2026-05-31T12:00:00.000Z';
    const initialState = createInitialDesignerState();
    drafts.set(seed.id, {
      id: seed.id,
      name: seed.name,
      folder: seed.folder ?? 'general',
      document: {
        ...initialState.document,
        id: seed.id,
        name: seed.name,
      },
      bindingDefinitions: initialState.bindingDefinitions,
      metadata: {
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  const buildPublishState = (draftId: string, hasUnsavedChanges: boolean) => {
    const draft = drafts.get(draftId);
    const publish = publishByDraftId.get(draftId);
    if (!draft) {
      return null;
    }

    const lifecycle = !publish
      ? (hasUnsavedChanges ? 'draft' : 'saved')
      : (hasUnsavedChanges ? 'saved' : 'published');

    return {
      lifecycle,
      componentPath: buildComponentPath(draft),
      publishedVersion: publish?.publishedVersion ?? null,
      loaderRef: publish?.loaderRef ?? null,
      publishedAt: publish?.publishedAt ?? null,
      hasUnpublishedChanges: lifecycle !== 'published',
      versionHistory: publish?.publishedVersion
        ? [{
            version: publish.publishedVersion,
            publishedAt: publish.publishedAt ?? draft.metadata.updatedAt,
            name: draft.name,
          }]
        : [],
    };
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const parsedUrl = new URL(url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const method = (init?.method || 'GET').toUpperCase();

    if (pathname === '/api/component-designer/drafts' && method === 'GET') {
      return makeJsonResponse({
        success: true,
        items: Array.from(drafts.values()).map((draft) => ({
          id: draft.id,
          name: draft.name,
          folder: draft.folder,
          createdAt: draft.metadata.createdAt,
          updatedAt: draft.metadata.updatedAt,
        })),
      });
    }

    if (pathname === '/api/component-designer/drafts' && method === 'POST') {
      const payload = JSON.parse(String(init?.body || '{}')) as any;
      const id = payload.duplicateFromId ? `draft-copy-${drafts.size + 1}` : `draft-${drafts.size + 1}`;
      const now = '2026-05-31T12:00:00.000Z';
      const source = payload.duplicateFromId ? drafts.get(payload.duplicateFromId)! : null;
      const document = source ? { ...source.document, id, name: payload.name } : { ...payload.document, id, name: payload.name };
      const bindingDefinitions = source ? source.bindingDefinitions : payload.bindingDefinitions;
      const draft: StoredDraft = {
        id,
        name: payload.name,
        folder: payload.folder ?? 'general',
        document: {
          ...document,
          metadata: {
            ...document.metadata,
            createdAt: now,
            updatedAt: now,
          },
        },
        bindingDefinitions,
        metadata: {
          createdAt: now,
          updatedAt: now,
        },
      };
      drafts.set(id, draft);
      return makeJsonResponse({ success: true, draft }, 201);
    }

    if (pathname.endsWith('/publish-state') && method === 'GET') {
      const segments = pathname.split('/');
      const id = segments[segments.length - 2] as string;
      const hasUnsavedChanges = parsedUrl.searchParams.get('unsaved') === '1';
      const state = buildPublishState(id, hasUnsavedChanges);
      if (!state) {
        return makeJsonResponse({ success: false, error: 'Draft not found.' }, 404);
      }
      return makeJsonResponse({ success: true, state });
    }

    if (pathname.endsWith('/publish-diff') && method === 'GET') {
      const segments = pathname.split('/');
      const id = segments[segments.length - 2] as string;
      const draft = drafts.get(id);
      if (!draft) {
        return makeJsonResponse({ success: false, error: 'Draft not found.' }, 404);
      }
      return makeJsonResponse({
        success: true,
        diff: {
          componentPath: buildComponentPath(draft),
          publishedVersion: publishByDraftId.get(id)?.publishedVersion ?? null,
          nodesAdded: 1,
          nodesRemoved: 0,
          nodesChanged: 0,
          propsChanged: 0,
        },
      });
    }

    if (pathname.endsWith('/publish') && method === 'POST') {
      const segments = pathname.split('/');
      const id = segments[segments.length - 2] as string;
      const draft = drafts.get(id);
      if (!draft) {
        return makeJsonResponse({ success: false, error: 'Draft not found.' }, 404);
      }
      const nextVersion = (publishByDraftId.get(id)?.publishedVersion ?? 0) + 1;
      const componentPath = buildComponentPath(draft);
      const loaderRef = `${componentPath}@v${nextVersion}`;
      const publishedAt = '2026-05-31T12:20:00.000Z';
      publishByDraftId.set(id, { publishedVersion: nextVersion, loaderRef, publishedAt });
      const state = buildPublishState(id, false);
      return makeJsonResponse({ success: true, state });
    }

    if (pathname.endsWith('/staging-preview') && method === 'POST') {
      const segments = pathname.split('/');
      const id = segments[segments.length - 2] as string;
      const draft = drafts.get(id);
      if (!draft) {
        return makeJsonResponse({ success: false, error: 'Draft not found.' }, 404);
      }
      return makeJsonResponse({
        success: true,
        token: 'staging-token',
        expiresAt: '2026-06-01T12:00:00.000Z',
        previewPath: '/studio/component-preview?staging=staging-token',
      }, 201);
    }

    if (pathname.endsWith('/versions') && pathname.startsWith('/api/component-designer/drafts/') && method === 'GET') {
      const segments = pathname.split('/');
      const id = segments[segments.length - 2] as string;
      const draft = drafts.get(id);
      if (!draft) {
        return makeJsonResponse({ success: false, error: 'Draft not found.' }, 404);
      }
      const versions = draft
        ? [{
            id,
            name: draft.name,
            createdAt: draft.metadata.createdAt,
            updatedAt: draft.metadata.updatedAt,
          }]
        : [];
      return makeJsonResponse({ success: true, items: versions });
    }

    if (pathname.startsWith('/api/component-designer/drafts/') && method === 'GET') {
      if (options.delayDraftLoadMs) {
        await new Promise((resolve) => {
          setTimeout(resolve, options.delayDraftLoadMs);
        });
      }
      const id = pathname.split('/').pop() as string;
      const draft = drafts.get(id);
      if (!draft) {
        return makeJsonResponse({ success: false, error: 'Draft not found.' }, 404);
      }
      return makeJsonResponse({ success: true, draft });
    }

    if (pathname.startsWith('/api/component-designer/drafts/') && method === 'PUT') {
      const id = pathname.split('/').pop() as string;
      const payload = JSON.parse(String(init?.body || '{}')) as any;
      const current = drafts.get(id)!;
      const updated: StoredDraft = {
        ...current,
        name: payload.name ?? current.name,
        document: payload.document
          ? { ...payload.document, id, name: payload.name ?? current.name }
          : { ...current.document, name: payload.name ?? current.name },
        bindingDefinitions: payload.bindingDefinitions ?? current.bindingDefinitions,
        metadata: {
          ...current.metadata,
          updatedAt: '2026-05-31T12:10:00.000Z',
        },
      };
      drafts.set(id, updated);
      return makeJsonResponse({ success: true, draft: updated });
    }

    if (pathname.startsWith('/api/component-designer/drafts/') && method === 'DELETE') {
      const id = pathname.split('/').pop() as string;
      drafts.delete(id);
      return makeJsonResponse({ success: true });
    }

    if (pathname === '/api/component-designer/catalog/system-components' && method === 'GET') {
      return makeJsonResponse({ success: true, items: [] });
    }

    if (pathname === '/api/component-designer/catalog/reusable-components' && method === 'GET') {
      return makeJsonResponse({ success: true, items: [] });
    }

    if (pathname === '/api/component-designer/preview/runtime' && method === 'POST') {
      if (options.previewShouldFail) {
        return makeJsonResponse({ success: false, error: 'Preview hard failure.', diagnostics: [] }, 500);
      }

      return makeJsonResponse({
        success: true,
        traceId: 'trace-preview-ok',
        results: {},
        diagnostics: [],
        logs: [],
      });
    }

    return makeJsonResponse({ success: false, error: `Unhandled request: ${method} ${url}` }, 500);
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    fetchMock,
    drafts,
  };
};

export const renderComponentDesigner = (options?: {
  mode?: 'list' | 'design';
  initialEntry?: string;
}) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const mode = options?.mode ?? 'design';
  const initialEntry = options?.initialEntry ?? (mode === 'list'
    ? '/studio/client-components'
    : '/studio/client-components/new');

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/studio/client-components/*" element={<ComponentDesignerPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
