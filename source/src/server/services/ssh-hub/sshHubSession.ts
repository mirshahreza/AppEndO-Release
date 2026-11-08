import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { URL } from 'node:url';
import jwt from 'jsonwebtoken';
import { ACCESS_COOKIE_NAME, getAccessTokenSecret } from '../../constants/auth';
import { logger } from '../../../core/logging/Logger';
import { toJwtAuthPayload } from '../../middleware/auth.middleware';
import { buildSshInitialCdInput } from '../../../shared/api/contracts/ssh-hub/validation';
import { isRemoteHubsRuntimeEnabled } from '../remote-hubs/remoteHubsRuntime';
import { requireRemoteHubLibrary } from '../remote-hubs/requireRemoteHubLibrary';
import { getSshHubConnectionSecrets } from './sshHubStore';

type Ssh2Module = typeof import('ssh2');
type WsModule = typeof import('ws');
type Client = InstanceType<Ssh2Module['Client']>;
type ClientChannel = import('ssh2').ClientChannel;
type WebSocket = InstanceType<WsModule['WebSocket']>;
type WebSocketServer = InstanceType<WsModule['WebSocketServer']>;

function loadSsh2(): Ssh2Module {
  return requireRemoteHubLibrary<Ssh2Module>('ssh2');
}

function loadWs(): WsModule {
  return requireRemoteHubLibrary<WsModule>('ws');
}

export const SSH_HUB_SESSION_PATH = '/api/ssh-hub/session';
const SSH_CONNECT_TIMEOUT_MS = 20_000;
const SSH_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 8;
const MAX_SESSIONS_TOTAL = 50;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;

type SessionAuth = {
  userId: number;
  email: string;
  roles: string[];
};

type BridgedSession = {
  ws: WebSocket;
  client: Client;
  stream: ClientChannel | null;
  userId: number;
  connectionId: string;
  idleTimer: NodeJS.Timeout | null;
  disposed: boolean;
};

export function decodeSshHubWsMessage(data: WebSocket.RawData): string {
  if (typeof data === 'string') {
    return data;
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8');
  }
  if (Buffer.isBuffer(data)) {
    return data.toString('utf8');
  }
  return Buffer.from(data).toString('utf8');
}

const sessions = new Set<BridgedSession>();
const claimedUpgradeSockets = new WeakSet<Duplex>();
let sshWss: WebSocketServer | null = null;

export type SshHubClientConnectAuth = {
  password?: string;
  privateKey?: string;
  passphrase?: string;
};

/** Password auth matches the original Hub and File Hub SFTP: `password` only. */
export function buildSshHubClientConnectAuth(input: {
  authMethod: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}): SshHubClientConnectAuth | { error: string } {
  if (input.authMethod === 'privateKey' && input.privateKey) {
    return {
      privateKey: input.privateKey,
      ...(input.passphrase ? { passphrase: input.passphrase } : {}),
    };
  }
  if (input.password) {
    return { password: input.password };
  }
  return { error: 'Stored credentials are missing for this connection.' };
}

function parseCookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) {
    return undefined;
  }
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) {
      continue;
    }
    const key = part.slice(0, index).trim();
    if (key !== name) {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      return part.slice(index + 1).trim();
    }
  }
  return undefined;
}

function authenticateUpgrade(req: IncomingMessage): SessionAuth | null {
  const token = parseCookieValue(req.headers.cookie, ACCESS_COOKIE_NAME);
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret());
    const payload = toJwtAuthPayload(decoded);
    if (!payload || payload.type !== 'access') {
      return null;
    }
    const roles = payload.roles && payload.roles.length > 0
      ? payload.roles.map((role) => role.toUpperCase())
      : [payload.role.toUpperCase()];
    if (!roles.includes('ADMIN')) {
      return null;
    }
    return {
      userId: payload.sub,
      email: payload.email,
      roles,
    };
  } catch {
    return null;
  }
}

function rejectUpgrade(socket: { write: (chunk: string) => void; destroy: () => void }, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function countUserSessions(userId: number): number {
  let count = 0;
  for (const session of sessions) {
    if (session.userId === userId) {
      count += 1;
    }
  }
  return count;
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function touchIdle(session: BridgedSession): void {
  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
  }
  session.idleTimer = setTimeout(() => {
    disposeSession(session, 'Idle timeout.');
  }, SSH_IDLE_TIMEOUT_MS);
}

function disposeSession(session: BridgedSession, reason?: string): void {
  if (session.disposed) {
    return;
  }
  session.disposed = true;
  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }
  sessions.delete(session);
  try {
    session.stream?.end();
  } catch {
    // ignore
  }
  try {
    session.client.end();
  } catch {
    try {
      session.client.destroy();
    } catch {
      // ignore
    }
  }
  if (reason && session.ws.readyState === WebSocket.OPEN) {
    sendJson(session.ws, { type: 'error', message: reason });
  }
  try {
    session.ws.close();
  } catch {
    // ignore
  }
}

function parseControlMessage(raw: string): { type: string; [key: string]: unknown } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown };
    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return null;
    }
    return parsed as { type: string };
  } catch {
    return null;
  }
}

async function startSshSession(session: BridgedSession, connectionId: string, cols: number, rows: number): Promise<void> {
  let resolved: Awaited<ReturnType<typeof getSshHubConnectionSecrets>>;
  try {
    resolved = await getSshHubConnectionSecrets(connectionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not read stored SSH credentials.';
    sendJson(session.ws, { type: 'error', message });
    session.ws.close();
    return;
  }
  if (session.disposed) {
    return;
  }
  if (!resolved) {
    sendJson(session.ws, { type: 'error', message: 'SSH connection was not found.' });
    session.ws.close();
    return;
  }

  const { record, secrets } = resolved;
  session.connectionId = record.id;
  logger.info('SshHub', 'Opening SSH session', {
    connectionId: record.id,
    host: record.host,
    port: record.port,
    username: record.username,
    userId: session.userId,
  });

  const authConfig = buildSshHubClientConnectAuth({
    authMethod: record.authMethod,
    password: secrets.password,
    privateKey: secrets.privateKey,
    passphrase: secrets.passphrase,
  });
  if ('error' in authConfig) {
    sendJson(session.ws, { type: 'error', message: authConfig.error });
    session.ws.close();
    return;
  }

  session.client
    .on('ready', () => {
      session.client.shell({
        term: 'xterm-256color',
        cols,
        rows,
      }, (error, stream) => {
        if (error || !stream) {
          disposeSession(session, error?.message || 'Failed to open SSH shell.');
          return;
        }
        session.stream = stream;
        const cdInput = buildSshInitialCdInput(record.initialPath ?? '');
        if (cdInput) {
          stream.write(cdInput);
        }
        sendJson(session.ws, { type: 'ready', connectionId: record.id });
        touchIdle(session);

        stream.on('data', (chunk: Buffer) => {
          touchIdle(session);
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(chunk);
          }
        });
        stream.stderr?.on('data', (chunk: Buffer) => {
          touchIdle(session);
          if (session.ws.readyState === WebSocket.OPEN) {
            session.ws.send(chunk);
          }
        });
        stream.on('close', () => {
          sendJson(session.ws, { type: 'exit' });
          disposeSession(session);
        });
      });
    })
    .on('error', (error) => {
      logger.warn('SshHub', 'SSH client error', {
        connectionId: record.id,
        host: record.host,
        userId: session.userId,
        message: error instanceof Error ? error.message : 'SSH error',
      });
      disposeSession(session, error instanceof Error ? error.message : 'SSH connection failed.');
    })
    .on('close', () => {
      disposeSession(session);
    });

  session.client.connect({
    host: record.host,
    port: record.port,
    username: record.username,
    readyTimeout: SSH_CONNECT_TIMEOUT_MS,
    keepaliveInterval: 15_000,
    ...authConfig,
  });
}

function bindSocket(ws: WebSocket, auth: SessionAuth): void {
  const session: BridgedSession = {
    ws,
    client: new (loadSsh2().Client)(),
    stream: null,
    userId: auth.userId,
    connectionId: '',
    idleTimer: null,
    disposed: false,
  };
  sessions.add(session);
  touchIdle(session);

  ws.on('message', (data) => {
    if (session.disposed) {
      return;
    }
    const raw = decodeSshHubWsMessage(data);
    const control = parseControlMessage(raw);
    if (control?.type === 'authenticate') {
      if (session.stream) {
        return;
      }
      const connectionId = typeof control.connectionId === 'string' ? control.connectionId.trim() : '';
      if (!connectionId) {
        sendJson(ws, { type: 'error', message: 'connectionId is required.' });
        return;
      }
      const cols = typeof control.cols === 'number' && Number.isFinite(control.cols) ? Math.max(20, Math.floor(control.cols)) : DEFAULT_COLS;
      const rows = typeof control.rows === 'number' && Number.isFinite(control.rows) ? Math.max(8, Math.floor(control.rows)) : DEFAULT_ROWS;
      void startSshSession(session, connectionId, cols, rows);
      return;
    }
    if (control?.type === 'resize') {
      const cols = typeof control.cols === 'number' ? Math.max(20, Math.floor(control.cols)) : DEFAULT_COLS;
      const rows = typeof control.rows === 'number' ? Math.max(8, Math.floor(control.rows)) : DEFAULT_ROWS;
      try {
        session.stream?.setWindow(rows, cols, 0, 0);
      } catch {
        // ignore
      }
      return;
    }
    if (!session.stream) {
      sendJson(ws, { type: 'error', message: 'Authenticate before sending terminal input.' });
      return;
    }
    touchIdle(session);
    session.stream.write(raw);
  });

  ws.on('close', () => {
    disposeSession(session);
  });
  ws.on('error', () => {
    disposeSession(session);
  });
}

function ensureSshHubWss(): WebSocketServer {
  if (!sshWss) {
    sshWss = new (loadWs().WebSocketServer)({ noServer: true });
  }
  return sshWss;
}

export function handleSshHubUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  let pathname = '';
  try {
    pathname = new URL(req.url ?? '', 'https://appendo.local').pathname;
  } catch {
    return false;
  }
  if (pathname !== SSH_HUB_SESSION_PATH) {
    return false;
  }
  if (!isRemoteHubsRuntimeEnabled()) {
    rejectUpgrade(socket, 404, 'Not Found');
    return true;
  }
  if (claimedUpgradeSockets.has(socket)) {
    return true;
  }
  claimedUpgradeSockets.add(socket);

  const auth = authenticateUpgrade(req);
  if (!auth) {
    rejectUpgrade(socket, 401, 'Unauthorized');
    return true;
  }
  if (sessions.size >= MAX_SESSIONS_TOTAL) {
    rejectUpgrade(socket, 429, 'Too Many Requests');
    return true;
  }
  if (countUserSessions(auth.userId) >= MAX_SESSIONS_PER_USER) {
    rejectUpgrade(socket, 429, 'Too Many Requests');
    return true;
  }

  try {
    ensureSshHubWss().handleUpgrade(req, socket, head, (ws) => {
      bindSocket(ws, auth);
    });
  } catch (error) {
    claimedUpgradeSockets.delete(socket);
    logger.warn('SshHub', 'SSH Hub WebSocket upgrade failed', {
      message: error instanceof Error ? error.message : 'upgrade failed',
    });
    rejectUpgrade(socket, 503, 'Service Unavailable');
    return true;
  }
  return true;
}

export function closeAllSshHubSessions(): void {
  for (const session of [...sessions]) {
    disposeSession(session);
  }
}
