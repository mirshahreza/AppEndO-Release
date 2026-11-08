/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { DesignerRuntimeCmsContentAssets } from '../DesignerRuntimeCmsContentAssets';
import { DesignerRuntimeRelationTagsList } from '../DesignerRuntimeRelationTagsList';
import { PICK_FILE_CREATE_COMPLETE_EVENT } from '../designerGridPickFileCreate';
import type { DesignerBindingDefinitions, DesignerNode } from '../types';
import type { PreviewEventHandlerContext } from '../bindingPreviewHandlers';
import type { RuntimeRenderOptions } from '../runtimeTypes';

vi.mock('../../../shared/ui/image-editor/ImageEditorSaveDialog', () => ({
  ImageEditorSaveDialog: ({
    open,
    title,
    onSave,
  }: {
    open: boolean;
    title: string;
    onSave: (file: File) => void | Promise<void>;
  }) => open ? (
    <div role="dialog" aria-label={title}>
      <button
        type="button"
        onClick={() => void onSave(new File(['edited'], 'edited-output.bin', { type: 'application/octet-stream' }))}
      >
        Apply image edit
      </button>
    </div>
  ) : null,
}));

const buildNode = (mode: string): DesignerNode => ({
  id: 'cms-assets-test',
  type: 'container',
  parentId: null,
  order: 0,
  layout: {},
  children: [],
  binding: {},
  props: {
    _designerPaletteItemId: 'form.cms-content-assets',
    cmsContentAssetsMode: mode,
    cmsContentAssetsDataSourceRef: 'cmsContentAssets',
    cmsContentAssetsContentIdPath: 'routeParams.id',
  },
});

const bindingDefinitions: DesignerBindingDefinitions = {
  definitions: {},
  lovs: {},
  storeSegments: {},
  dataSources: {
    cmsContentAssets: {
      id: 'cmsContentAssets',
      name: 'CMS Content Assets',
      endpoint: '/api/cms/assets',
      primaryKey: 'id',
      fields: [],
      operations: {
        list: { method: 'GET', endpoint: '/api/cms/assets' },
        create: { method: 'POST', endpoint: '/api/cms/assets' },
        update: { method: 'PUT', endpoint: '/api/cms/assets/:id' },
        delete: { method: 'DELETE', endpoint: '/api/cms/assets/:pk' },
      },
    },
  },
};

const buildPreviewEvents = (
  overrides: Partial<PreviewEventHandlerContext> = {},
): PreviewEventHandlerContext => ({
  bindingContext: {},
  designerStore: {},
  patchStore: () => {},
  mutationCallbacks: {},
  isSubmitting: false,
  refreshDataSource: async () => undefined,
  ...overrides,
});

const buildRuntimeOptions = (
  overrides: Partial<RuntimeRenderOptions> = {},
): RuntimeRenderOptions => ({
  mode: 'runtime',
  designerStore: { routeParams: { id: '7' } },
  bindingDefinitions,
  previewEvents: buildPreviewEvents(),
  ...overrides,
});

describe('DesignerRuntimeCmsContentAssets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders assets without an inline upload control in design preview', () => {
    render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('all')}
        options={{ mode: 'design' }}
      />,
    );

    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
    expect(screen.getByText('Images')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
  });

  it('renders files mode in design preview', () => {
    render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('files')}
        options={{ mode: 'design' }}
      />,
    );

    expect(screen.getByText('sample-document.pdf')).toBeTruthy();
  });

  it('renders images mode in design preview', () => {
    const { container } = render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('images')}
        options={{ mode: 'design' }}
      />,
    );

    expect(container.querySelectorAll('.h-\\[100px\\]').length).toBeGreaterThan(0);
  });

  it('maps numeric API ids and shows uploaded assets after list load', async () => {
    const longFileName = 'quarterly-financial-report-archive-2026.pdf';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 42,
            contentId: 7,
            fileName: longFileName,
            fileMime: 'application/pdf',
            sortOrder: 10,
          },
          {
            id: 43,
            contentId: 7,
            fileName: 'photo.png',
            fileMime: 'image/png',
            filePreviewUrl: 'data:image/png;base64,abc',
            sortOrder: 20,
          },
        ],
      }),
    } as Response);

    render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('files')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(`${longFileName.slice(0, 32)}...`)).toBeTruthy();
    });
    expect(screen.getByTitle(longFileName).getAttribute('data-cms-file-id')).toBe('42');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'filter%5BcontentId%5D%5Beq%5D=7',
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('sort=sortOrder');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('pageSize=100');

    fetchMock.mockRestore();
  });

  it('clears the previous record assets while the next record loads', async () => {
    let resolveSecondRequest: ((response: Response) => void) | undefined;
    const secondRequest = new Promise<Response>((resolve) => {
      resolveSecondRequest = resolve;
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('filter%5BcontentId%5D%5Beq%5D=8')) {
        return secondRequest;
      }
      return {
        ok: true,
        json: async () => ({
          data: [{
            id: 42,
            contentId: 7,
            fileName: 'previous-record.pdf',
            fileMime: 'application/pdf',
            sortOrder: 10,
          }],
        }),
      } as Response;
    });
    const options = (contentId: string) => ({
      mode: 'runtime' as const,
      designerStore: { routeParams: { id: contentId } },
      bindingDefinitions,
      previewEvents: buildPreviewEvents(),
    });
    const { rerender } = render(
      <DesignerRuntimeCmsContentAssets node={buildNode('files')} options={options('7')} />,
    );
    await screen.findByText('previous-record.pdf');

    rerender(<DesignerRuntimeCmsContentAssets node={buildNode('files')} options={options('8')} />);

    expect(screen.queryByText('previous-record.pdf')).toBeNull();
    resolveSecondRequest?.({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('downloads the original asset with its file name', async () => {
    const downloads: Array<{ href: string; fileName: string }> = [];
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      downloads.push({ href: this.href, fileName: this.download });
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/api/cms/assets/42')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 42,
              fileName: 'report.pdf',
              fileMime: 'application/pdf',
              file: { type: 'Buffer', data: [37, 80, 68, 70] },
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            id: 42,
            contentId: 7,
            fileName: 'report.pdf',
            fileMime: 'application/pdf',
            sortOrder: 10,
          }],
        }),
      } as Response;
    });

    render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('files')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Download report.pdf' }));
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(downloads[0].fileName).toBe('report.pdf');
    expect(downloads[0].href).toMatch(/^data:application\/pdf;base64,/);

    clickMock.mockRestore();
    fetchMock.mockRestore();
  });

  it('makes image tiles keyboard-sortable while keeping preview images static', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: 1,
            contentId: 7,
            fileName: 'a.png',
            fileMime: 'image/png',
            filePreviewUrl: 'data:image/png;base64,aaa',
            sortOrder: 10,
          },
        ],
      }),
    } as Response);

    const { container } = render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('images')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('[data-cms-asset-id="1"][aria-roledescription="sortable"]')).toBeTruthy();
    });

    expect(container.querySelector('img[draggable="false"]')).toBeTruthy();
    fetchMock.mockRestore();
  });

  it('uploads dropped files onto the assets area', async () => {
    const postBodies: Array<{ fileName: string }> = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cms/assets') && init?.method === 'POST') {
        postBodies.push(JSON.parse(String(init.body)) as { fileName: string });
        return { ok: true, json: async () => ({ success: true, data: { id: 99 } }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response;
    });

    const { container } = render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('all')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('No images yet.')).toBeTruthy();
    });

    const shell = container.querySelector('[data-designer-component="form.cms-content-assets"]');
    expect(shell).toBeTruthy();

    const file = new File(['hello'], 'dropped.txt', { type: 'text/plain' });
    fireEvent.dragEnter(shell!, {
      dataTransfer: { types: ['Files'], files: [file] },
    });
    fireEvent.drop(shell!, {
      dataTransfer: {
        types: ['Files'],
        files: [file],
      },
    });

    await waitFor(() => {
      expect(postBodies.some((body) => body.fileName === 'dropped.txt')).toBe(true);
    });

    fetchMock.mockRestore();
  });

  it('reloads assets after the header upload completes', async () => {
    let listLoads = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      listLoads += 1;
      return {
        ok: true,
        json: async () => ({ success: true, data: [] }),
      } as Response;
    });

    render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('all')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => expect(listLoads).toBe(1));
    window.dispatchEvent(new CustomEvent(PICK_FILE_CREATE_COMPLETE_EVENT, {
      detail: { dataSourceRef: 'cmsContentAssets', contentId: 7 },
    }));
    await waitFor(() => expect(listLoads).toBe(2));

    fetchMock.mockRestore();
  });

  it('filters content tags by the active record id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    } as Response);
    const tagNode: DesignerNode = {
      ...buildNode('all'),
      id: 'cms-tags-test',
      props: {
        relationTagsDataSourceRef: 'cmsContentTags',
        relationTagsContentIdPath: 'routeParams.id',
        relationTagsOptions: '[]',
      },
    };

    render(
      <DesignerRuntimeRelationTagsList
        node={tagNode}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '19' } },
          bindingDefinitions: {
            ...bindingDefinitions,
            dataSources: {
              ...bindingDefinitions.dataSources,
              cmsContentTags: {
                id: 'cmsContentTags',
                name: 'CMS Content Tags',
                endpoint: '/api/cms/tags',
                primaryKey: 'id',
                fields: [],
                operations: {
                  list: { method: 'GET', endpoint: '/api/cms/tags' },
                  create: { method: 'POST', endpoint: '/api/cms/tags' },
                  delete: { method: 'DELETE', endpoint: '/api/cms/tags/:id' },
                },
              },
            },
          },
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'filter%5BcontentId%5D%5Beq%5D=19',
    );

    fetchMock.mockRestore();
  });

  it('opens the shared image editor and updates the existing asset', async () => {
    const putBodies: Record<string, unknown>[] = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/cms/assets/1') && init?.method === 'PUT') {
        putBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      if (url.endsWith('/api/cms/assets/1')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              id: 1,
              fileName: 'a.png',
              fileMime: 'image/png',
              file: {
                type: 'Buffer',
                data: Array.from(new TextEncoder().encode('original')),
              },
            },
          }),
        } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            id: 1,
            contentId: 7,
            fileName: 'a.png',
            fileMime: 'image/png',
            filePreviewUrl: 'data:image/png;base64,aaa',
            sortOrder: 10,
          }],
        }),
      } as Response;
    });

    render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('images')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    const editButton = await screen.findByRole('button', { name: 'Edit a.png' });
    fireEvent.click(editButton);
    expect(await screen.findByRole('dialog', { name: 'Edit a.png' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apply image edit' }));

    await waitFor(() => expect(putBodies).toHaveLength(1));
    expect(putBodies[0]).toMatchObject({
      fileName: 'edited-output.bin',
      fileMime: 'application/octet-stream',
      fileSize: 6,
    });
    expect(String(putBodies[0].file)).toMatch(/^data:application\/octet-stream;base64,/);

    fetchMock.mockRestore();
  });

  it('reorders images without reloading the whole assets list', async () => {
    const putBodies: Array<{ sortOrder: number }> = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/cms/assets') && init?.method === 'PUT') {
        putBodies.push(JSON.parse(String(init.body)) as { sortOrder: number });
        return { ok: true, json: async () => ({ success: true }) } as Response;
      }
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 1,
              contentId: 7,
              fileName: 'a.png',
              fileMime: 'image/png',
              filePreviewUrl: 'data:image/png;base64,aaa',
              sortOrder: 10,
            },
            {
              id: 2,
              contentId: 7,
              fileName: 'b.png',
              fileMime: 'image/png',
              filePreviewUrl: 'data:image/png;base64,bbb',
              sortOrder: 10,
            },
          ],
        }),
      } as Response;
    });

    const { container } = render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('images')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('[data-cms-asset-id]').length).toBe(2);
    });

    const tiles = container.querySelectorAll('[data-cms-asset-id]');
    const source = tiles[0] as HTMLElement;
    const rectMock = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const index = this.getAttribute('data-cms-asset-id') === '2' ? 1 : 0;
      return {
        x: index * 105,
        y: 0,
        left: index * 105,
        top: 0,
        right: (index * 105) + 100,
        bottom: 100,
        width: 100,
        height: 100,
        toJSON: () => ({}),
      } as DOMRect;
    });
    source.focus();
    fireEvent.keyDown(source, { key: ' ', code: 'Space' });
    await waitFor(() => expect(source.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    fireEvent.keyDown(source, { key: 'ArrowRight', code: 'ArrowRight' });
    await waitFor(() => {
      expect(container.querySelector('[aria-live="assertive"]')?.textContent).toContain('droppable area 2');
    });
    fireEvent.keyDown(source, { key: ' ', code: 'Space' });

    await waitFor(() => {
      expect(putBodies.length).toBeGreaterThan(0);
    });
    expect(screen.getAllByRole('button', { name: /delete/i })).toHaveLength(2);
    expect(putBodies).toEqual([{ sortOrder: 20 }]);
    expect(
      Array.from(container.querySelectorAll('[data-cms-asset-id]'))
        .map((tile) => tile.getAttribute('data-cms-asset-id')),
    ).toEqual(['2', '1']);

    rectMock.mockRestore();
    fetchMock.mockRestore();
  });

  it('does not refetch broken image previews in a loop', async () => {
    let previewFetches = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (/\/api\/cms\/assets\/\d+(?:\?|$)/.test(url) || /\/api\/cms\/assets\/\d+$/.test(url)) {
        previewFetches += 1;
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: { fileMime: 'image/png', file: 'not-a-valid-image' },
          }),
        } as Response;
      }
      if (url.includes('/api/cms/assets')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: [
              {
                id: 1,
                contentId: 7,
                fileName: 'broken.png',
                fileMime: 'image/png',
                sortOrder: 10,
              },
            ],
          }),
        } as Response;
      }
      return { ok: true, json: async () => ({ success: true, data: [] }) } as Response;
    });

    const { container } = render(
      <DesignerRuntimeCmsContentAssets
        node={buildNode('images')}
        options={{
          mode: 'runtime',
          designerStore: { routeParams: { id: '7' } },
          bindingDefinitions,
          previewEvents: buildPreviewEvents(),
        }}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector('img')).toBeTruthy();
    });

    const image = container.querySelector('img') as HTMLImageElement;
    fireEvent.error(image);

    await new Promise((resolve) => window.setTimeout(resolve, 100));
    expect(previewFetches).toBeLessThanOrEqual(1);

    fetchMock.mockRestore();
  });
});
