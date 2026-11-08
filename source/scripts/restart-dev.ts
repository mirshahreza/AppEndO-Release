import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removePendingInstallSqliteLeftovers } from './lib/sqliteInstallResetFiles';

const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');
const PORT_SCAN_ATTEMPTS = 25;
const VITE_WS_PORTS = [24678];
const SERVER_COMMAND_MARKERS = ['src/server/index.ts', 'dist/server.cjs'];
/** Hung `tsc --noEmit` / project typecheck leftovers that pin multi‑GB RAM across restarts. */
const ORPHAN_TYPECHECK_MARKERS = ['tsc --noEmit', 'typescript/bin/tsc'];

type RestartMode = 'dev' | 'prod';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const readRuntimePorts = (): { basePort: number; hmrPort: number } => {
  let basePort = 3000;
  let configuredHmrPort = 0;

  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) as {
        runtime?: { port?: unknown; hmrPort?: unknown };
      };
      const parsedPort = Number(settings.runtime?.port);
      if (Number.isFinite(parsedPort) && parsedPort > 0) {
        basePort = parsedPort;
      }
      const parsedHmrPort = Number(settings.runtime?.hmrPort);
      if (Number.isFinite(parsedHmrPort) && parsedHmrPort > 0) {
        configuredHmrPort = parsedHmrPort;
      }
    } catch {
      // Fall back to defaults when settings.json is temporarily invalid.
    }
  }

  return {
    basePort,
    hmrPort: configuredHmrPort > 0 ? configuredHmrPort : basePort + 100,
  };
};

const collectTargetPorts = (basePort: number, hmrPort: number): number[] => {
  const ports = new Set<number>(VITE_WS_PORTS);
  for (let offset = 0; offset < PORT_SCAN_ATTEMPTS; offset += 1) {
    ports.add(basePort + offset);
  }
  // Prior sessions may have bound HMR to base+100+N when the preferred port was busy.
  for (let offset = 0; offset < PORT_SCAN_ATTEMPTS; offset += 1) {
    ports.add(hmrPort + offset);
  }
  // Isolated Vite child process (devViteChild) prefers base+200+N.
  for (let offset = 0; offset < PORT_SCAN_ATTEMPTS; offset += 1) {
    ports.add(basePort + 200 + offset);
  }
  return [...ports];
};

const toPowershellRegexAlternation = (markers: string[]): string => markers
  .map((marker) => marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '[\\\\/]'))
  .join('|');

const stopWindowsProcesses = (ports: number[]): void => {
  // Inline `powershell -Command "..."` breaks on nested quotes. Write a temp .ps1 instead.
  const markerPattern = toPowershellRegexAlternation(SERVER_COMMAND_MARKERS);
  const orphanPattern = toPowershellRegexAlternation(ORPHAN_TYPECHECK_MARKERS);
  const scriptPath = path.join(os.tmpdir(), `appendo-restart-kill-${process.pid}.ps1`);
  const portLiteral = ports.join(', ');

  const script = [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `$ports = [int[]]@(${portLiteral})`,
    `$portSet = [System.Collections.Generic.HashSet[int]]::new($ports)`,
    `$pattern = '${markerPattern}'`,
    `$orphanPattern = '${orphanPattern}'`,
    `$names = @('node.exe', 'tsx.exe')`,
    `foreach ($name in $names) {`,
    `  Get-CimInstance Win32_Process -Filter "Name = '$name'" |`,
    `    Where-Object {`,
    `      $_.CommandLine -and (`,
    `        ($_.CommandLine -match $pattern) -or ($_.CommandLine -match $orphanPattern)`,
    `      )`,
    `    } |`,
    `    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
    `}`,
    `Get-NetTCPConnection -State Listen |`,
    `  Where-Object { $portSet.Contains([int]$_.LocalPort) } |`,
    `  Select-Object -ExpandProperty OwningProcess -Unique |`,
    `  ForEach-Object { Stop-Process -Id $_ -Force }`,
    ``,
  ].join('\r\n');

  try {
    fs.writeFileSync(scriptPath, script, 'utf8');
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch {
    // Nothing to stop, or transient WMI/netstat failure — second pass still runs.
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      // temp cleanup best-effort
    }
  }
};

const killPid = (pid: number): void => {
  if (!Number.isFinite(pid) || pid <= 0) {
    return;
  }

  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // Process may already be gone.
  }
};

const stopUnixProcesses = (ports: number[]): void => {
  for (const marker of [...SERVER_COMMAND_MARKERS, ...ORPHAN_TYPECHECK_MARKERS]) {
    try {
      execSync(`pkill -f "${marker}"`, { stdio: 'ignore' });
    } catch {
      // Nothing to stop.
    }
  }

  for (const port of ports) {
    try {
      const output = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
      if (!output) {
        continue;
      }
      for (const pidText of output.split('\n')) {
        killPid(Number(pidText.trim()));
      }
    } catch {
      // No listeners on this port.
    }
  }
};

const stopExistingServer = (ports: number[]): void => {
  if (process.platform === 'win32') {
    stopWindowsProcesses(ports);
    return;
  }
  stopUnixProcesses(ports);
};

const parseMode = (argv: string[]): RestartMode => {
  const value = argv[2]?.trim().toLowerCase();
  if (value === 'prod' || value === 'production' || value === 'start') {
    return 'prod';
  }
  return 'dev';
};

const startHawietyDossierBundleWatcher = (): void => {
  const runtimeRoot = path.join(process.cwd(), 'packages-storage', 'runtimes', 'hawiety');
  if (!fs.existsSync(runtimeRoot)) {
    return;
  }

  const watcher = spawn('npm run hawiety:watch-dossier-view-bundle', {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  watcher.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[AppEndO] Hawiety dossier bundle watcher exited (${code}).`);
    }
  });

  console.log('[AppEndO] Hawiety package UI bundle watcher started (package pages sync from src on save).');
};

const startServer = (mode: RestartMode): void => {
  if (mode === 'dev') {
    startHawietyDossierBundleWatcher();
  }

  // `dev` itself routes through this script — start the server entry only (no recursion / no PWA regen).
  const npmScript = mode === 'prod' ? 'start' : 'dev:server';
  console.log(`[AppEndO] Starting npm run ${npmScript}…`);

  const child = spawn(`npm run ${npmScript}`, {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
    shell: true,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.error(`[AppEndO] Server process stopped (${signal}).`);
      process.kill(process.pid, signal);
      return;
    }
    if (code !== 0 && code !== null) {
      console.error(
        `[AppEndO] Server process exited with code ${code}. Run "npm run dev:server" alone to see the full startup error.`,
      );
    }
    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    console.error('[AppEndO] Failed to start server:', error.message);
    process.exit(1);
  });
};

const main = async (): Promise<void> => {
  const mode = parseMode(process.argv);
  const { basePort, hmrPort } = readRuntimePorts();
  const targetPorts = collectTargetPorts(basePort, hmrPort);

  console.log('[AppEndO] Restart requested.');
  console.log(`[AppEndO] Mode: ${mode}`);
  console.log(`[AppEndO] Stopping existing AppEndO processes (ports ${basePort}-${basePort + PORT_SCAN_ATTEMPTS - 1}, HMR ${hmrPort}+)…`);

  stopExistingServer(targetPorts);

  await sleep(800);
  stopExistingServer(targetPorts);
  await sleep(400);

  const lockedSqlite = removePendingInstallSqliteLeftovers({
    settingsPath: SETTINGS_PATH,
    backupPath: path.join(process.cwd(), 'settings.json.install-backup'),
  });
  if (lockedSqlite.length > 0) {
    console.warn('[AppEndO] Could not remove leftover SQLite files after stop:');
    for (const filePath of lockedSqlite) {
      console.warn(`[AppEndO]   ${filePath}`);
    }
  }

  startServer(mode);
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[AppEndO] Restart failed:', message);
  process.exit(1);
});
