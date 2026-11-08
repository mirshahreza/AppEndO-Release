import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { PROJECT_STANDARDS } from '../config/projectStandards';
import { readRuntimeSettings, resolveListenPort } from './config/settingsFile';
import {
  applyBaseMiddleware,
  applyErrorMiddleware,
  createApp,
  createPrecompressedAssetsMiddleware,
  createSpaDistStaticHandler,
  listenOnAvailablePort,
  setupGracefulShutdown,
} from './app';
import { mountInstallRoutes } from './routes/install.routes';
import { mountInstallPendingBootStubs } from './setup/installPendingBootStubs';
import {
  createInstallPromotionHealthHandlers,
  registerInstallServerPromotion,
} from './installServerPromotion';
import type { FullServerRuntime } from './bootstrapFullRuntime';
import { startDevViteChild, type DevViteChild } from './utils/devViteChild';
import { sendSpaIndexHtml } from './middleware/dashboardEmbedHeaders';
import { getRequestPathname, isApiRequestPath, shouldBypassSpaDevMiddleware } from './utils/requestPaths';
import { logger } from '../core/logging/Logger';
import type { Pool } from 'pg';

export async function startInstallPendingServer(settingsPath: string): Promise<void> {
  console.log('[AppEndO] Install wizard pending — starting minimal server (no database required).');

  const runtime = readRuntimeSettings(settingsPath);
  const PORT = resolveListenPort(runtime);
  const app = createApp();
  const apiRouter = Router();
  let promoted = false;
  let promotedRuntime: FullServerRuntime | null = null;
  const viteChildPromise = runtime.nodeEnv === 'production'
    ? null
    : startDevViteChild({
      publicPort: PORT,
      preferredServerPort: PORT,
    });

  const isPromoted = () => promoted;
  const getPool = (): Pool | null => promotedRuntime?.cpPool ?? null;
  const healthHandlers = createInstallPromotionHealthHandlers(isPromoted, getPool);

  applyBaseMiddleware(app, {
    resolveHttpMethodLogId: () => null,
    sanitizeClientPayloadForLog: (payload) => payload,
  });

  app.get('/api/health', healthHandlers.health);
  app.get('/api/ready', healthHandlers.ready);

  app.get('/api/project-standards', (_req, res) => {
    res.json({ success: true, resource: PROJECT_STANDARDS });
  });

  mountInstallPendingBootStubs(app, isPromoted);
  mountInstallRoutes(app, { settingsPath });
  app.use(apiRouter);

  app.use('/api', (_req, res, next) => {
    if (isPromoted()) {
      next();
      return;
    }
    res.status(503).json({
      success: false,
      error: 'Install wizard is in progress. Complete setup at /install first.',
    });
  });

  applyErrorMiddleware(app);

  registerInstallServerPromotion({
    settingsPath,
    app,
    apiRouter,
    isPromoted,
    setPromoted: (runtime) => {
      promoted = true;
      promotedRuntime = runtime;
    },
  });

  let viteChild: DevViteChild | null = null;
  if (viteChildPromise) {
    viteChild = await viteChildPromise;
  }

  if (runtime.nodeEnv !== 'production') {
    const indexHtmlPath = path.join(process.cwd(), 'index.html');
    const publicDir = path.join(process.cwd(), 'public');
    app.use(express.static(publicDir, { index: false, fallthrough: true }));
    app.use((req, res, next) => {
      if (shouldBypassSpaDevMiddleware(req)) {
        next();
        return;
      }
      const pathname = getRequestPathname(req);
      const wantsHtmlShell = pathname === '/'
        || pathname === '/index.html'
        || pathname === '/install'
        || pathname.startsWith('/install/');
      if (wantsHtmlShell && fs.existsSync(indexHtmlPath)) {
        void sendSpaIndexHtml(req, res, indexHtmlPath);
        return;
      }
      if (!viteChild) {
        res.statusCode = 503;
        res.setHeader('Retry-After', '1');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('AppEndO is starting Vite…');
        return;
      }
      viteChild.proxyHttp(req, res);
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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const portAttempts = runtime.nodeEnv === 'production' ? 25 : 1;

  let activePort: number;
  let server: Awaited<ReturnType<typeof listenOnAvailablePort>>['server'];
  try {
    ({ port: activePort, server } = await listenOnAvailablePort(app, PORT, portAttempts));
  } catch (error) {
    viteChild?.stop();
    if (runtime.nodeEnv !== 'production') {
      console.error(`[AppEndO] Port ${PORT} is already in use. Stop the other AppEndO dev server, then run npm run dev again.`);
    }
    throw error;
  }
  setupGracefulShutdown(server, {
    onCleanup: async () => {
      viteChild?.stop();
    },
  });
  const url = `http://127.0.0.1:${activePort}`;
  logger.info('Server', `Install wizard server running on ${url}`);
  console.log(`[AppEndO] Install wizard server running on ${url}`);
  if (viteChild) {
    console.log(
      `[AppEndO] Vite child ready on 127.0.0.1:${viteChild.port} `
      + `(modules proxied via :${activePort}; HMR ws://127.0.0.1:${viteChild.port})`,
    );
    void viteChild.warmUp(['/@vite/client', '/@react-refresh', '/src/main.tsx']).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[AppEndO] Vite warm-up failed: ${message}`);
    });
  }
  console.log('[AppEndO] Open /install to configure database, admin, and node capabilities.');
}
