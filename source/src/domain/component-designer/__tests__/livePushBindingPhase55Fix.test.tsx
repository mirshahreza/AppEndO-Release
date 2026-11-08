/**
 * @vitest-environment jsdom
 *
 * Bug found (gap analysis #32 / Phase 55): Binding had pollingIntervalMs but no native
 * SSE/WebSocket push path — live dashboards and chat could not update without timers.
 * Fixed in liveDataSource.ts / types.ts / bindingLovRegistry.ts /
 * bindingDynamicActionsCodegen.ts / designerRuntimePreview.tsx / bindingApiCodegen.ts /
 * bindingCodegen.ts / InspectorSharedComponentsPanel.tsx / DesignerRuntimePlatformChrome.tsx:
 * DataSourceDefinition.liveMode + useLiveDataSource writes snapshots into hydration/export
 * fetch state; browser connects directly to `{endpoint}/stream` (not via AppEndO Node fan-out).
 */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor, act } from '@testing-library/react';
import { CultureProvider } from '../../../core/culture/CultureContext';
import { createInitialDesignerState, designerReducer } from '../state';
import { DesignerDocumentPreview } from '../designerRuntimePreview';
import { createGridListResourceBindingDefinition, GRID_LIST_RESOURCE_BINDING_KEY } from '../bindingGridEngine';
import { sanitizeDataSourceDefinition } from '../bindingLovRegistry';
import { generateDesignerTsx } from '../codegen';
import {
  applyLiveAppend,
  buildLiveStreamUrl,
  parseLivePushPayload,
  subscribeLiveDataSource,
} from '../liveDataSource';
import { DesignerChatWidget } from '../DesignerRuntimePlatformChrome';
import { collectPreviewDataSourceHydrationTargets } from '../bindingDynamicActionsCodegen';

const renderWithCulture = (ui: React.ReactElement) =>
  render(<CultureProvider cultureId="us">{ui}</CultureProvider>);

type MockSocket = {
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  close: ReturnType<typeof vi.fn>;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
};

describe('Phase 55 — Real-time Push Binding (WebSocket/SSE)', () => {
  let sockets: MockSocket[];

  beforeEach(() => {
    sockets = [];
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;
      onopen: MockSocket['onopen'] = null;
      onmessage: MockSocket['onmessage'] = null;
      onerror: MockSocket['onerror'] = null;
      onclose: MockSocket['onclose'] = null;
      readyState = FakeWebSocket.CONNECTING;
      close = vi.fn(() => {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.(new CloseEvent('close'));
      });
      send = vi.fn();
      constructor(public url: string) {
        sockets.push(this as unknown as MockSocket);
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.(new Event('open'));
        });
      }
    }
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sanitize preserves liveMode type and channel', () => {
    const sanitized = sanitizeDataSourceDefinition({
      id: 'orders',
      name: 'Orders',
      endpoint: '/api/orders',
      fields: ['id'],
      liveMode: { type: 'websocket', channel: 'ops' },
      pollingIntervalMs: 5000,
    }, 'orders');
    expect(sanitized?.liveMode).toEqual({ type: 'websocket', channel: 'ops' });
    expect(sanitized?.pollingIntervalMs).toBe(5000);
  });

  it('buildLiveStreamUrl appends /stream and channel query', () => {
    expect(buildLiveStreamUrl('/api/orders', { type: 'sse', channel: 'live' })).toBe(
      '/api/orders/stream?channel=live',
    );
    expect(buildLiveStreamUrl('https://api.example.com/orders', { type: 'websocket' })).toBe(
      'wss://api.example.com/orders/stream',
    );
  });

  it('parseLivePushPayload recognizes snapshot / append / refresh', () => {
    expect(parseLivePushPayload(JSON.stringify({ type: 'refresh' }))).toEqual({ kind: 'refresh' });
    expect(parseLivePushPayload(JSON.stringify({ type: 'append', data: { id: 2 } }))).toEqual({
      kind: 'append',
      data: { id: 2 },
    });
    expect(parseLivePushPayload(JSON.stringify([{ id: 1 }]))).toEqual({
      kind: 'snapshot',
      data: [{ id: 1 }],
    });
  });

  it('applyLiveAppend concatenates rows onto an existing array', () => {
    expect(applyLiveAppend([{ id: 1 }], { id: 2 })).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('subscribeLiveDataSource delivers WebSocket snapshot to onSnapshot', async () => {
    const onSnapshot = vi.fn();
    const subscription = subscribeLiveDataSource('/api/orders/stream', 'websocket', { onSnapshot });
    await act(async () => {
      await Promise.resolve();
    });
    expect(sockets).toHaveLength(1);
    act(() => {
      sockets[0]!.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({ type: 'snapshot', data: [{ id: 9, name: 'Live' }] }),
        }),
      );
    });
    expect(onSnapshot).toHaveBeenCalledWith([{ id: 9, name: 'Live' }]);
    subscription.close();
  });

  it('Preview hydration targets carry liveMode and open a WebSocket that updates bound rows', async () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['id', 'name'],
        liveMode: { type: 'websocket', channel: 'floor' },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    const targets = collectPreviewDataSourceHydrationTargets(state.document, state.bindingDefinitions);
    expect(targets.some((target) => target.liveMode?.type === 'websocket' && target.liveMode.channel === 'floor')).toBe(true);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ id: 1, name: 'Seed' }]), { status: 200 }),
    );

    const { findByText } = renderWithCulture(
      <DesignerDocumentPreview
        document={state.document}
        bindingDefinitions={state.bindingDefinitions}
      />,
    );

    await waitFor(() => {
      expect(sockets.length).toBeGreaterThan(0);
    });

    await act(async () => {
      sockets[0]!.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'snapshot',
            data: [{ id: 42, name: 'Pushed Order' }],
          }),
        }),
      );
      await Promise.resolve();
    });

    expect(await findByText('Pushed Order')).toBeTruthy();
  });

  it('Export codegen emits useLiveDataSource for a liveMode data source', () => {
    let state = createInitialDesignerState();
    state = designerReducer(state, {
      type: 'insert-palette-item',
      itemId: 'heroui.data-grid',
      parentId: state.document.rootNodeId,
    });
    const gridNodeId = state.document.nodes[state.document.rootNodeId].children[0]!;

    state = designerReducer(state, {
      type: 'set-data-source',
      dataSourceId: 'orders',
      dataSource: {
        id: 'orders',
        name: 'Orders',
        endpoint: '/api/orders',
        fields: ['id', 'name'],
        liveMode: { type: 'sse', channel: 'ops' },
      },
    });

    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: gridNodeId,
      bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
      definition: createGridListResourceBindingDefinition('orders'),
    });

    const tsx = generateDesignerTsx(state.document, state.bindingDefinitions);
    expect(tsx).toContain('function useLiveDataSource');
    expect(tsx).toContain('useLiveDataSource({');
    expect(tsx).toContain('/api/orders/stream?channel=ops');
    expect(tsx).toContain('type: "sse"');
    expect(tsx).toContain('setData_');
  });

  it('DesignerChatWidget appends a live WebSocket message into the list', async () => {
    const { getAllByTestId, getByTestId } = render(
      <DesignerChatWidget
        channelRef="support"
        liveUrl="/api/chat/stream"
        liveType="websocket"
      />,
    );

    await waitFor(() => {
      expect(sockets.length).toBeGreaterThan(0);
    });

    expect(getByTestId('chat-message-list').textContent).toMatch(/No messages yet/);

    await act(async () => {
      sockets[0]!.onmessage?.(
        new MessageEvent('message', {
          data: JSON.stringify({
            type: 'append',
            data: { id: 'm1', author: 'Agent', text: 'Hello live' },
          }),
        }),
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getAllByTestId('chat-message')[0]?.textContent).toContain('Hello live');
    });
  });
});
