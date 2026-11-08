/**
 * Measure time until the server logs READY (dev tsx vs production bundle).
 *
 * Usage:
 *   npx tsx scripts/measure-boot.ts --dev
 *   npx tsx scripts/measure-boot.ts --prod [--skip-build]   # production runtime + dist/ static
 *   npx tsx scripts/measure-boot.ts --prod-bundle [--skip-build]  # node dist/server.cjs (may fail on ESM deps)
 */
import { spawn, execSync, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const SETTINGS_PATH = path.join(ROOT, 'settings.json');
const SERVER_BUNDLE = path.join(ROOT, 'dist', 'server.cjs');
const READY_RE = /\[AppEndO\] READY/;
const BOOT_MARK_RE = /\[AppEndO\] \+(\d+)ms (.+)/;
const CREDENTIAL_DEV_SALT = 'appendo-credential-vault-v1';
const KEY_BYTES = 32;

type Mode = 'dev' | 'prod' | 'prod-bundle';

type ProdMeasureEnv = {
  credentialMasterKeyHex: string;
};

const parseArgs = (): { mode: Mode; skipBuild: boolean } => {
  const argv = process.argv.slice(2);
  let mode: Mode = 'dev';
  if (argv.includes('--prod-bundle')) {
    mode = 'prod-bundle';
  } else if (argv.includes('--prod') || argv.includes('--production')) {
    mode = 'prod';
  }
  const skipBuild = argv.includes('--skip-build');
  return { mode, skipBuild };
};

const readRuntimePort = (): number => {
  let basePort = 3000;
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) as {
        runtime?: { port?: unknown };
      };
      const parsed = Number(settings.runtime?.port);
      if (Number.isFinite(parsed) && parsed > 0) {
        basePort = parsed;
      }
    } catch {
      // ignore
    }
  }
  return basePort;
};

const stopWindowsServerProcesses = (ports: number[]): void => {
  const markers = ['src/server/index.ts', 'dist/server.cjs'];
  const markerPattern = markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]')).join('|');
  const scriptPath = path.join(os.tmpdir(), `appendo-measure-boot-kill-${process.pid}.ps1`);
  const portLiteral = ports.join(', ');
  const script = [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `$ports = [int[]]@(${portLiteral})`,
    `$portSet = [System.Collections.Generic.HashSet[int]]::new($ports)`,
    `$pattern = '${markerPattern}'`,
    `foreach ($name in @('node.exe', 'tsx.exe')) {`,
    `  Get-CimInstance Win32_Process -Filter "Name = '$name'" |`,
    `    Where-Object { $_.CommandLine -and ($_.CommandLine -match $pattern) } |`,
    `    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    `}`,
    `Get-NetTCPConnection -State Listen |`,
    `  Where-Object { $portSet.Contains([int]$_.LocalPort) } |`,
    `  Select-Object -ExpandProperty OwningProcess -Unique |`,
    `  ForEach-Object { Stop-Process -Id $_ -Force }`,
    '',
  ].join('\r\n');
  try {
    fs.writeFileSync(scriptPath, script, 'utf8');
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      stdio: 'ignore',
      windowsHide: true,
    });
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // best-effort
    }
  }
};

const stopExistingServers = (): void => {
  const basePort = readRuntimePort();
  const ports: number[] = [];
  for (let offset = 0; offset < 25; offset += 1) {
    ports.push(basePort + offset);
    ports.push(basePort + 200 + offset);
  }
  if (process.platform === 'win32') {
    stopWindowsServerProcesses(ports);
    return;
  }
  for (const marker of ['src/server/index.ts', 'dist/server.cjs']) {
    try {
      execSync(`pkill -f "${marker}"`, { stdio: 'ignore' });
    } catch {
      // nothing
    }
  }
};

const runBuild = (): void => {
  console.log('[measure-boot] Running npm run build (Vite + server bundle)…');
  execSync('npm run build', { cwd: ROOT, stdio: 'inherit', env: process.env });
};

type SettingsBackup = {
  raw: string;
  restored: boolean;
};

type SecuritySettings = {
  accessTokenSecret: string;
  refreshTokenSecret: string;
};

const deriveCredentialMasterKeyHex = (accessTokenSecret: string): string => {
  const key = crypto.scryptSync(accessTokenSecret, CREDENTIAL_DEV_SALT, KEY_BYTES);
  return key.toString('hex');
};

const patchSettingsForProductionMeasure = async (): Promise<{
  backup: SettingsBackup;
  prodEnv: ProdMeasureEnv;
  securityBackup: SecuritySettings | null;
}> => {
  const { initPrismaControlPlane } = await import('../src/server/db/prismaControlPlane');
  const { getPlatformBlobSection, upsertPlatformBlobSection } = await import(
    '../src/server/domain/settings/platformBlobSectionRepository'
  );
  await initPrismaControlPlane(SETTINGS_PATH);
  const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const runtime = (parsed.runtime ?? {}) as Record<string, unknown>;
  const priorAccessSecret = String(runtime.accessTokenSecret ?? '');
  const credentialMasterKeyHex = deriveCredentialMasterKeyHex(priorAccessSecret);
  const existingSecurity = await getPlatformBlobSection('security');
  const securityBackup: SecuritySettings | null = existingSecurity
    ? {
      accessTokenSecret: String(existingSecurity.value.accessTokenSecret ?? ''),
      refreshTokenSecret: String(existingSecurity.value.refreshTokenSecret ?? ''),
    }
    : null;
  const measureSecrets: SecuritySettings = {
    accessTokenSecret: `measure_boot_access_${crypto.randomBytes(16).toString('hex')}`,
    refreshTokenSecret: `measure_boot_refresh_${crypto.randomBytes(16).toString('hex')}`,
  };
  runtime.nodeEnv = 'production';
  runtime.accessTokenSecret = measureSecrets.accessTokenSecret;
  runtime.refreshTokenSecret = measureSecrets.refreshTokenSecret;
  parsed.runtime = runtime;
  fs.writeFileSync(SETTINGS_PATH, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
  await upsertPlatformBlobSection(
    'security',
    measureSecrets as unknown as Record<string, unknown>,
    null,
  );
  console.log('[measure-boot] Temporarily set runtime.nodeEnv=production + platform security JWT (restored after run).');
  return {
    backup: { raw, restored: false },
    prodEnv: { credentialMasterKeyHex },
    securityBackup,
    measureSecrets,
  };
};

type ProdPatchState = {
  backup: SettingsBackup;
  prodEnv: ProdMeasureEnv;
  securityBackup: SecuritySettings | null;
};

const restoreProdPatch = async (patch: ProdPatchState | null): Promise<void> => {
  if (!patch || patch.backup.restored) {
    return;
  }
  fs.writeFileSync(SETTINGS_PATH, patch.backup.raw, 'utf8');
  patch.backup.restored = true;
  if (patch.securityBackup) {
    const { initPrismaControlPlane } = await import('../src/server/db/prismaControlPlane');
    const { upsertPlatformBlobSection } = await import(
      '../src/server/domain/settings/platformBlobSectionRepository'
    );
    await initPrismaControlPlane(SETTINGS_PATH);
    await upsertPlatformBlobSection(
      'security',
      patch.securityBackup as unknown as Record<string, unknown>,
      null,
    );
  }
  console.log('[measure-boot] Restored settings.json and platform security JWT.');
};

const productionChildEnv = (prodEnv: ProdMeasureEnv): NodeJS.ProcessEnv => ({
  ...process.env,
  NODE_ENV: 'production',
  APPENDO_CREDENTIAL_MASTER_KEY: prodEnv.credentialMasterKeyHex,
});

const spawnServer = (mode: Mode, prodEnv?: ProdMeasureEnv): ChildProcess => {
  if (mode === 'prod-bundle') {
    if (!prodEnv) {
      throw new Error('Production measure requires credential env from settings patch.');
    }
    return spawn(process.execPath, [SERVER_BUNDLE], {
      cwd: ROOT,
      env: productionChildEnv(prodEnv),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  }
  if (mode === 'prod') {
    if (!prodEnv) {
      throw new Error('Production measure requires credential env from settings patch.');
    }
    return spawn(
      process.execPath,
      [
        path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        '--import',
        './scripts/tsx-css-register.mjs',
        'src/server/index.ts',
      ],
      {
        cwd: ROOT,
        env: productionChildEnv(prodEnv),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );
  }
  return spawn(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
      '--import',
      './scripts/tsx-css-register.mjs',
      'src/server/index.ts',
    ],
    {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );
};

const formatLine = (chunk: Buffer, target: NodeJS.WriteStream): void => {
  const text = chunk.toString('utf8');
  target.write(text);
};

const measure = async (mode: Mode, skipBuild: boolean): Promise<number> => {
  if (mode === 'prod' || mode === 'prod-bundle') {
    if (!skipBuild || !fs.existsSync(SERVER_BUNDLE)) {
      runBuild();
    } else if (!fs.existsSync(path.join(ROOT, 'dist', 'index.html'))) {
      console.warn('[measure-boot] dist/ incomplete — running full build.');
      runBuild();
    }
  }

  stopExistingServers();
  await new Promise((resolve) => {
    setTimeout(resolve, 1200);
  });

  const prodPatch = mode === 'prod' || mode === 'prod-bundle' ? await patchSettingsForProductionMeasure() : null;
  const cleanupSettings = () => {
    void restoreProdPatch(prodPatch);
  };
  process.once('SIGINT', () => {
    cleanupSettings();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    cleanupSettings();
    process.exit(143);
  });

  const startedAt = Date.now();
  const marks: string[] = [];
  let readyMs: number | null = null;

  const child = spawnServer(mode, prodPatch?.prodEnv);
  let stdoutBuf = '';
  let stderrBuf = '';

  const onData = (chunk: Buffer, isErr: boolean) => {
    if (isErr) {
      formatLine(chunk, process.stderr);
      stderrBuf += chunk.toString('utf8');
    } else {
      formatLine(chunk, process.stdout);
      stdoutBuf += chunk.toString('utf8');
    }
    const lines = chunk.toString('utf8').split(/\r?\n/);
    for (const line of lines) {
      const mark = line.match(BOOT_MARK_RE);
      if (mark) {
        marks.push(`+${mark[1]}ms ${mark[2]}`);
      }
      if (READY_RE.test(line) && readyMs === null) {
        readyMs = Date.now() - startedAt;
      }
    }
  };

  child.stdout?.on('data', (c) => onData(c, false));
  child.stderr?.on('data', (c) => onData(c, true));

  const deadline = startedAt + 300_000;
  await new Promise<void>((resolve) => {
    const poll = () => {
      if (readyMs !== null) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        resolve();
        return;
      }
      if (child.exitCode !== null) {
        resolve();
        return;
      }
      setTimeout(poll, 200);
    };
    child.on('exit', () => resolve());
    poll();
  });

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  try {
    child.kill('SIGKILL');
  } catch {
    // ignore
  }

  await restoreProdPatch(prodPatch);

  console.log('');
  const modeLabel = mode === 'dev'
    ? 'development (tsx + Vite child)'
    : mode === 'prod'
      ? 'production runtime (runtime.nodeEnv=production, dist/ static, no Vite; tsx loader)'
      : 'production bundle (node dist/server.cjs + runtime.nodeEnv=production)';
  console.log(`[measure-boot] Mode: ${modeLabel}`);
  if (readyMs !== null) {
    console.log(`[measure-boot] READY in ${readyMs} ms (${(readyMs / 1000).toFixed(2)} s)`);
  } else {
    console.error('[measure-boot] Timed out or server exited before READY.');
    if (stderrBuf.trim()) {
      console.error(stderrBuf.slice(-2000));
    }
    process.exit(1);
  }
  if (marks.length > 0) {
    console.log('[measure-boot] Boot marks:');
    for (const mark of marks) {
      console.log(`  ${mark}`);
    }
    const readyMark = marks.find((mark) => mark.endsWith(' READY'));
    if (readyMark) {
      const readyMarkMs = Number(readyMark.match(/^\+(\d+)ms/)?.[1]);
      if (Number.isFinite(readyMarkMs)) {
        console.log(
          `[measure-boot] Server boot mark READY: ${readyMarkMs} ms (${(readyMarkMs / 1000).toFixed(2)} s) — excludes tsx cold load before first log`,
        );
      }
    }
  }
  return readyMs;
};

const main = async (): Promise<void> => {
  const { mode, skipBuild } = parseArgs();
  await measure(mode, skipBuild);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[measure-boot] Failed:', message);
  process.exit(1);
});
