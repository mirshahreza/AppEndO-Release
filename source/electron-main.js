/**
 * Electron shell around the existing AppEndO Node/Express server.
 * The web server is spawned as a child process so `npm start` / `npm run start:web`
 * keep working unchanged (no in-process Express boot inside Electron).
 */
import { app, BrowserWindow, dialog } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 3000;
const READY_URL_RE = /READY — open https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)/i;
const SERVER_URL_RE = /Server running on https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)/i;
const SERVER_BOOT_TIMEOUT_MS = 120_000;
const PROBE_INTERVAL_MS = 400;

let mainWindow = null;
let serverProcess = null;
let spawnedServer = false;
let shuttingDown = false;

const isPackaged = app.isPackaged;

const resolveAppRoot = () => __dirname;

const readPreferredPort = (appRoot) => {
  const envPort = Number(process.env.PORT || process.env.ELECTRON_PORT);
  if (Number.isFinite(envPort) && envPort > 0) {
    return Math.floor(envPort);
  }

  const settingsPath = path.join(appRoot, 'settings.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const runtime = parsed && typeof parsed === 'object' ? parsed.runtime : null;
    const port = Number(runtime?.port ?? parsed?.port);
    if (Number.isFinite(port) && port > 0) {
      return Math.floor(port);
    }
  } catch {
    // Fall through to the project default (same as settingsFile.ts).
  }

  return DEFAULT_PORT;
};

const probeServer = (port) => new Promise((resolve) => {
  const req = http.get({
    hostname: '127.0.0.1',
    port,
    path: '/api/health',
    timeout: 1500,
  }, (res) => {
    res.resume();
    resolve(Boolean(res.statusCode && res.statusCode < 500));
  });
  req.on('error', () => {
    const fallback = http.get({
      hostname: '127.0.0.1',
      port,
      path: '/',
      timeout: 1500,
    }, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode));
    });
    fallback.on('error', () => resolve(false));
    fallback.on('timeout', () => {
      fallback.destroy();
      resolve(false);
    });
  });
  req.on('timeout', () => {
    req.destroy();
    resolve(false);
  });
});

const waitForServer = (initialPort, child, timeoutMs) => new Promise((resolve, reject) => {
  let settled = false;
  let detectedPort = initialPort;
  const startedAt = Date.now();

  const finish = (port) => {
    if (settled) return;
    settled = true;
    clearInterval(timer);
    resolve(port);
  };

  const fail = (error) => {
    if (settled) return;
    settled = true;
    clearInterval(timer);
    reject(error);
  };

  const onData = (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    const readyMatch = text.match(READY_URL_RE) || text.match(SERVER_URL_RE);
    if (readyMatch) {
      detectedPort = Number(readyMatch[1]) || detectedPort;
    }
  };

  child?.stdout?.on('data', onData);
  child?.stderr?.on('data', (chunk) => {
    const text = String(chunk);
    process.stderr.write(text);
    onData(text);
  });
  child?.once('exit', (code, signal) => {
    if (!settled) {
      fail(new Error(`App server exited before it became ready (code ${code}, signal ${signal}).`));
    }
  });

  const timer = setInterval(async () => {
    if (Date.now() - startedAt > timeoutMs) {
      fail(new Error(`Timed out waiting for the AppEndO server on port ${detectedPort}.`));
      return;
    }
    if (await probeServer(detectedPort)) {
      finish(detectedPort);
    }
  }, PROBE_INTERVAL_MS);
});

const resolveSystemNode = () => {
  const fromNpm = process.env.npm_node_execpath;
  if (fromNpm && fs.existsSync(fromNpm)) {
    return fromNpm;
  }
  return process.platform === 'win32' ? 'node.exe' : 'node';
};

const resolvePackagedNode = () => {
  const bundled = path.join(
    process.resourcesPath,
    'node-runtime',
    process.platform === 'win32' ? 'node.exe' : 'node',
  );
  if (fs.existsSync(bundled)) {
    return bundled;
  }
  return resolveSystemNode();
};

const resolveServerCommand = (appRoot) => {
  const serverCjs = path.join(appRoot, 'dist', 'server.cjs');
  const serverTs = path.join(appRoot, 'src', 'server', 'index.ts');
  const tsxCli = path.join(appRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

  if (isPackaged || fs.existsSync(serverCjs)) {
    return {
      execPath: isPackaged ? resolvePackagedNode() : resolveSystemNode(),
      args: [serverCjs],
      extraEnv: isPackaged ? { NODE_ENV: 'production' } : {},
    };
  }

  if (fs.existsSync(tsxCli) && fs.existsSync(serverTs)) {
    return {
      execPath: resolveSystemNode(),
      args: [tsxCli, serverTs],
      extraEnv: {},
    };
  }

  throw new Error(
    'App server bundle not found. Run `npm run build` (or keep `tsx` installed for electron:dev).',
  );
};

const spawnAppServer = (appRoot, preferredPort) => {
  const command = resolveServerCommand(appRoot);
  const childEnv = { ...process.env, ...command.extraEnv, PORT: String(preferredPort) };
  delete childEnv.ELECTRON_RUN_AS_NODE;
  delete childEnv.ELECTRON_NO_ASAR;

  const child = spawn(command.execPath, command.args, {
    cwd: appRoot,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  spawnedServer = true;
  return child;
};

const stopAppServer = () => {
  if (!spawnedServer || !serverProcess?.pid) {
    serverProcess = null;
    spawnedServer = false;
    return;
  }

  const pid = serverProcess.pid;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    serverProcess.kill('SIGTERM');
  }

  serverProcess = null;
  spawnedServer = false;
};

const createMainWindow = (port) => {
  const win = new BrowserWindow({
    show: false,
    minWidth: 800,
    minHeight: 600,
    minimizable: true,
    maximizable: true,
    closable: true,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
  win.loadURL(`http://localhost:${port}`);
  return win;
};

const quitApp = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAppServer();
  app.quit();
};

const boot = async () => {
  const appRoot = resolveAppRoot();
  const preferredPort = readPreferredPort(appRoot);

  if (await probeServer(preferredPort)) {
    return preferredPort;
  }

  serverProcess = spawnAppServer(appRoot, preferredPort);
  return waitForServer(preferredPort, serverProcess, SERVER_BOOT_TIMEOUT_MS);
};

// Chromium would otherwise resolve localhost to ::1; the Express server binds
// 127.0.0.1 in development. Force IPv4 so http://localhost:PORT matches the server.
app.commandLine.appendSwitch('host-resolver-rules', 'MAP localhost 127.0.0.1');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      const port = await boot();
      mainWindow = createMainWindow(port);
      mainWindow.on('closed', () => {
        mainWindow = null;
        quitApp();
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox('AppEndO', message);
      quitApp();
    }
  });

  app.on('window-all-closed', () => {
    quitApp();
  });

  app.on('before-quit', () => {
    stopAppServer();
  });
}
