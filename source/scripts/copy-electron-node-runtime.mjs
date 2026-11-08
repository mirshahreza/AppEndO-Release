/**
 * Copy the current Node.js binary into build/electron-runtime so the Windows
 * installer can run dist/server.cjs with the same ABI as node_modules
 * (better-sqlite3, sharp, …) without electron-rebuild / Visual Studio.
 */
import fs from 'node:fs';
import path from 'node:path';

const destDir = path.join(process.cwd(), 'build', 'electron-runtime');
const destName = process.platform === 'win32' ? 'node.exe' : 'node';
const destPath = path.join(destDir, destName);
const sourcePath = process.execPath;

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Node.js binary not found at ${sourcePath}`);
}

const baseName = path.basename(sourcePath).toLowerCase();
if (baseName.includes('electron')) {
  throw new Error(
    `Refusing to bundle ${sourcePath}. Run this script with Node.js, not Electron.`,
  );
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(sourcePath, destPath);
console.log(`[electron-runtime] Copied ${sourcePath} -> ${destPath}`);
