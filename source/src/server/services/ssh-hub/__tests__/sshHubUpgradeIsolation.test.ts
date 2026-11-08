import http from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  isRemoteHubLibraryInstalled,
  requireRemoteHubLibrary,
} from '../../remote-hubs/requireRemoteHubLibrary';

const SSH_PATH = '/api/ssh-hub/session';
const RDP_PATH = '/api/rdp-hub/session';
const hasWs = isRemoteHubLibraryInstalled('ws');

type WsModule = typeof import('ws');

const listen = (server: http.Server): Promise<number> => new Promise((resolve, reject) => {
  server.listen(0, '127.0.0.1', () => {
    const addr = server.address();
    if (typeof addr === 'object' && addr) {
      resolve(addr.port);
      return;
    }
    reject(new Error('Failed to bind test HTTP server.'));
  });
});

const closeServer = (server: http.Server): Promise<void> => new Promise((resolve) => {
  server.close(() => resolve());
});

describe.skipIf(!hasWs)('SSH Hub WebSocket upgrade isolation', () => {
  let WebSocket!: WsModule['WebSocket'];
  let WebSocketServer!: WsModule['WebSocketServer'];
  const servers: http.Server[] = [];
  const sockets: InstanceType<WsModule['WebSocket']>[] = [];
  const wssList: InstanceType<WsModule['WebSocketServer']>[] = [];

  beforeAll(() => {
    const ws = requireRemoteHubLibrary<WsModule>('ws');
    WebSocket = ws.WebSocket;
    WebSocketServer = ws.WebSocketServer;
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
    sockets.length = 0;
    for (const wss of wssList) {
      wss.close();
    }
    wssList.length = 0;
    await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  });

  it('keeps SSH upgrades alive when RDP ws is bound to a separate HTTP server', async () => {
    const publicServer = http.createServer();
    const rdpInternal = http.createServer();
    servers.push(publicServer, rdpInternal);

    const sshWss = new WebSocketServer({ noServer: true });
    const rdpWss = new WebSocketServer({ server: rdpInternal, path: RDP_PATH });
    wssList.push(sshWss, rdpWss);

    publicServer.on('upgrade', (req, socket, head) => {
      const pathname = new URL(req.url ?? '', 'https://appendo.local').pathname;
      if (pathname !== SSH_PATH) {
        return;
      }
      sshWss.handleUpgrade(req, socket, head, (ws) => {
        sshWss.emit('connection', ws, req);
      });
    });

    const port = await listen(publicServer);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${SSH_PATH}`);
    sockets.push(ws);
    await once(ws, 'open');
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('rejects SSH upgrades when a path-filtered ws server is bound to the same HTTP server', async () => {
    const publicServer = http.createServer();
    servers.push(publicServer);

    const sshWss = new WebSocketServer({ noServer: true });
    const rdpWss = new WebSocketServer({ server: publicServer, path: RDP_PATH });
    wssList.push(sshWss, rdpWss);

    publicServer.on('upgrade', (req, socket, head) => {
      const pathname = new URL(req.url ?? '', 'https://appendo.local').pathname;
      if (pathname !== SSH_PATH) {
        return;
      }
      sshWss.handleUpgrade(req, socket, head, (ws) => {
        sshWss.emit('connection', ws, req);
      });
    });

    const port = await listen(publicServer);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${SSH_PATH}`);
    sockets.push(ws);
    const [error] = await once(ws, 'error') as [Error];
    expect(error).toBeInstanceOf(Error);
    expect(ws.readyState).not.toBe(WebSocket.OPEN);
  });
});
