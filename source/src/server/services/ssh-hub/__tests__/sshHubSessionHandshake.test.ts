import http from 'node:http';
import { once } from 'node:events';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../remote-hubs/remoteHubsRuntime', () => ({
  isRemoteHubsRuntimeEnabled: () => true,
}));

import { ACCESS_COOKIE_NAME } from '../../../constants/auth';
import { resetAuthSecretsForTests } from '../../../config/authSecrets';
import { signAccessToken } from '../../auth/token.service';
import {
  isRemoteHubLibraryInstalled,
  requireRemoteHubLibrary,
} from '../../remote-hubs/requireRemoteHubLibrary';
import {
  closeAllSshHubSessions,
  handleSshHubUpgrade,
  SSH_HUB_SESSION_PATH,
} from '../sshHubSession';

const hasWs = isRemoteHubLibraryInstalled('ws');
const hasSsh2 = isRemoteHubLibraryInstalled('ssh2');
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

const waitMessage = (socket: InstanceType<WsModule['WebSocket']>, timeoutMs = 2_000): Promise<string> => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Timed out waiting for WebSocket message.')), timeoutMs);
  socket.once('message', (data) => {
    clearTimeout(timer);
    resolve(typeof data === 'string' ? data : Buffer.from(data as Buffer).toString('utf8'));
  });
  socket.once('close', (code) => {
    clearTimeout(timer);
    reject(new Error(`WebSocket closed (${code}) before a message arrived.`));
  });
});

describe.skipIf(!hasWs || !hasSsh2)('SSH Hub session handshake', () => {
  let WebSocket!: WsModule['WebSocket'];
  const servers: http.Server[] = [];
  const sockets: InstanceType<WsModule['WebSocket']>[] = [];

  beforeAll(() => {
    WebSocket = requireRemoteHubLibrary<WsModule>('ws').WebSocket;
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    }
    sockets.length = 0;
    closeAllSshHubSessions();
    await Promise.all(servers.splice(0).map((server) => closeServer(server)));
  });

  it('keeps the tunnel open after upgrade until authenticate', async () => {
    resetAuthSecretsForTests();
    const token = signAccessToken({
      id: 1,
      email: 'admin@appendo.test',
      role: 'ADMIN',
      roles: ['ADMIN'],
    });
    const server = http.createServer();
    servers.push(server);
    server.on('upgrade', (req, socket, head) => {
      const handled = handleSshHubUpgrade(req, socket, head);
      expect(handled).toBe(true);
    });

    const port = await listen(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${SSH_HUB_SESSION_PATH}`, {
      headers: { Cookie: `${ACCESS_COOKIE_NAME}=${token}` },
    });
    sockets.push(ws);

    await once(ws, 'open');
    expect(ws.readyState).toBe(WebSocket.OPEN);
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('returns an error JSON frame when authenticate has no connectionId', async () => {
    resetAuthSecretsForTests();
    const token = signAccessToken({
      id: 1,
      email: 'admin@appendo.test',
      role: 'ADMIN',
      roles: ['ADMIN'],
    });
    const server = http.createServer();
    servers.push(server);
    server.on('upgrade', (req, socket, head) => {
      handleSshHubUpgrade(req, socket, head);
    });

    const port = await listen(server);
    const ws = new WebSocket(`ws://127.0.0.1:${port}${SSH_HUB_SESSION_PATH}`, {
      headers: { Cookie: `${ACCESS_COOKIE_NAME}=${token}` },
    });
    sockets.push(ws);

    await once(ws, 'open');
    const errorMessage = waitMessage(ws);
    ws.send(JSON.stringify({ type: 'authenticate', connectionId: '', cols: 80, rows: 24 }));
    const raw = await errorMessage;
    const payload = JSON.parse(raw) as { type?: string; message?: string };
    expect(payload.type).toBe('error');
    expect(payload.message).toMatch(/connectionId/i);
  });
});
