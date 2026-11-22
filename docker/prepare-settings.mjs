#!/usr/bin/env node
/**
 * Prepare the evaluation container's settings.json.
 *
 * `npm run setup` copies settings.example.json and returns immediately unless
 * database.provider is already postgresql. This script writes that provider
 * before setup. The database password stays in PGPASSWORD (the placeholder
 * the server already understands). Secrets are never printed.
 *
 * Platform JWT secrets are seeded from settings.example.json, not from
 * settings.json. Init writes fresh secrets into both files before setup so
 * production boot does not still see the development placeholders.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const SOURCE_ROOT = process.env.APPENDO_SOURCE_ROOT || '/opt/appendo/source';
const DATA_ROOT = process.env.APPENDO_DATA_ROOT || '/var/lib/appendo';
// Real file on the data volume. The entrypoint uses this directory as cwd.
// Do not symlink it: settings writes rename a temp file onto settings.json,
// which would replace a symlink and leave the volume copy unfinished.
const SETTINGS_PATH = path.join(DATA_ROOT, 'run', 'settings.json');
const EXAMPLE_PATH = path.join(SOURCE_ROOT, 'settings.example.json');

const DEV_ACCESS = 'dev_access_token_secret_change_me';
const DEV_REFRESH = 'dev_refresh_token_secret_change_me';

const pgHost = process.env.APPENDO_PG_HOST || 'db';
const pgPort = Number(process.env.APPENDO_PG_PORT || 5432);
const pgDatabase = process.env.APPENDO_PG_DATABASE || 'appendo';
const pgUser = process.env.APPENDO_PG_USER || 'appendo';
const appUrl = process.env.APP_URL || 'http://localhost:3000';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function applyPostgres(settings, nodeEnv) {
  settings.database = {
    provider: 'postgresql',
    url: `postgresql://${encodeURIComponent(pgUser)}@${pgHost}:${pgPort}/${encodeURIComponent(pgDatabase)}`,
    engine: 'prisma',
  };
  const runtime = settings.runtime && typeof settings.runtime === 'object' && !Array.isArray(settings.runtime)
    ? settings.runtime
    : {};
  runtime.nodeEnv = nodeEnv;
  runtime.port = 3000;
  runtime.appUrl = appUrl;
  runtime.databaseProvider = 'postgres';
  runtime.disableHmr = true;
  settings.runtime = runtime;
  settings.dataSources = [
    {
      id: 'ds_default',
      name: 'default-db',
      type: 'PostgreSQL',
      host: pgHost,
      port: pgPort,
      database: pgDatabase,
      username: pgUser,
      password: 'PGPASSWORD',
      passwordEnvKey: 'PGPASSWORD',
      encrypt: false,
      trustServerCertificate: false,
      pooling: false,
      status: 'connected',
      isDefault: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
  return settings;
}

function ensureRuntimeSecrets(runtime) {
  if (!runtime.accessTokenSecret || runtime.accessTokenSecret === DEV_ACCESS) {
    runtime.accessTokenSecret = crypto.randomBytes(32).toString('hex');
  }
  if (!runtime.refreshTokenSecret || runtime.refreshTokenSecret === DEV_REFRESH) {
    runtime.refreshTokenSecret = crypto.randomBytes(32).toString('hex');
  }
  return runtime;
}

/** The platform settings seed copies JWT secrets from the example file. */
function stampExampleJwtSecrets(accessTokenSecret, refreshTokenSecret) {
  if (!fs.existsSync(EXAMPLE_PATH)) return;
  const example = readJson(EXAMPLE_PATH);
  const runtime = example.runtime && typeof example.runtime === 'object' && !Array.isArray(example.runtime)
    ? example.runtime
    : {};
  runtime.accessTokenSecret = accessTokenSecret;
  runtime.refreshTokenSecret = refreshTokenSecret;
  example.runtime = runtime;
  writeJson(EXAMPLE_PATH, example);
  console.log('[appendo] Stamped JWT secrets into settings.example.json so the platform seed does not keep the development placeholders.');
}

function installComplete(settings) {
  const install = settings.install;
  return Boolean(install && typeof install === 'object' && install.completedAt);
}

function waitForPort(host, port, timeoutMs) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const socket = net.connect({ host, port });
      const fail = () => {
        socket.destroy();
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }
        setTimeout(attempt, 1000);
      };
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', fail);
    };
    attempt();
  });
}

const command = process.argv[2];

if (command === 'wait') {
  await waitForPort(pgHost, pgPort, Number(process.env.APPENDO_PG_WAIT_MS || 120000));
  console.log(`[appendo] PostgreSQL is accepting connections at ${pgHost}:${pgPort}.`);
} else if (command === 'init') {
  if (!fs.existsSync(SETTINGS_PATH)) {
    if (!fs.existsSync(EXAMPLE_PATH)) {
      console.error(`[appendo] Missing ${EXAMPLE_PATH}`);
      process.exit(1);
    }
    const settings = applyPostgres(readJson(EXAMPLE_PATH), 'development');
    ensureRuntimeSecrets(settings.runtime);
    settings.install = { pending: true };
    writeJson(SETTINGS_PATH, settings);
    stampExampleJwtSecrets(settings.runtime.accessTokenSecret, settings.runtime.refreshTokenSecret);
    console.log('[appendo] Wrote PostgreSQL evaluation settings. The password stays in PGPASSWORD.');
  } else {
    console.log('[appendo] Using existing settings on the data volume.');
  }
} else if (command === 'promote') {
  if (!fs.existsSync(SETTINGS_PATH)) {
    console.error('[appendo] settings.json is missing after setup.');
    process.exit(1);
  }
  const settings = readJson(SETTINGS_PATH);
  if (!installComplete(settings)) {
    console.error('[appendo] Setup did not mark the install complete. The server will not start.');
    process.exit(1);
  }
  const runtime = settings.runtime && typeof settings.runtime === 'object' && !Array.isArray(settings.runtime)
    ? settings.runtime
    : {};
  if (runtime.nodeEnv !== 'production') {
    runtime.nodeEnv = 'production';
    runtime.disableHmr = true;
    runtime.port = 3000;
    runtime.appUrl = appUrl;
    runtime.databaseProvider = runtime.databaseProvider || 'postgres';
    if (!runtime.accessTokenSecret || runtime.accessTokenSecret === DEV_ACCESS) {
      runtime.accessTokenSecret = crypto.randomBytes(32).toString('hex');
    }
    if (!runtime.refreshTokenSecret || runtime.refreshTokenSecret === DEV_REFRESH) {
      runtime.refreshTokenSecret = crypto.randomBytes(32).toString('hex');
    }
    settings.runtime = runtime;
    writeJson(SETTINGS_PATH, settings);
    console.log('[appendo] Promoted the evaluation node to production mode and replaced development JWT secrets. Secrets were not printed.');
  } else {
    console.log('[appendo] Install already complete. Leaving settings in place.');
  }
} else {
  console.error('Usage: prepare-settings.mjs wait|init|promote');
  process.exit(1);
}
