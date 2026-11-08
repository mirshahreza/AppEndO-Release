import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  devSimpleAuthPresetNeedsApply,
  M0_DEV_SIMPLE_AUTH_PRESET,
} from '../config/m0DevAuthPreset';
import { env, toPgPoolConfig } from '../config/env';
import { SETTINGS_PATH } from '../config/settingsFile';
import { initControlPlanePool, closeControlPlanePool } from '../db/controlPlane';
import { bindPrismaToPgPool, closePrismaControlPlane } from '../db/prismaControlPlane';
import { ensureControlPlaneInitialized } from '../db/controlPlaneInit';
import {
  getCachedSection,
  replaceCachedSections,
} from '../services/settings/appSettingsCache';
import { bootstrapPlatformSettingsCaches } from '../services/settings/bootstrapPlatformSettings';

export const SETTINGS_EXAMPLE_PATH = path.join(process.cwd(), 'settings.example.json');

export function copySettingsFromExample(options: { force?: boolean } = {}): boolean {
  if (fs.existsSync(SETTINGS_PATH) && !options.force) {
    return false;
  }

  if (!fs.existsSync(SETTINGS_EXAMPLE_PATH)) {
    throw new Error(`Missing settings template: ${SETTINGS_EXAMPLE_PATH}`);
  }

  fs.copyFileSync(SETTINGS_EXAMPLE_PATH, SETTINGS_PATH);
  return true;
}

export async function ensureDatabaseExists(): Promise<void> {
  const config = toPgPoolConfig();
  const adminPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  try {
    await adminPool.query('SELECT 1');
    const existing = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if ((existing.rowCount ?? 0) === 0) {
      await adminPool.query(`CREATE DATABASE "${config.database.replace(/"/g, '""')}"`);
      console.log(`[setup] Created database "${config.database}".`);
    }
  } finally {
    await adminPool.end();
  }
}

export async function initializeDatabaseSchema(): Promise<void> {
  const pool = new Pool(toPgPoolConfig());
  initControlPlanePool(pool);

  try {
    await pool.query('SELECT 1');
    await bindPrismaToPgPool(pool);
    // Development greenfield seeds the sample admin (admin@append.os / admin123)
    // that setup.ts advertises and verifies; production keeps a bare control plane.
    await ensureControlPlaneInitialized(SETTINGS_PATH, { seedSampleData: !env.isProduction });
    await bootstrapPlatformSettingsCaches(SETTINGS_PATH);
  } finally {
    await closePrismaControlPlane();
    await closeControlPlanePool(pool);
  }
}

/**
 * Re-applies M0_DEV_SIMPLE_AUTH_PRESET when auth settings drift in development.
 * Skipped in production and test — production admins own auth hardening.
 */
export async function ensureDevSimpleAuthSettings(actorId: number | null = null): Promise<boolean> {
  if (env.isProduction || env.nodeEnv === 'test') {
    return false;
  }

  const currentAuth = getCachedSection('auth');
  if (!devSimpleAuthPresetNeedsApply(currentAuth)) {
    return false;
  }

  await replaceCachedSections(
    {
      auth: {
        ...currentAuth,
        ...M0_DEV_SIMPLE_AUTH_PRESET,
      },
    },
    actorId,
  );

  console.log('[auth] Restored dev simple-login preset (OTP and email-verify gates off).');
  return true;
}

export async function applyM0DevAuthSettings(actorId: number | null = null): Promise<void> {
  const pool = new Pool(toPgPoolConfig());
  initControlPlanePool(pool);

  try {
    await bindPrismaToPgPool(pool);
    await bootstrapPlatformSettingsCaches(SETTINGS_PATH);
    await ensureDevSimpleAuthSettings(actorId);
  } finally {
    await closePrismaControlPlane();
    await closeControlPlanePool(pool);
  }
}
