/**
 * Package the Windows NSIS installer.
 *
 * electron-builder extracts Electron into `win-unpacked.tmp` then renames it.
 * Inside the Cursor/VS Code workspace that rename often hits EPERM because
 * the IDE or Defender has the folder open. Build into %TEMP% and copy the
 * Setup.exe back to ./release.
 */
import { build, Platform, Arch } from 'electron-builder';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rmWithRetry = (target) => {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
};

const copyRuntime = async () => {
  const runtimeUrl = pathToFileURL(
    path.join(process.cwd(), 'scripts', 'copy-electron-node-runtime.mjs'),
  ).href;
  await import(runtimeUrl);
};

const copyArtifacts = (fromDir, toDir) => {
  fs.mkdirSync(toDir, { recursive: true });
  const names = fs.readdirSync(fromDir);
  const wanted = names.filter((name) => (
    name.endsWith('.exe')
    || name.endsWith('.blockmap')
    || name.endsWith('.yml')
  ));
  if (wanted.length === 0) {
    throw new Error(`No installer artifacts found in ${fromDir}`);
  }
  for (const name of wanted) {
    fs.copyFileSync(path.join(fromDir, name), path.join(toDir, name));
    console.log(`[electron-release] Copied ${name} -> ${toDir}`);
  }
};

const run = async () => {
  await copyRuntime();

  const projectRelease = path.join(process.cwd(), 'release');
  for (const name of ['win-unpacked', 'win-unpacked.tmp']) {
    try {
      rmWithRetry(path.join(projectRelease, name));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[electron-release] Could not remove leftover ${name}: ${message}`);
    }
  }

  const outDir = path.join(os.tmpdir(), 'appendo-electron-release');
  try {
    rmWithRetry(outDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not clean temp build dir ${outDir}: ${message}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';

  console.log(`[electron-release] Building NSIS installer in ${outDir}`);
  await build({
    targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
    config: {
      directories: { output: outDir },
    },
    publish: 'never',
  });

  copyArtifacts(outDir, projectRelease);
  console.log(`[electron-release] Done. Installer is in ${projectRelease}`);
};

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[electron-release] ${message}`);
  process.exit(1);
});
