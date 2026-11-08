import fs from 'fs';
import path from 'path';
import express from 'express';
import { types } from 'pg';

// PostgreSQL BIGINT columns are returned as strings by default in node-pg.
types.setTypeParser(20, (value) => parseInt(value, 10));
import { shutdownSandboxWorkerPool } from '../core/api/sandboxWorkerPool';
import { resetEdgeDbRouterCaches } from '../core/database/EdgeDbRouter';
import { shutdownLogPersistence } from '../core/logging/PinoRuntime';
import { shutdownComponentUsagePersistence } from './services/component-usage/componentUsagePersistence.service';
import { logger } from '../core/logging/Logger';
import { env } from './config/env';
import { closeControlPlanePool } from './db/controlPlane';
import { closeControlPlaneSequelize } from './db/controlPlaneSequelize';
import { closePrismaControlPlane } from './db/prismaControlPlane';
import {
  applyBaseMiddleware,
  applyErrorMiddleware,
  createApp,
  createPrecompressedAssetsMiddleware,
  createSpaDistStaticHandler,
  listenOnAvailablePort,
  setupGracefulShutdown,
} from './app';
import { stopJobWorker } from './services/jobs/jobWorker.service';
import { stopSchedulerTicker } from './services/scheduler/scheduler.service';
import {
  resolveHttpMethodLogId,
  sanitizeClientPayloadForLog,
} from './utils/httpLogging';
import { startDevViteChild, type DevViteChild } from './utils/devViteChild';
import { getRequestPathname, isApiRequestPath, shouldBypassSpaDevMiddleware } from './utils/requestPaths';
import { parseDashboardEmbedRequest } from '../shared/lib/dashboardCanvas';
import { sendSpaIndexHtml } from './middleware/dashboardEmbedHeaders';
import { readRuntimeSettings, resolveListenPort } from './config/settingsFile';
export async function startServer() {
  const bootStartedAt = Date.now();
  const bootMark = (label: string) => {
    console.log(`[AppEndO] +${Date.now() - bootStartedAt}ms ${label}`);
  };
  console.log('[AppEndO] Starting server…');

  const settingsPath = path.join(process.cwd(), 'settings.json');
  const { isInstallComplete } = await import('./db/installSettingsStore');
  if (!isInstallComplete(settingsPath)) {
    const { startInstallPendingServer } = await import('./bootstrapInstallPending');
    await startInstallPendingServer(settingsPath);
    return;
  }

  // Vite is a separate process — start it in parallel with DB/settings/route init so
  // READY is not "API time + Vite time". Prefer the configured port; if listen has to
  // bump the port we restart the child once (rare after restart-dev frees 3000+).
  const preferredPort = resolveListenPort(readRuntimeSettings(settingsPath));
  // Defer the full route graph until after install gate — overlaps Vite child boot with
  // tsx evaluating bootstrapFullRuntime instead of blocking the first line of startServer().
  const fullRuntimeModulePromise = import('./bootstrapFullRuntime');
  let viteChildPromise: Promise<DevViteChild> | null = null;
  if (!env.isProduction) {
    bootMark('Starting Vite child (overlapping API init)…');
    viteChildPromise = startDevViteChild({
      publicPort: preferredPort,
      preferredServerPort: preferredPort,
    });
  }

  const {
    initializeFullServerRuntime,
    mountFullServerRoutes,
    startPostListenBackgroundTasks,
  } = await fullRuntimeModulePromise;
  const runtime = await initializeFullServerRuntime(settingsPath);
  bootMark('API runtime ready');
  const app = createApp();
  const PORT = resolveListenPort(runtime);

  applyBaseMiddleware(app, {
    resolveHttpMethodLogId,
    sanitizeClientPayloadForLog,
  });

  // MUST run before API routes: /api/boot is handled earlier in the stack, so a
  // listener registered on the Vite middleware never sees it. Without this, the SPA
  // gate could only "open" via a timer — leftover tabs then stampede Vite and starve
  // boot (multi‑GB RAM, blank page).
  let spaModulesOpen = env.isProduction;
  const openSpaModulesGate = (reason: string) => {
    if (spaModulesOpen) {
      return;
    }
    spaModulesOpen = true;
    console.log(`[AppEndO] SPA module gate open (${reason}).`);
  };
  if (!env.isProduction) {
    setTimeout(() => {
      openSpaModulesGate('startup timeout');
    }, 8_000);
  }
  app.use((req, res, next) => {
    if (getRequestPathname(req) !== '/api/boot') {
      next();
      return;
    }
    res.on('finish', () => {
      if (res.statusCode < 500) {
        openSpaModulesGate('first successful /api/boot');
      }
    });
    next();
  });

  await mountFullServerRoutes(app, runtime, {
    parentApp: app,
    includeInstallRoutes: true,
    includeCoreApiEndpoints: true,
  });
  bootMark('Routes mounted');

  applyErrorMiddleware(app);

  let viteChild: DevViteChild | null = null;
  if (!env.isProduction && viteChildPromise) {
    // Overlap Vite boot with Express listen — API (/api/boot, /api/health) must not wait
    // for the child transform server. Module proxy 503s until viteChild is assigned.
    void viteChildPromise.then((child) => {
      viteChild = child;
      bootMark(`Vite child ready on 127.0.0.1:${child.port}`);
    });
  }

  if (!env.isProduction) {
    // Vite runs in a child process (see startDevViteChild). Until /api/boot succeeds we
    // serve index.html from disk so Cursor Simple Browser / leftover tabs cannot stampede
    // transforms inside the API process.
    const indexHtmlPath = path.join(process.cwd(), 'index.html');
    const publicDir = path.join(process.cwd(), 'public');
    // Queue (don't 503) when the Vite child is busy. Hard 503 broke dynamic import()
    // retries while Cursor Simple Browser held every slot open.
    const MAX_VITE_PROXY_IN_FLIGHT = 6;
    let viteProxyInFlight = 0;
    const viteProxyWaiters: Array<() => void> = [];
    const acquireViteProxySlot = (): Promise<boolean> => new Promise((resolve) => {
      const deadlineMs = 60_000;
      let settled = false;
      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadlineTimer);
        resolve(value);
      };
      // A waiter only got re-checked when some other request released a slot. If
      // releases stopped arriving (the exact wedge this queue exists to survive),
      // the deadline was never re-evaluated and the request hung forever instead
      // of falling back to a retryable 503. This timer enforces the deadline
      // independently of any release event.
      const deadlineTimer = setTimeout(() => settle(false), deadlineMs);
      const tryAcquire = () => {
        if (settled) {
          // Already timed out while queued — don't consume a real waiter's turn;
          // let this release cascade straight to the next live waiter.
          const next = viteProxyWaiters.shift();
          if (next) next();
          return;
        }
        if (viteProxyInFlight < MAX_VITE_PROXY_IN_FLIGHT) {
          viteProxyInFlight += 1;
          settle(true);
          return;
        }
        viteProxyWaiters.push(tryAcquire);
      };
      tryAcquire();
    });
    const releaseViteProxySlot = () => {
      viteProxyInFlight = Math.max(0, viteProxyInFlight - 1);
      const next = viteProxyWaiters.shift();
      if (next) next();
    };
    app.use(express.static(publicDir, { index: false, fallthrough: true }));
    app.use((req, res, next) => {
      if (shouldBypassSpaDevMiddleware(req)) {
        next();
        return;
      }
      const pathname = getRequestPathname(req);
      // Always serve the splash shell from disk — never through Vite. Proxying `/`
      // into a busy Vite child made the first paint hang for tens of seconds even
      // though /api/boot was already healthy. Module graph still loads via import().
      // Embed/snapshot HTML also stays on disk so frame-ancestors is not overwritten by the Vite proxy.
      const wantsHtmlShell = pathname === '/'
        || pathname === '/index.html'
        || parseDashboardEmbedRequest(req.originalUrl || req.url || '').needsFramePolicy
        || (
          req.method === 'GET'
          && !spaModulesOpen
          && !pathname.startsWith('/src/')
          && !pathname.startsWith('/@')
          && !pathname.startsWith('/node_modules/')
          && !/\.(?:t|j)sx?$|\.mjs$|\.css$|\.map$/i.test(pathname)
        );
      if (wantsHtmlShell && fs.existsSync(indexHtmlPath)) {
        void sendSpaIndexHtml(req, res, indexHtmlPath);
        return;
      }
      if (!spaModulesOpen) {
        res.statusCode = 503;
        res.setHeader('Retry-After', '1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('AppEndO is starting — waiting for /api/boot');
        return;
      }
      if (!viteChild) {
        res.statusCode = 503;
        res.setHeader('Retry-After', '1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('AppEndO is starting Vite…');
        return;
      }
      const child = viteChild;
      void acquireViteProxySlot().then((acquired) => {
        if (!acquired) {
          res.statusCode = 503;
          res.setHeader('Retry-After', '2');
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('AppEndO is loading modules — retry');
          return;
        }
        let released = false;
        const release = () => {
          if (released) return;
          released = true;
          releaseViteProxySlot();
        };
        res.on('finish', release);
        res.on('close', release);
        child.proxyHttp(req, res);
      });
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(createPrecompressedAssetsMiddleware(distPath));
    app.use(createSpaDistStaticHandler(distPath));
    app.get('*', (req, res, next) => {
      const pathname = getRequestPathname(req);
      if (isApiRequestPath(pathname) || pathname === '/manifest.webmanifest') {
        next();
        return;
      }
      void sendSpaIndexHtml(req, res, path.join(distPath, 'index.html'));
    });
  }

  try {
    // Production: dual-stack. Development: IPv4 loopback only (see listenOnAvailablePort).
    const listenHost = env.isProduction ? '::' : '127.0.0.1';
    const { port: activePort, server } = await listenOnAvailablePort(app, PORT, 25, listenHost);
    // Always register hub upgrade handlers. Native libs load lazily on first session
    // so install/uninstall without a process restart still opens or rejects the socket.
    const sshHub = await import('./services/ssh-hub/sshHubSession');
    const rdpHub = await import('./services/rdp-hub/rdpHubSession');
    const fileHub = await import('./services/file-hub/fileHubSession');
    server.prependListener('upgrade', (req, socket, head) => {
      if (sshHub.handleSshHubUpgrade(req, socket, head)) {
        return;
      }
      if (rdpHub.handleRdpHubUpgrade(req, socket, head)) {
        return;
      }
    });
    bootMark(`Listening on 127.0.0.1:${activePort}`);

    if (!env.isProduction && viteChildPromise && !viteChild) {
      viteChild = await viteChildPromise;
      bootMark(`Vite child ready on 127.0.0.1:${viteChild.port}`);
    }

    setupGracefulShutdown(server, {
      onCleanup: async () => {
        sshHub.closeAllSshHubSessions();
        rdpHub.closeAllRdpHubSessions();
        fileHub.closeAllFileHubSessions();
        viteChild?.stop();
        stopSchedulerTicker();
        stopJobWorker();
        await shutdownComponentUsagePersistence();
        await shutdownLogPersistence();
        await shutdownSandboxWorkerPool();
        await resetEdgeDbRouterCaches();
        await closeControlPlaneSequelize();
        await closePrismaControlPlane();
        await closeControlPlanePool();
      },
    });

    if (!env.isProduction && viteChild) {
      // Prefer configured port for APPEND_O_DEV_CLIENT_PORT. If listen bumped the public
      // port, restart the child once so the browser proxy/HMR ports stay aligned.
      if (activePort !== preferredPort) {
        console.warn(
          `[AppEndO] Public port is ${activePort} (preferred ${preferredPort}); restarting Vite child with matching client port…`,
        );
        viteChild.stop();
        viteChild = await startDevViteChild({
          publicPort: activePort,
          preferredServerPort: PORT,
        });
        bootMark(`Vite child restarted on 127.0.0.1:${viteChild.port}`);
      }
      console.log(
        `[AppEndO] Vite child ready on 127.0.0.1:${viteChild.port} `
        + `(modules proxied via :${activePort}; HMR ws://127.0.0.1:${viteChild.port})`,
      );
      // Pre-transform critical boot imports after listen so the SPA gate can open safely.
      // server.warmup in vite.config already crawls the main graph in the child.
      viteChild.warmUp(['/@vite/client', '/@react-refresh', '/src/main.tsx']).then(() => {
        openSpaModulesGate('Vite warm-up complete');
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[AppEndO] Vite warm-up failed (SPA gate stays on /api/boot): ${message}`);
      });
    }

    const url = `http://127.0.0.1:${activePort}`;
    logger.info('Server', `Server running on ${url}`);
    console.log(`[AppEndO] Server running on ${url}`);
    bootMark('READY');
    console.log(`[AppEndO] READY — open ${url} (use 127.0.0.1, not localhost)`);
    startPostListenBackgroundTasks(runtime);
  } catch (err: unknown) {
    viteChild?.stop();
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Server', `Server error: ${message}`);
    process.exit(1);
  }
}
