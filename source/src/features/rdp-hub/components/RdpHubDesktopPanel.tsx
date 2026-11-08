import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import type { RdpHubConnectionPublic } from '../../../shared/api/contracts/rdp-hub/types';
import { createRdpHubSessionTicket } from '../../../shared/api/queries/rdp-hub';
import { formatQueryError } from '../../../shared/api/client';
import { buildRdpHubSessionUrl } from '../rdpHubRoute';

export type RdpHubDesktopStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type RdpHubDesktopPanelProps = {
  connection: RdpHubConnectionPublic;
  reconnectToken: number;
  onStatusChange: (status: RdpHubDesktopStatus) => void;
};

type GuacamoleClient = {
  connect: (data?: string) => void;
  disconnect: () => void;
  getDisplay: () => { getElement: () => HTMLElement };
  sendMouseState: (state: unknown) => void;
  sendKeyEvent: (pressed: number, keysym: number) => void;
  sendSize: (width: number, height: number) => void;
  createClipboardStream: (mimetype: string) => unknown;
  onclipboard: ((stream: unknown, mimetype: string) => void) | null;
  onerror: ((status: { code?: number; message?: string }) => void) | null;
  onstatechange: ((state: number) => void) | null;
};

const CONNECTED_STATE = 3;

function sendClipboardText(client: GuacamoleClient, text: string): void {
  const stream = client.createClipboardStream('text/plain');
  const writer = new Guacamole.StringWriter(stream);
  writer.sendText(text);
  writer.sendEnd();
}

export const RdpHubDesktopPanel: React.FC<RdpHubDesktopPanelProps> = ({
  connection,
  reconnectToken,
  onStatusChange,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const displayRef = useRef<HTMLDivElement | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  const [errorText, setErrorText] = useState<string | null>(null);
  onStatusChangeRef.current = onStatusChange;

  useEffect(() => {
    const host = hostRef.current;
    const displayHost = displayRef.current;
    if (!host || !displayHost) {
      return;
    }

    let cancelled = false;
    let client: GuacamoleClient | null = null;
    let keyboard: { onkeydown: ((keysym: number) => boolean | void) | null; onkeyup: ((keysym: number) => boolean | void) | null; reset: () => void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let captureKeys = false;
    setErrorText(null);

    const measure = () => ({
      width: Math.max(320, Math.floor(host.clientWidth || 1280)),
      height: Math.max(240, Math.floor(host.clientHeight || 800)),
    });

    const focusDisplay = () => {
      displayHost.focus();
    };
    displayHost.addEventListener('mousedown', focusDisplay);

    const bindInput = (nextClient: GuacamoleClient) => {
      const displayElement = nextClient.getDisplay().getElement();
      displayElement.style.outline = 'none';
      displayHost.replaceChildren(displayElement);
      displayHost.tabIndex = 0;
      displayHost.focus();
      captureKeys = true;

      const mouse = new Guacamole.Mouse(displayElement);
      const sendMouse = (state: unknown) => {
        nextClient.sendMouseState(state);
      };
      mouse.onmousedown = sendMouse;
      mouse.onmouseup = sendMouse;
      mouse.onmousemove = sendMouse;

      keyboard = new Guacamole.Keyboard(window);
      const isDisplayFocused = () => (
        captureKeys
        && (document.activeElement === displayHost || displayHost.contains(document.activeElement))
      );
      keyboard.onkeydown = (keysym) => {
        if (!isDisplayFocused()) {
          return;
        }
        nextClient.sendKeyEvent(1, keysym);
        return false;
      };
      keyboard.onkeyup = (keysym) => {
        if (!isDisplayFocused()) {
          return;
        }
        nextClient.sendKeyEvent(0, keysym);
        return false;
      };

      nextClient.onclipboard = (stream, mimetype) => {
        if (!mimetype.startsWith('text/')) {
          return;
        }
        let data = '';
        const reader = new Guacamole.StringReader(stream);
        reader.ontext = (text) => {
          data += text;
        };
        reader.onend = () => {
          void navigator.clipboard.writeText(data).catch(() => undefined);
        };
      };
    };

    const sendSize = (nextClient: GuacamoleClient) => {
      const { width, height } = measure();
      nextClient.sendSize(width, height);
    };

    const onPaste = (event: ClipboardEvent) => {
      if (!captureKeys || !client) {
        return;
      }
      const text = event.clipboardData?.getData('text/plain');
      if (text) {
        sendClipboardText(client, text);
      }
    };

    const onWindowBlur = () => {
      keyboard?.reset();
    };

    const start = async () => {
      onStatusChangeRef.current('connecting');
      const { width, height } = measure();
      try {
        const ticket = await createRdpHubSessionTicket(connection.id, { width, height });
        if (cancelled) {
          return;
        }

        const tunnel = new Guacamole.WebSocketTunnel(buildRdpHubSessionUrl());
        client = new Guacamole.Client(tunnel) as unknown as GuacamoleClient;
        bindInput(client);

        client.onstatechange = (state) => {
          if (state === CONNECTED_STATE) {
            onStatusChangeRef.current('connected');
            if (client) {
              sendSize(client);
            }
            return;
          }
          if (state >= 4) {
            onStatusChangeRef.current('disconnected');
          }
        };

        client.onerror = (status) => {
          const message = status.message || 'RDP connection failed.';
          setErrorText(message);
          onStatusChangeRef.current('error');
        };

        client.connect(`token=${encodeURIComponent(ticket.token)}`);
        resizeObserver = new ResizeObserver(() => {
          if (client) {
            sendSize(client);
          }
        });
        resizeObserver.observe(host);
        window.addEventListener('paste', onPaste);
        window.addEventListener('blur', onWindowBlur);
      } catch (error) {
        if (!cancelled) {
          const message = formatQueryError(error, 'Failed to open RDP session.');
          setErrorText(message);
          onStatusChangeRef.current('error');
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      captureKeys = false;
      displayHost.removeEventListener('mousedown', focusDisplay);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('blur', onWindowBlur);
      resizeObserver?.disconnect();
      keyboard?.reset();
      keyboard = null;
      try {
        client?.disconnect();
      } catch {
        // ignore
      }
      client = null;
      displayHost.replaceChildren();
    };
  }, [connection.host, connection.id, connection.port, connection.username, reconnectToken]);

  return (
    <div ref={hostRef} className="relative min-h-0 flex-1 overflow-hidden bg-slate-950">
      <div
        ref={displayRef}
        className="h-full w-full overflow-hidden outline-none"
        tabIndex={0}
        aria-label={`Remote desktop ${connection.name}`}
      />
      {errorText ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 py-2">
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
            {errorText}
          </p>
        </div>
      ) : null}
    </div>
  );
};
