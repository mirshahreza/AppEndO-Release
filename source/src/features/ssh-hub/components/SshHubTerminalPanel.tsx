import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { SshHubConnectionPublic } from '../../../shared/api/contracts/ssh-hub/types';
import { buildSshHubSessionUrl } from '../sshHubRoute';
import { readXtermSnapshot } from '../lib/readXtermSnapshot';

export type SshHubTerminalStatus = 'connecting' | 'connected' | 'disconnected';

export type SshHubTerminalHandle = {
  readSnapshot: () => string;
  sendInput: (data: string) => boolean;
};

type SshHubTerminalPanelProps = {
  connection: SshHubConnectionPublic;
  reconnectToken: number;
  onStatusChange: (status: SshHubTerminalStatus) => void;
};

export const SshHubTerminalPanel = forwardRef<SshHubTerminalHandle, SshHubTerminalPanelProps>(({
  connection,
  reconnectToken,
  onStatusChange,
}, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  useImperativeHandle(ref, () => ({
    readSnapshot: () => {
      const term = termRef.current;
      return term ? readXtermSnapshot(term) : '';
    },
    sendInput: (data: string) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }
      socket.send(data);
      return true;
    },
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: 13,
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#38bdf8',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    try {
      if (container.clientWidth >= 8 && container.clientHeight >= 8) {
        fitAddon.fit();
      }
    } catch {
      // ignore zero-size fit before layout
    }
    termRef.current = term;
    fitRef.current = fitAddon;

    const socket = new WebSocket(buildSshHubSessionUrl());
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;
    onStatusChangeRef.current('connecting');
    term.writeln(`Connecting to ${connection.username}@${connection.host}:${connection.port}…`);

    const sendResize = () => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
    };

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        type: 'authenticate',
        connectionId: connection.id,
        cols: term.cols,
        rows: term.rows,
      }));
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        const trimmed = event.data.trim();
        if (trimmed.startsWith('{')) {
          try {
            const message = JSON.parse(trimmed) as { type?: string; message?: string };
            if (message.type === 'ready') {
              onStatusChangeRef.current('connected');
              return;
            }
            if (message.type === 'error') {
              term.writeln(`\r\n\x1b[31m${message.message || 'SSH error'}\x1b[0m`);
              onStatusChangeRef.current('disconnected');
              return;
            }
            if (message.type === 'exit') {
              term.writeln('\r\n[session closed]');
              onStatusChangeRef.current('disconnected');
              return;
            }
          } catch {
            // fall through as terminal output
          }
        }
        term.write(event.data);
        return;
      }
      const bytes = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : new Uint8Array(event.data);
      term.write(bytes);
    });

    socket.addEventListener('close', () => {
      onStatusChangeRef.current('disconnected');
    });
    socket.addEventListener('error', () => {
      term.writeln('\r\n\x1b[31mWebSocket connection failed.\x1b[0m');
      onStatusChangeRef.current('disconnected');
    });

    const dataDisposable = term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });
    const resizeDisposable = term.onResize(sendResize);

    const observer = new ResizeObserver(() => {
      try {
        if (container.clientWidth >= 8 && container.clientHeight >= 8) {
          fitAddon.fit();
        }
      } catch {
        // ignore fit races during unmount
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      fitAddon.dispose();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [connection.host, connection.id, connection.port, connection.username, reconnectToken]);

  return (
    <div className="min-h-0 min-w-0 flex-[1_1_0] bg-slate-950 p-2">
      <div ref={containerRef} className="h-full min-h-0 w-full overflow-hidden" />
    </div>
  );
});

SshHubTerminalPanel.displayName = 'SshHubTerminalPanel';
