import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import path from 'node:path';
import { isTcpPortInUse } from './tcpPort';

const VITE_CHILD_PORT_OFFSET = 200;
const VITE_CHILD_PORT_SCAN = 25;

const resolveViteChildPort = async (serverPort: number): Promise<number> => {
  for (let offset = 0; offset < VITE_CHILD_PORT_SCAN; offset += 1) {
    const candidate = serverPort + VITE_CHILD_PORT_OFFSET + offset;
    if (!(await isTcpPortInUse(candidate))) {
      return candidate;
    }
  }
  throw new Error(`No free Vite child port near ${serverPort + VITE_CHILD_PORT_OFFSET}`);
};

const waitForListen = async (port: number, timeoutMs: number): Promise<void> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isTcpPortInUse(port)) {
      return;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error(`Vite child did not listen on 127.0.0.1:${port} within ${timeoutMs}ms`);
};

const hopByHop = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
]);

export type DevViteChild = {
  port: number;
  child: ChildProcess;
  proxyHttp: (req: IncomingMessage, res: ServerResponse) => void;
  attachWsProxy: (server: Server, shouldProxy: (req: IncomingMessage) => boolean) => void;
  warmUp: (specifiers: string[]) => Promise<void>;
  stop: () => void;
};

const fetchFromChild = (port: number, specifier: string): Promise<void> => new Promise((resolve) => {
  const req = http.request(
    { hostname: '127.0.0.1', port, path: specifier, method: 'GET' },
    (res) => {
      res.resume();
      res.on('end', resolve);
      res.on('error', resolve);
    },
  );
  req.on('error', resolve);
  req.end();
});

/**
 * Run Vite in a separate Node process and reverse-proxy to it.
 * In-process `middlewareMode` shares the API event loop — sync transforms then
 * freeze `/api/boot` (multi‑GB RAM, blank page). A child process isolates that cost.
 */
export const startDevViteChild = async (options: {
  publicPort: number;
  preferredServerPort: number;
}): Promise<DevViteChild> => {
  const port = await resolveViteChildPort(options.preferredServerPort);
  const viteBin = path.join(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

  const prefix = (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    for (const line of text.split(/\r?\n/)) {
      if (line.trim()) {
        console.log(`[vite:${port}] ${line}`);
      }
    }
  };

  let stopped = false;
  let currentChild: ChildProcess;
  const spawnChild = (): ChildProcess => {
    const proc = spawn(
      process.execPath,
      [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          APPEND_O_VITE_CHILD: '1',
          // HTTP modules are proxied via Express on publicPort; HMR WS hits Vite directly.
          APPEND_O_DEV_CLIENT_PORT: String(options.publicPort),
          APPEND_O_VITE_HMR_CLIENT_PORT: String(port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
    proc.stdout?.on('data', prefix);
    proc.stderr?.on('data', prefix);
    proc.on('exit', (code, signal) => {
      if (!stopped && currentChild === proc) {
        console.warn(`[AppEndO] Vite child exited unexpectedly (code=${code} signal=${signal}).`);
      }
    });
    return proc;
  };
  currentChild = spawnChild();

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(healthTimer);
    try {
      currentChild.kill('SIGTERM');
    } catch {
      // already exited
    }
  };

  try {
    await waitForListen(port, 60_000);
  } catch (error) {
    stop();
    throw error;
  }

  // The Vite child can go from "listening" to fully wedged (event loop stuck in a
  // pathological transform/scan) without exiting — the process stays alive, so
  // nothing else here notices, and every proxied request just piles up behind its
  // own timeout looking like a permanent hang. Ping it directly and force-restart
  // it if it stops answering, instead of requiring a manual `npm run restart`.
  const HEALTH_INTERVAL_MS = 5_000;
  const HEALTH_TIMEOUT_MS = 8_000;
  const FAILURE_THRESHOLD = 3;
  let consecutiveFailures = 0;
  let restarting = false;
  const pingChild = (): Promise<boolean> => new Promise((resolve) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/', method: 'GET', timeout: HEALTH_TIMEOUT_MS },
      (res) => {
        res.resume();
        resolve(true);
      },
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
  const healthTimer = setInterval(() => {
    if (stopped || restarting) return;
    void pingChild().then(async (healthy) => {
      if (stopped || restarting) return;
      if (healthy) {
        consecutiveFailures = 0;
        return;
      }
      consecutiveFailures += 1;
      if (consecutiveFailures < FAILURE_THRESHOLD) {
        console.warn(`[AppEndO] Vite child on :${port} is unresponsive (${consecutiveFailures}/${FAILURE_THRESHOLD})…`);
        return;
      }
      restarting = true;
      consecutiveFailures = 0;
      console.warn(`[AppEndO] Vite child on :${port} looks wedged — restarting it…`);
      const dead = currentChild;
      try {
        dead.kill('SIGKILL');
      } catch {
        // already exited
      }
      try {
        currentChild = spawnChild();
        await waitForListen(port, 30_000);
        console.log(`[AppEndO] Vite child on :${port} restarted.`);
      } catch (error) {
        console.error(`[AppEndO] Failed to restart Vite child on :${port}:`, error);
      } finally {
        restarting = false;
      }
    });
  }, HEALTH_INTERVAL_MS);
  healthTimer.unref();

  const proxyHttp = (req: IncomingMessage, res: ServerResponse) => {
    const headers: http.OutgoingHttpHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null || hopByHop.has(key.toLowerCase())) continue;
      headers[key] = value;
    }
    headers.host = `127.0.0.1:${port}`;

    const proxyReq = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: req.url,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        const outHeaders: http.OutgoingHttpHeaders = {};
        for (const [key, value] of Object.entries(proxyRes.headers)) {
          if (value == null || hopByHop.has(key.toLowerCase())) continue;
          outHeaders[key] = value;
        }
        res.writeHead(proxyRes.statusCode ?? 502, outHeaders);
        proxyRes.pipe(res);
      },
    );
    // Prevent a hung Vite transform from holding proxy slots forever.
    proxyReq.setTimeout(45_000, () => {
      proxyReq.destroy(new Error('Vite proxy timeout'));
    });
    proxyReq.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Vite dev server unavailable');
      } else {
        res.destroy();
      }
    });
    req.pipe(proxyReq);
  };

  const attachWsProxy = (server: Server, shouldProxy: (req: IncomingMessage) => boolean) => {
    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      if (!shouldProxy(req)) {
        return;
      }
      const headers: http.OutgoingHttpHeaders = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (value == null || key.toLowerCase() === 'host') continue;
        headers[key] = value;
      }
      headers.host = `127.0.0.1:${port}`;

      const proxyReq = http.request({
        hostname: '127.0.0.1',
        port,
        path: req.url,
        method: 'GET',
        headers,
      });
      proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
        const responseLines = [
          'HTTP/1.1 101 Switching Protocols',
          ...Object.entries(proxyRes.headers).flatMap(([key, value]) => {
            if (value == null) return [];
            if (Array.isArray(value)) return value.map((item) => `${key}: ${item}`);
            return [`${key}: ${value}`];
          }),
          '',
          '',
        ];
        socket.write(responseLines.join('\r\n'));
        if (proxyHead.length) proxySocket.write(proxyHead);
        if (head.length) socket.write(head);
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });
      proxyReq.on('error', () => {
        socket.destroy();
      });
      proxyReq.end();
    });
  };

  // Fire requests at the child directly (not through the Express proxy) so the
  // entry module graph is transformed/cached before the browser's first import() —
  // that first-touch transform is what made the splash sit for 10-45s.
  const warmUp = (specifiers: string[]): Promise<void> => (
    (async () => {
      for (const specifier of specifiers) {
        await fetchFromChild(port, specifier);
      }
      console.log(`[vite:${port}] warm-up complete (${specifiers.join(', ')}).`);
    })()
  );

  return {
    port,
    get child() {
      return currentChild;
    },
    proxyHttp,
    attachWsProxy,
    warmUp,
    stop,
  };
};
