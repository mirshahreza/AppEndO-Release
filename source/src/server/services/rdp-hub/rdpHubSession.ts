import http, { type IncomingMessage, type Server } from 'node:http';
import net from 'node:net';
import type { Duplex } from 'node:stream';
import jwt from 'jsonwebtoken';
import { ACCESS_COOKIE_NAME, getAccessTokenSecret } from '../../constants/auth';
import { logger } from '../../../core/logging/Logger';
import { toJwtAuthPayload } from '../../middleware/auth.middleware';
import { isRemoteHubsRuntimeEnabled } from '../remote-hubs/remoteHubsRuntime';
import { requireRemoteHubLibrary } from '../remote-hubs/requireRemoteHubLibrary';
import { resolveCredentialMasterKey } from '../../domain/security/credentialVault/credentialCrypto';
import { getRdpHubConnectionSecrets } from './rdpHubStore';

export const RDP_HUB_SESSION_PATH = '/api/rdp-hub/session';
export const RDP_HUB_DEFAULT_GUACD_HOST = '127.0.0.1';
export const RDP_HUB_DEFAULT_GUACD_PORT = 4822;
const MAX_SESSIONS_PER_USER = 8;
const MAX_SESSIONS_TOTAL = 50;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

type SessionAuth = {
  userId: number;
  email: string;
  roles: string[];
};

type RdpHubGuacamoleWss = {
  handleUpgrade: (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (ws: unknown) => void,
  ) => void;
  emit: (event: 'connection', ws: unknown, req: IncomingMessage) => boolean;
};

type RdpHubGuacamoleServer = {
  close: () => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  activeConnections?: Map<unknown, unknown>;
  webSocketServer?: RdpHubGuacamoleWss;
};

type GuacamoleLiteCtor = new (
  websocketOptions: Record<string, unknown>,
  guacdOptions: Record<string, unknown>,
  clientOptions: Record<string, unknown>,
  callbacks?: Record<string, unknown>,
) => RdpHubGuacamoleServer;

function loadGuacamoleLite(): GuacamoleLiteCtor {
  return requireRemoteHubLibrary<GuacamoleLiteCtor>('guacamole-lite');
}

type RdpHubGuacamoleSettings = {
  expiration?: number;
  connectionId?: string;
  userId?: number;
  connection?: {
    type?: string;
    settings?: Record<string, unknown>;
  };
};

let guacamoleServer: RdpHubGuacamoleServer | null = null;
/** Isolated HTTP server so guacamole-lite's `ws` instance never abortHandshake(400)s other upgrades (SSH Hub). */
let guacamoleHttp: Server | null = null;
const sessionsByUser = new Map<number, number>();

function readUpgradePathname(req: IncomingMessage): string {
  try {
    return new URL(req.url ?? '', 'https://appendo.local').pathname;
  } catch {
    return '';
  }
}

export function resolveGuacdOptions(): { host: string; port: number } {
  const host = process.env.GUACD_HOST?.trim() || RDP_HUB_DEFAULT_GUACD_HOST;
  const parsedPort = Number(process.env.GUACD_PORT?.trim() || RDP_HUB_DEFAULT_GUACD_PORT);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : RDP_HUB_DEFAULT_GUACD_PORT;
  return { host, port };
}

export function probeGuacd(timeoutMs = 1_200): Promise<boolean> {
  const { host, port } = resolveGuacdOptions();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const finish = (ok: boolean) => {
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch {
        // ignore
      }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
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

function countUserSessions(userId: number): number {
  return sessionsByUser.get(userId) ?? 0;
}

function totalSessions(): number {
  let total = 0;
  for (const count of sessionsByUser.values()) {
    total += count;
  }
  return total;
}

function incrementUserSession(userId: number): void {
  sessionsByUser.set(userId, countUserSessions(userId) + 1);
}

function decrementUserSession(userId: number): void {
  const next = countUserSessions(userId) - 1;
  if (next <= 0) {
    sessionsByUser.delete(userId);
    return;
  }
  sessionsByUser.set(userId, next);
}

function handleProtocols(protocols: Set<string> | string[]): string | false {
  const list = protocols instanceof Set ? protocols : new Set(protocols);
  return list.has('guacamole') ? 'guacamole' : false;
}

function verifyClient(
  info: { req: IncomingMessage },
  callback: (result: boolean, code?: number, message?: string) => void,
): void {
  const auth = authenticateUpgrade(info.req);
  if (!auth) {
    callback(false, 401, 'Unauthorized');
    return;
  }
  if (totalSessions() >= MAX_SESSIONS_TOTAL || countUserSessions(auth.userId) >= MAX_SESSIONS_PER_USER) {
    callback(false, 429, 'Too Many Requests');
    return;
  }
  callback(true);
}

async function injectRdpSettings(
  settings: RdpHubGuacamoleSettings,
  callback: (error: Error | undefined, next?: RdpHubGuacamoleSettings) => void,
): Promise<void> {
  try {
    if (typeof settings.expiration === 'number' && settings.expiration < Date.now()) {
      callback(new Error('RDP session ticket expired.'));
      return;
    }

    const connectionId = typeof settings.connectionId === 'string' ? settings.connectionId.trim() : '';
    if (!connectionId) {
      callback(new Error('RDP connection was not found.'));
      return;
    }

    const resolved = await getRdpHubConnectionSecrets(connectionId);
    if (!resolved?.secrets.password) {
      callback(new Error('Stored credentials are missing for this connection.'));
      return;
    }

    const { record, secrets } = resolved;
    const currentSettings = settings.connection?.settings && typeof settings.connection.settings === 'object'
      ? { ...settings.connection.settings }
      : {};

    logger.info('RdpHub', 'Opening RDP session', {
      connectionId: record.id,
      host: record.host,
      port: record.port,
      username: record.username,
      userId: settings.userId,
    });

    callback(undefined, {
      ...settings,
      connection: {
        type: 'rdp',
        settings: {
          ...currentSettings,
          hostname: record.host,
          port: String(record.port),
          username: record.username,
          password: secrets.password,
          ...(record.domain ? { domain: record.domain } : {}),
          security: record.security,
          'ignore-cert': record.ignoreCert,
          'enable-wallpaper': false,
          'enable-desktop-composition': false,
          'enable-menu-animations': false,
          'enable-theming': false,
        },
      },
    });
  } catch (error) {
    callback(error instanceof Error ? error : new Error(String(error)));
  }
}

export function handleRdpHubUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): boolean {
  if (readUpgradePathname(req) !== RDP_HUB_SESSION_PATH) {
    return false;
  }
  if (!isRemoteHubsRuntimeEnabled()) {
    socket.destroy();
    return true;
  }
  if (!guacamoleServer) {
    try {
      attachRdpHubWebSocket();
    } catch (error) {
      logger.warn('RdpHub', 'RDP Hub WebSocket was not attached', {
        message: error instanceof Error ? error.message : 'RDP attach failed',
      });
      socket.destroy();
      return true;
    }
  }
  const wss = guacamoleServer?.webSocketServer;
  if (!wss) {
    socket.destroy();
    return true;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
  return true;
}

export function attachRdpHubWebSocket(_server?: Server): void {
  if (guacamoleServer) {
    return;
  }

  const guacd = resolveGuacdOptions();
  guacamoleHttp = http.createServer();
  guacamoleServer = new (loadGuacamoleLite())(
    {
      // Bind guacamole-lite to an isolated server. `ws` abortHandshake(400)s every
      // upgrade whose path does not match, which would kill SSH Hub sessions on the
      // public HTTP server (`/api/ssh-hub/session`).
      server: guacamoleHttp,
      path: RDP_HUB_SESSION_PATH,
      handleProtocols,
      verifyClient,
    },
    {
      host: guacd.host,
      port: guacd.port,
    },
    {
      maxInactivityTime: IDLE_TIMEOUT_MS,
      crypt: {
        cypher: 'AES-256-CBC',
        key: resolveCredentialMasterKey(),
      },
      log: {
        level: 'ERRORS',
        stdLog: (...args: unknown[]) => {
          logger.info('RdpHub', args.map(String).join(' '));
        },
        errorLog: (...args: unknown[]) => {
          logger.warn('RdpHub', args.map(String).join(' '));
        },
      },
      connectionDefaultSettings: {
        rdp: {
          port: '3389',
          dpi: 96,
          security: 'nla',
          'ignore-cert': true,
        },
      },
      allowedUnencryptedConnectionSettings: {
        rdp: ['width', 'height', 'dpi'],
      },
    },
    {
      processConnectionSettings: (
        settings: RdpHubGuacamoleSettings,
        callback: (error: Error | undefined, next?: RdpHubGuacamoleSettings) => void,
      ) => {
        void injectRdpSettings(settings, callback);
      },
    },
  );

  guacamoleServer.on('open', (connection) => {
    const settings = (connection as { connectionSettings?: RdpHubGuacamoleSettings }).connectionSettings;
    const userId = typeof settings?.userId === 'number' ? settings.userId : 0;
    if (userId > 0) {
      incrementUserSession(userId);
    }
  });

  guacamoleServer.on('close', (connection) => {
    const settings = (connection as { connectionSettings?: RdpHubGuacamoleSettings }).connectionSettings;
    const userId = typeof settings?.userId === 'number' ? settings.userId : 0;
    if (userId > 0) {
      decrementUserSession(userId);
    }
  });

  guacamoleServer.on('error', (_connection, error) => {
    const message = error instanceof Error ? error.message : String(error ?? 'RDP proxy error');
    logger.warn('RdpHub', 'Guacamole session error', { message });
  });
}

export function closeAllRdpHubSessions(): void {
  sessionsByUser.clear();
  if (guacamoleServer) {
    try {
      guacamoleServer.close();
    } catch {
      // ignore
    }
    guacamoleServer = null;
  }
  if (guacamoleHttp) {
    try {
      guacamoleHttp.close();
    } catch {
      // ignore
    }
    guacamoleHttp = null;
  }
}
