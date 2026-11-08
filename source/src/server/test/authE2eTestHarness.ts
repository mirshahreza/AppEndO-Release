import path from 'path';
import { Pool } from 'pg';
import { M0_DEV_AUTH_PRESET } from '../config/m0DevAuthPreset';
import { toPgPoolConfig } from '../config/env';
import { SETTINGS_PATH } from '../config/settingsFile';
import { initControlPlanePool, closeControlPlanePool } from '../db/controlPlane';
import { readControlPlaneDatabaseSettings } from '../db/controlPlaneDatabase';
import { ensureControlPlaneFeatureTables } from '../db/ensureControlPlaneFeatureTables';
import { closeControlPlaneSequelize } from '../db/controlPlaneSequelize';
import {
  bindPrismaToPgPool,
  closePrismaControlPlane,
  initPrismaControlPlane,
} from '../db/prismaControlPlane';
import { ensureControlPlaneInitialized } from '../db/controlPlaneInit';
import { prisma } from '../domain/users/prismaHelpers';
import {
  getCachedSection,
  initializeAppSettingsCache,
  replaceCachedSections,
} from '../services/settings/appSettingsCache';

export type SentEmailCapture = {
  to: string;
  subject: string;
  text: string;
};

export function parseVerifyEmailFromText(text: string): { token: string; challengeId: number } | null {
  const match = text.match(/\/verify-email\?token=([^&\s]+)&challenge=(\d+)/);
  if (!match) {
    return null;
  }

  return {
    token: decodeURIComponent(match[1]),
    challengeId: Number(match[2]),
  };
}

export function parseResetPasswordFromText(text: string): { token: string; challengeId: number } | null {
  const match = text.match(/\/reset-password\?token=([^&\s]+)&challenge=(\d+)/);
  if (!match) {
    return null;
  }

  return {
    token: decodeURIComponent(match[1]),
    challengeId: Number(match[2]),
  };
}

export function parseLoginOtpFromText(text: string): string | null {
  const match = text.match(/login code is (\d{6})/i);
  return match?.[1] ?? null;
}

export async function isDatabaseReachable(): Promise<boolean> {
  try {
    const pool = new Pool(toPgPoolConfig());
    await pool.query('SELECT 1');
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

export async function bootstrapAuthE2eEnvironment(): Promise<{ pool: Pool }> {
  const pool = new Pool(toPgPoolConfig());
  initControlPlanePool(pool);
  await pool.query('SELECT 1');
  await bindPrismaToPgPool(pool);
  await ensureControlPlaneInitialized(SETTINGS_PATH);
  await initializeAppSettingsCache();

  const currentAuth = getCachedSection('auth');
  await replaceCachedSections(
    {
      auth: {
        ...currentAuth,
        ...M0_DEV_AUTH_PRESET,
      },
    },
    null,
  );

  return { pool };
}

export async function shutdownAuthE2eEnvironment(pool: Pool): Promise<void> {
  await closePrismaControlPlane();
  await closeControlPlanePool(pool);
}

/** True when Postgres env pool works or local settings.json control plane (Prisma) answers SELECT 1. */
export async function isControlPlaneE2eReachable(): Promise<boolean> {
  if (await isDatabaseReachable()) {
    return true;
  }
  try {
    const settings = readControlPlaneDatabaseSettings(SETTINGS_PATH);
    if (settings.engine !== 'prisma') {
      return false;
    }
    await initPrismaControlPlane(SETTINGS_PATH);
    await prisma().$queryRawUnsafe('SELECT 1');
    await closePrismaControlPlane();
    await closeControlPlaneSequelize();
    return true;
  } catch {
    try {
      await closePrismaControlPlane();
      await closeControlPlaneSequelize();
    } catch {
      // ignore teardown errors after a failed probe
    }
    return false;
  }
}

export async function bootstrapControlPlaneE2eEnvironment(): Promise<{ pool?: Pool }> {
  if (await isDatabaseReachable()) {
    return bootstrapAuthE2eEnvironment();
  }

  await ensureControlPlaneInitialized(SETTINGS_PATH, { pushSchema: false, seedSampleData: false });
  await ensureControlPlaneFeatureTables(SETTINGS_PATH);
  await initializeAppSettingsCache();

  const currentAuth = getCachedSection('auth');
  await replaceCachedSections(
    {
      auth: {
        ...currentAuth,
        ...M0_DEV_AUTH_PRESET,
      },
    },
    null,
  );

  return {};
}

export async function shutdownControlPlaneE2eEnvironment(pool?: Pool): Promise<void> {
  if (pool) {
    await shutdownAuthE2eEnvironment(pool);
    return;
  }
  await closePrismaControlPlane();
  await closeControlPlaneSequelize();
}

export const testAuditContext = {
  ipAddress: '127.0.0.1',
  userAgent: 'vitest-auth-e2e',
};

export function buildUniqueTestEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@append.test`;
}
