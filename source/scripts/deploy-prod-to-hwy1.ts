/**
 * Production publish: build AppEndO and sync a runnable tree to C:\Workspace\Projects\HWY-1
 * (separate port from dev — default 3010).
 *
 * Usage: npx tsx scripts/deploy-prod-to-hwy1.ts [--port 3010] [--skip-build]
 */
import crypto from 'node:crypto';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_TARGET = 'C:\\Workspace\\Projects\\HWY-1';
const CREDENTIAL_DEV_SALT = 'appendo-credential-vault-v1';
const KEY_BYTES = 32;

const parseArgs = (): { target: string; port: number; skipBuild: boolean } => {
  const argv = process.argv.slice(2);
  let target = DEFAULT_TARGET;
  let port = 3010;
  let skipBuild = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--target' && argv[i + 1]) {
      target = argv[i + 1]!;
      i += 1;
    } else if (argv[i] === '--port' && argv[i + 1]) {
      port = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === '--skip-build') {
      skipBuild = true;
    }
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('Invalid --port');
  }
  return { target, port, skipBuild };
};

const deriveCredentialMasterKeyHex = (accessTokenSecret: string): string => {
  const key = crypto.scryptSync(accessTokenSecret, CREDENTIAL_DEV_SALT, KEY_BYTES);
  return key.toString('hex');
};

const robocopy = (source: string, dest: string, extraFlags = '/E /NFL /NDL /NJH /NJS'): void => {
  fs.mkdirSync(dest, { recursive: true });
  try {
    execSync(`robocopy "${source}" "${dest}" ${extraFlags}`, {
      stdio: 'inherit',
      shell: true,
    });
  } catch (error) {
    const status = typeof error === 'object' && error != null && 'status' in error
      ? Number((error as { status: number }).status)
      : -1;
    // Robocopy: 0–7 = success (files copied).
    if (status >= 0 && status <= 7) {
      return;
    }
    throw error;
  }
};

const writeProdSettings = (target: string, port: number): { credentialMasterKeyHex: string } => {
  const sourceSettings = path.join(ROOT, 'settings.json');
  const raw = fs.readFileSync(sourceSettings, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const runtime = (parsed.runtime ?? {}) as Record<string, unknown>;
  const accessTokenSecret = String(runtime.accessTokenSecret ?? '');
  runtime.nodeEnv = 'production';
  runtime.port = port;
  runtime.appUrl = `http://127.0.0.1:${port}`;
  runtime.disableHmr = true;
  parsed.runtime = runtime;
  fs.writeFileSync(path.join(target, 'settings.json'), `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  return { credentialMasterKeyHex: deriveCredentialMasterKeyHex(accessTokenSecret) };
};

const writeStartScripts = (target: string, credentialMasterKeyHex: string, port: number): void => {
  const ps1 = [
    '$ErrorActionPreference = "Stop"',
    `Set-Location "${target.replace(/\\/g, '\\\\')}"`,
    '$env:NODE_ENV = "production"',
    '$env:APPENDO_LOCAL_PROD_PUBLISH = "1"',
    `$env:APPENDO_CREDENTIAL_MASTER_KEY = "${credentialMasterKeyHex}"`,
    'Write-Host "[HWY-1] Starting AppEndO production on http://127.0.0.1:' + port + ' …"',
    '& node dist/server.cjs',
    '',
  ].join('\r\n');
  fs.writeFileSync(path.join(target, 'start-prod.ps1'), ps1, 'utf8');

  const readme = [
    '# AppEndO production (HWY-1)',
    '',
    `Published from \`${ROOT}\`.`,
    '',
    '## Run',
    '',
    '```powershell',
    '.\\start-prod.ps1',
    '```',
    '',
    `Open **http://127.0.0.1:${port}** (127.0.0.1, not localhost).`,
    '',
    'Sign in again — this instance uses its own JWT secrets (same database as source settings).',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(target, 'README.md'), readme, 'utf8');
};

const main = (): void => {
  const { target, port, skipBuild } = parseArgs();
  console.log(`[deploy-hwy1] Target: ${target}`);
  console.log(`[deploy-hwy1] Port: ${port}`);

  if (!skipBuild) {
    console.log('[deploy-hwy1] Running npm run build…');
    execSync('npm run build', {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS: [
          process.env.NODE_OPTIONS ?? '',
          '--max-old-space-size=8192',
        ].filter(Boolean).join(' '),
      },
    });
  }

  if (!fs.existsSync(path.join(ROOT, 'dist', 'server.cjs'))) {
    throw new Error('dist/server.cjs missing — run build first.');
  }

  fs.mkdirSync(target, { recursive: true });

  const copies: Array<{ rel: string; flags?: string }> = [
    { rel: 'dist' },
    { rel: 'public' },
    { rel: 'workspace' },
    { rel: 'src/generated/prisma', flags: '/E /NFL /NDL /NJH /NJS' },
    { rel: 'package.json' },
    { rel: 'package-lock.json' },
  ];

  for (const item of copies) {
    const source = path.join(ROOT, item.rel);
    const dest = path.join(target, item.rel);
    if (!fs.existsSync(source)) {
      console.warn(`[deploy-hwy1] Skip missing: ${item.rel}`);
      continue;
    }
    if (item.rel.endsWith('.json')) {
      fs.copyFileSync(source, dest);
      continue;
    }
    robocopy(source, dest, item.flags ?? '/MIR /NFL /NDL /NJH /NJS');
  }

  const { credentialMasterKeyHex } = writeProdSettings(target, port);
  writeStartScripts(target, credentialMasterKeyHex, port);

  const nodeModulesLink = path.join(target, 'node_modules');
  const sourceNodeModules = path.join(ROOT, 'node_modules');
  if (fs.existsSync(sourceNodeModules)) {
    try {
      if (fs.existsSync(nodeModulesLink)) {
        fs.rmSync(nodeModulesLink, { recursive: true, force: true });
      }
    } catch {
      // Junction removal may fail if in use — leave existing link.
    }
    if (!fs.existsSync(nodeModulesLink)) {
      execSync(`cmd /c mklink /J "${nodeModulesLink}" "${sourceNodeModules}"`, {
        stdio: 'inherit',
        shell: true,
      });
      console.log('[deploy-hwy1] Linked node_modules → AppEndO (local publish).');
    }
  } else {
    console.log('[deploy-hwy1] Installing production dependencies (npm ci --omit=dev)…');
    execSync('npm ci --omit=dev', { cwd: target, stdio: 'inherit', env: process.env });
  }

  console.log('[deploy-hwy1] Done.');
  console.log(`[deploy-hwy1] Start: powershell -File "${path.join(target, 'start-prod.ps1')}"`);
};

main();
