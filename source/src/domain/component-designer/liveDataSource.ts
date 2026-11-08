/**
 * Real-time push binding (SSE / WebSocket) for Designer data sources — Phase 55 / gap #32.
 *
 * Architecture note (Live Runtime / single Node): connections are opened **in the browser**
 * against the data source's own stream URL. AppEndO's Node process does not fan-out or hold
 * per-client push sockets for published pages, so concurrent live dashboards scale with the
 * upstream API (or a dedicated stream gateway) rather than with Designer process memory.
 */
import * as React from 'react';
import type { DesignerLiveMode, DesignerLiveModeType } from './types';

export type ActiveLiveModeType = Exclude<DesignerLiveModeType, 'none'>;

export type LivePushMessage =
  | { kind: 'snapshot'; data: unknown }
  | { kind: 'append'; data: unknown }
  | { kind: 'refresh' };

export type LiveDataSourceHandlers = {
  onSnapshot: (data: unknown) => void;
  onAppend?: (data: unknown) => void;
  onRefresh?: () => void;
  onError?: (error: string) => void;
  onStatus?: (status: LiveConnectionStatus) => void;
};

export type LiveConnectionStatus = 'idle' | 'connecting' | 'open' | 'error' | 'closed';

export const isActiveLiveMode = (
  liveMode: DesignerLiveMode | undefined | null,
): liveMode is DesignerLiveMode & { type: ActiveLiveModeType } =>
  liveMode?.type === 'sse' || liveMode?.type === 'websocket';

export const sanitizeLiveMode = (value: unknown): DesignerLiveMode | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const type = record.type;
  if (type !== 'none' && type !== 'sse' && type !== 'websocket') {
    return undefined;
  }
  const channel = typeof record.channel === 'string' && record.channel.trim()
    ? record.channel.trim()
    : undefined;
  if (type === 'none' && !channel) {
    return { type: 'none' };
  }
  return channel ? { type, channel } : { type };
};

/**
 * REST collection at `/api/orders` → stream at `/api/orders/stream`.
 * If the endpoint already ends with `/stream`, it is left as-is.
 */
export const buildLiveStreamUrl = (
  endpoint: string,
  liveMode: Pick<DesignerLiveMode, 'channel'> & { type: ActiveLiveModeType },
): string => {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return '';
  }

  let url = /\/stream(?:\?|$)/i.test(trimmed)
    ? trimmed
    : `${trimmed.replace(/\/$/, '')}/stream`;

  const channel = liveMode.channel?.trim();
  if (channel) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}channel=${encodeURIComponent(channel)}`;
  }

  if (liveMode.type === 'websocket') {
    if (url.startsWith('https://')) {
      return `wss://${url.slice('https://'.length)}`;
    }
    if (url.startsWith('http://')) {
      return `ws://${url.slice('http://'.length)}`;
    }
  }

  return url;
};

/** Resolve relative `/api/...` WebSocket paths against `window.location.origin`. */
export const absolutizeLiveStreamUrl = (
  url: string,
  type: ActiveLiveModeType,
  origin: string = typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
): string => {
  if (!url) {
    return '';
  }
  if (type === 'websocket') {
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url.replace(/^http/, 'ws');
    }
    const absoluteHttp = new URL(url, origin).href;
    return absoluteHttp.replace(/^http/, 'ws');
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  return new URL(url, origin).pathname + new URL(url, origin).search;
};

export const parseLivePushPayload = (raw: string): LivePushMessage | null => {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const record = parsed as Record<string, unknown>;
      const type = typeof record.type === 'string' ? record.type.trim().toLowerCase() : '';
      if (type === 'refresh') {
        return { kind: 'refresh' };
      }
      if (type === 'append') {
        return { kind: 'append', data: record.data ?? record.payload ?? record.row ?? record.rows };
      }
      if (type === 'snapshot' || type === 'data' || type === 'message') {
        return {
          kind: 'snapshot',
          data: 'data' in record ? record.data : ('payload' in record ? record.payload : parsed),
        };
      }
      if ('data' in record) {
        return { kind: 'snapshot', data: record.data };
      }
    }
    return { kind: 'snapshot', data: parsed };
  } catch {
    return { kind: 'snapshot', data: text };
  }
};

export const applyLiveAppend = (current: unknown, incoming: unknown): unknown => {
  const incomingRows = Array.isArray(incoming) ? incoming : [incoming];
  if (Array.isArray(current)) {
    return [...current, ...incomingRows];
  }
  if (current && typeof current === 'object') {
    const record = current as Record<string, unknown>;
    for (const key of ['data', 'rows', 'items', 'results'] as const) {
      const value = record[key];
      if (Array.isArray(value)) {
        return { ...record, [key]: [...value, ...incomingRows] };
      }
    }
  }
  return incomingRows;
};

export type LiveSubscription = {
  close: () => void;
};

/**
 * Imperative subscribe — used by Preview, tests, and the exported runtime helper string.
 */
export const subscribeLiveDataSource = (
  url: string,
  type: ActiveLiveModeType,
  handlers: LiveDataSourceHandlers,
): LiveSubscription => {
  const absoluteUrl = absolutizeLiveStreamUrl(url, type);
  if (!absoluteUrl) {
    handlers.onStatus?.('idle');
    return { close: () => undefined };
  }

  let closed = false;
  handlers.onStatus?.('connecting');

  const dispatchPayload = (raw: string) => {
    const message = parseLivePushPayload(raw);
    if (!message) {
      return;
    }
    if (message.kind === 'refresh') {
      handlers.onRefresh?.();
      return;
    }
    if (message.kind === 'append') {
      if (handlers.onAppend) {
        handlers.onAppend(message.data);
      } else {
        handlers.onSnapshot(message.data);
      }
      return;
    }
    handlers.onSnapshot(message.data);
  };

  if (type === 'sse') {
    const source = new EventSource(absoluteUrl, { withCredentials: true });
    source.onopen = () => {
      if (!closed) {
        handlers.onStatus?.('open');
      }
    };
    source.onmessage = (event) => {
      if (!closed) {
        dispatchPayload(String(event.data ?? ''));
      }
    };
    source.onerror = () => {
      if (!closed) {
        handlers.onStatus?.('error');
        handlers.onError?.('SSE connection error');
      }
    };
    return {
      close: () => {
        closed = true;
        source.close();
        handlers.onStatus?.('closed');
      },
    };
  }

  let socket: WebSocket;
  try {
    socket = new WebSocket(absoluteUrl);
  } catch (error) {
    handlers.onStatus?.('error');
    handlers.onError?.(error instanceof Error ? error.message : 'WebSocket open failed');
    return { close: () => undefined };
  }

  socket.onopen = () => {
    if (!closed) {
      handlers.onStatus?.('open');
    }
  };
  socket.onmessage = (event) => {
    if (!closed) {
      dispatchPayload(typeof event.data === 'string' ? event.data : String(event.data));
    }
  };
  socket.onerror = () => {
    if (!closed) {
      handlers.onStatus?.('error');
      handlers.onError?.('WebSocket connection error');
    }
  };
  socket.onclose = () => {
    if (!closed) {
      handlers.onStatus?.('closed');
    }
  };

  return {
    close: () => {
      closed = true;
      try {
        socket.close();
      } catch {
        // ignore
      }
      handlers.onStatus?.('closed');
    },
  };
};

export type UseLiveDataSourceOptions = {
  url: string;
  type: ActiveLiveModeType;
  enabled?: boolean;
  onSnapshot: (data: unknown) => void;
  onAppend?: (data: unknown) => void;
  onRefresh?: () => void;
};

/**
 * Runtime hook: keeps a single live subscription alive while `enabled` and `url` are set.
 */
export const useLiveDataSource = (options: UseLiveDataSourceOptions): {
  status: LiveConnectionStatus;
  error: string | null;
} => {
  const { url, type, enabled = true, onSnapshot, onAppend, onRefresh } = options;
  const [status, setStatus] = React.useState<LiveConnectionStatus>('idle');
  const [error, setError] = React.useState<string | null>(null);

  const onSnapshotRef = React.useRef(onSnapshot);
  const onAppendRef = React.useRef(onAppend);
  const onRefreshRef = React.useRef(onRefresh);
  onSnapshotRef.current = onSnapshot;
  onAppendRef.current = onAppend;
  onRefreshRef.current = onRefresh;

  React.useEffect(() => {
    if (!enabled || !url.trim()) {
      setStatus('idle');
      setError(null);
      return undefined;
    }

    const subscription = subscribeLiveDataSource(url, type, {
      onSnapshot: (data) => onSnapshotRef.current(data),
      onAppend: (data) => onAppendRef.current?.(data),
      onRefresh: () => onRefreshRef.current?.(),
      onError: (message) => setError(message),
      onStatus: setStatus,
    });

    return () => {
      subscription.close();
    };
  }, [enabled, url, type]);

  return { status, error };
};

/**
 * String-embedded helper for Export TSX (mirrors subscribeLiveDataSource + useLiveDataSource).
 * Kept in sync with the real module above — tests assert key symbols exist in the export bundle.
 */
export const renderUseLiveDataSourceRuntimeHelper = (): string[] => [
  'type DesignerLiveConnectionStatus = "idle" | "connecting" | "open" | "error" | "closed";',
  '',
  'const parseLivePushPayload = (raw: string): { kind: "snapshot" | "append" | "refresh"; data?: unknown } | null => {',
  '  const text = raw.trim();',
  '  if (!text) { return null; }',
  '  try {',
  '    const parsed: unknown = JSON.parse(text);',
  '    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {',
  '      const record = parsed as Record<string, unknown>;',
  '      const type = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";',
  '      if (type === "refresh") { return { kind: "refresh" }; }',
  '      if (type === "append") { return { kind: "append", data: record.data ?? record.payload ?? record.row ?? record.rows }; }',
  '      if (type === "snapshot" || type === "data" || type === "message") {',
  '        return { kind: "snapshot", data: "data" in record ? record.data : ("payload" in record ? record.payload : parsed) };',
  '      }',
  '      if ("data" in record) { return { kind: "snapshot", data: record.data }; }',
  '    }',
  '    return { kind: "snapshot", data: parsed };',
  '  } catch {',
  '    return { kind: "snapshot", data: text };',
  '  }',
  '};',
  '',
  'const applyLiveAppend = (current: unknown, incoming: unknown): unknown => {',
  '  const incomingRows = Array.isArray(incoming) ? incoming : [incoming];',
  '  if (Array.isArray(current)) { return [...current, ...incomingRows]; }',
  '  if (current && typeof current === "object") {',
  '    const record = current as Record<string, unknown>;',
  '    for (const key of ["data", "rows", "items", "results"] as const) {',
  '      const value = record[key];',
  '      if (Array.isArray(value)) { return { ...record, [key]: [...value, ...incomingRows] }; }',
  '    }',
  '  }',
  '  return incomingRows;',
  '};',
  '',
  'const absolutizeLiveStreamUrl = (url: string, type: "sse" | "websocket"): string => {',
  '  if (!url) { return ""; }',
  '  if (type === "websocket") {',
  '    if (url.startsWith("ws://") || url.startsWith("wss://")) { return url; }',
  '    if (url.startsWith("http://") || url.startsWith("https://")) { return url.replace(/^http/, "ws"); }',
  '    const absoluteHttp = new URL(url, window.location.origin).href;',
  '    return absoluteHttp.replace(/^http/, "ws");',
  '  }',
  '  return url;',
  '};',
  '',
  'function useLiveDataSource(options: {',
  '  url: string;',
  '  type: "sse" | "websocket";',
  '  enabled?: boolean;',
  '  onSnapshot: (data: unknown) => void;',
  '  onAppend?: (data: unknown) => void;',
  '  onRefresh?: () => void;',
  '}) {',
  '  const { url, type, enabled = true, onSnapshot, onAppend, onRefresh } = options;',
  '  const [status, setStatus] = React.useState<DesignerLiveConnectionStatus>("idle");',
  '  const onSnapshotRef = React.useRef(onSnapshot);',
  '  const onAppendRef = React.useRef(onAppend);',
  '  const onRefreshRef = React.useRef(onRefresh);',
  '  onSnapshotRef.current = onSnapshot;',
  '  onAppendRef.current = onAppend;',
  '  onRefreshRef.current = onRefresh;',
  '  React.useEffect(() => {',
  '    if (!enabled || !url.trim()) { setStatus("idle"); return undefined; }',
  '    const absoluteUrl = absolutizeLiveStreamUrl(url, type);',
  '    let closed = false;',
  '    setStatus("connecting");',
  '    const dispatchPayload = (raw: string) => {',
  '      const message = parseLivePushPayload(raw);',
  '      if (!message) { return; }',
  '      if (message.kind === "refresh") { onRefreshRef.current?.(); return; }',
  '      if (message.kind === "append") {',
  '        if (onAppendRef.current) { onAppendRef.current(message.data); }',
  '        else { onSnapshotRef.current(message.data); }',
  '        return;',
  '      }',
  '      onSnapshotRef.current(message.data);',
  '    };',
  '    if (type === "sse") {',
  '      const source = new EventSource(absoluteUrl, { withCredentials: true });',
  '      source.onopen = () => { if (!closed) { setStatus("open"); } };',
  '      source.onmessage = (event) => { if (!closed) { dispatchPayload(String(event.data ?? "")); } };',
  '      source.onerror = () => { if (!closed) { setStatus("error"); } };',
  '      return () => { closed = true; source.close(); setStatus("closed"); };',
  '    }',
  '    const socket = new WebSocket(absoluteUrl);',
  '    socket.onopen = () => { if (!closed) { setStatus("open"); } };',
  '    socket.onmessage = (event) => { if (!closed) { dispatchPayload(typeof event.data === "string" ? event.data : String(event.data)); } };',
  '    socket.onerror = () => { if (!closed) { setStatus("error"); } };',
  '    socket.onclose = () => { if (!closed) { setStatus("closed"); } };',
  '    return () => { closed = true; try { socket.close(); } catch {} setStatus("closed"); };',
  '  }, [enabled, url, type]);',
  '  return { status };',
  '}',
  '',
];
