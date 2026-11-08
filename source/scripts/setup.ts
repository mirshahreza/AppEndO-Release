import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import {
  applyM0DevAuthSettings,
  copySettingsFromExample,
  ensureDatabaseExists,
  initializeDatabaseSchema,
  SETTINGS_EXAMPLE_PATH,
} from '../src/server/setup/greenfieldInstall';
import { readControlPlaneDatabaseSettings } from '../src/server/db/controlPlaneDatabase';
import { readRuntimeSettings, SETTINGS_PATH } from '../src/server/config/settingsFile';
import { toPgPoolConfig } from '../src/server/config/env';
import { writeInstallSettings } from '../src/server/db/installSettingsStore';

type SetupOptions = {
  forceSettings: boolean;
  skipDbCreate: boolean;
  skipDbInit: boolean;
  skipAuthPreset: boolean;
};

const parseArgs = (): SetupOptions => ({
  forceSettings: process.argv.includes('--force-settings'),
  skipDbCreate: process.argv.includes('--skip-db-create'),
  skipDbInit: process.argv.includes('--skip-db-init'),
  skipAuthPreset: process.argv.includes('--skip-auth-preset'),
});

const printUsage = () => {
  console.log(`AppEndO greenfield setup

Usage:
  npm run setup

Options:
  --force-settings   Overwrite settings.json from settings.example.json
  --skip-db-create   Do not CREATE DATABASE when missing
  --skip-db-init     Skip schema init (npm run db:init equivalent)
  --skip-auth-preset Skip dev auth preset (simple username/password defaults)
`);
};

const assertPasswordConfigured = () => {
  const config = toPgPoolConfig();
  if (!config.password) {
    console.error('[setup] Database password is missing.');
    console.error('[setup] Set PGPASSWORD in the environment or edit dataSources[].password in settings.json.');
    process.exit(1);
  }
};

const verifyBootstrapLogin = async () => {
  const pool = new Pool(toPgPoolConfig());
  try {
    const result = await pool.query(
      `SELECT u.email
       FROM base_users u
       INNER JOIN base_user_roles ur ON ur.user_id = u.id
       WHERE ur.role_name = 'ADMIN'
       ORDER BY u.id
       LIMIT 1`,
    );

    const adminEmail = result.rows[0]?.email;
    if (!adminEmail) {
      throw new Error('No admin user found after database init.');
    }

    console.log(`[setup] Bootstrap admin ready: ${adminEmail}`);
    console.log('[setup] Default dev credentials: admin@append.os / admin123');
  } finally {
    await pool.end();
  }
};

const main = async () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  const options = parseArgs();

  if (!fs.existsSync(SETTINGS_EXAMPLE_PATH)) {
    console.error(`[setup] Missing ${SETTINGS_EXAMPLE_PATH}`);
    process.exit(1);
  }

  const copied = copySettingsFromExample({ force: options.forceSettings });
  if (copied) {
    console.log(`[setup] Created ${SETTINGS_PATH} from settings.example.json`);
  } else {
    console.log(`[setup] Using existing ${SETTINGS_PATH}`);
  }

  const database = readControlPlaneDatabaseSettings(SETTINGS_PATH);
  if (database.provider !== 'postgresql') {
    console.log(`[setup] Control-plane provider is ${database.provider} (SQL Server is the recommended default).`);
    console.log('[setup] This CLI path only creates a PostgreSQL database. Use the install wizard instead:');
    console.log('[setup]   npm run install:reset');
    console.log('[setup]   npm run dev');
    console.log('[setup]   Open http://localhost:3000/install');
    return;
  }

  assertPasswordConfigured();

  if (!options.skipDbCreate) {
    console.log('[setup] Ensuring PostgreSQL database exists…');
    await ensureDatabaseExists();
  }

  if (!options.skipDbInit) {
    console.log('[setup] Initializing schema and seed data…');
    await initializeDatabaseSchema();
  }

  const runtime = readRuntimeSettings(SETTINGS_PATH);
  const isProduction = runtime.nodeEnv === 'production';

  if (!options.skipDbInit) {
    // Promote the greenfield node out of install-wizard mode so `npm run dev`
    // boots the full studio (the browser wizard sets the same completion state).
    writeInstallSettings(SETTINGS_PATH, {
      pending: false,
      completedAt: new Date().toISOString(),
      databaseInitialized: true,
      seedSampleData: !isProduction,
      capabilities: runtime.capabilities,
      nodeName: runtime.nodeName,
    });
    console.log('[setup] Marked install complete (node promoted to full server).');
  }

  if (!options.skipAuthPreset && !isProduction) {
    console.log('[setup] Applying dev auth preset (simple username/password login)…');
    await applyM0DevAuthSettings(null);
  } else if (isProduction) {
    console.log('[setup] Production nodeEnv — keeping secure auth defaults (registration off).');
  }

  await verifyBootstrapLogin();

  console.log('[setup] Greenfield setup complete.');
  console.log('[setup] Next: npm run dev');
  console.log('[setup] Health: GET /api/health · GET /api/ready');
  console.log('[setup] Auth E2E test: npm run test:auth-e2e');
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[setup] Failed:', message);
  process.exit(1);
});
