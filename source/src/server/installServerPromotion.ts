import type { Express, Request, Response, Router } from 'express';
import type { Pool } from 'pg';
import { logger } from '../core/logging/Logger';
import {
  initializeFullServerRuntime,
  mountFullServerRoutes,
  startFullServerBackgroundWorkers,
  warmFullServerRouteCaches,
  type FullServerRuntime,
} from './bootstrapFullRuntime';
import { evaluateNodeReadiness } from './services/nodeReadiness.service';

type InstallPromotionRegistration = {
  settingsPath: string;
  app: Express;
  apiRouter: Router;
  isPromoted: () => boolean;
  setPromoted: (runtime: FullServerRuntime) => void;
};

let registration: InstallPromotionRegistration | null = null;
let promotionPromise: Promise<void> | null = null;
let promotedRuntime: FullServerRuntime | null = null;

export function registerInstallServerPromotion(next: InstallPromotionRegistration): void {
  registration = next;
}

export function getPromotedInstallRuntime(): FullServerRuntime | null {
  return promotedRuntime;
}

export function isInstallServerPromoted(): boolean {
  return registration?.isPromoted() ?? false;
}

/** True when the process booted in install-pending mode and can hot-promote to full server. */
export function isInstallPromotionAvailable(): boolean {
  return registration !== null;
}

export async function promoteInstallPendingServer(settingsPath: string): Promise<void> {
  if (!registration) {
    throw new Error('Install promotion is not available in this server mode.');
  }
  if (registration.settingsPath !== settingsPath) {
    throw new Error('Install promotion settings path mismatch.');
  }
  if (registration.isPromoted()) {
    return;
  }
  if (!promotionPromise) {
    promotionPromise = runInstallPromotion();
  }
  await promotionPromise;
}

async function runInstallPromotion(): Promise<void> {
  if (!registration) {
    throw new Error('Install promotion is not registered.');
  }

  console.log('[AppEndO] Install complete — promoting to full application server (no restart).');
  const runtime = await initializeFullServerRuntime(registration.settingsPath);
  await mountFullServerRoutes(registration.apiRouter, runtime, {
    parentApp: registration.app,
    includeInstallRoutes: true,
    includeCoreApiEndpoints: true,
  });
  startFullServerBackgroundWorkers(runtime);
  await warmFullServerRouteCaches();
  registration.setPromoted(runtime);
  promotedRuntime = runtime;
  logger.info('Server', 'Install wizard finished — full API surface is now live.');
  console.log('[AppEndO] Full application server is ready.');
}

export function createInstallPromotionHealthHandlers(
  isPromoted: () => boolean,
  getPool: () => Pool | null,
) {
  return {
    health: (_req: Request, res: Response) => {
      if (!isPromoted()) {
        res.json({ status: 'ok', mode: 'install-pending' });
        return;
      }
      const runtime = promotedRuntime;
      res.json({
        status: 'ok',
        nodeName: runtime?.nodeName,
        capabilities: runtime?.capabilities,
      });
    },
    ready: async (_req: Request, res: Response) => {
      if (!isPromoted()) {
        res.status(503).json({ status: 'not_ready', mode: 'install-pending' });
        return;
      }
      const runtime = promotedRuntime;
      const pool = getPool();
      if (!runtime || !pool) {
        res.status(503).json({ status: 'not_ready' });
        return;
      }
      const report = await evaluateNodeReadiness({
        pool,
        settingsPath: runtime.settingsPath,
        capabilities: runtime.capabilities,
        nodeName: runtime.nodeName,
      });
      if (report.status === 'ready') {
        res.json(report);
        return;
      }
      res.status(503).json(report);
    },
  };
}
