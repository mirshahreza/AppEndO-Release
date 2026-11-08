import fs from 'fs';
import path from 'path';
import {
  DEFAULT_SQLITE_INSTALL_PATH,
  readSqliteUrlFromSettingsFile,
  removeSqliteInstallFiles,
} from './lib/sqliteInstallResetFiles';

const ROOT = process.cwd();
const INSTALL_TEMPLATE = path.join(ROOT, 'settings.install.json');
const SETTINGS_PATH = path.join(ROOT, 'settings.json');
const SETTINGS_BACKUP = path.join(ROOT, 'settings.json.install-backup');

const printUsage = () => {
  console.log(`Reset AppEndO to install-wizard greenfield state.

Usage:
  npm run install:reset

Options:
  --keep-backup   Keep settings.json.install-backup instead of deleting it
`);
};

const main = () => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    return;
  }

  if (!fs.existsSync(INSTALL_TEMPLATE)) {
    console.error(`[install:reset] Missing template: ${INSTALL_TEMPLATE}`);
    process.exit(1);
  }

  const sqliteFromCurrent = readSqliteUrlFromSettingsFile(SETTINGS_PATH);

  if (fs.existsSync(SETTINGS_PATH)) {
    fs.copyFileSync(SETTINGS_PATH, SETTINGS_BACKUP);
    console.log(`[install:reset] Backed up current settings to ${SETTINGS_BACKUP}`);
  }

  fs.copyFileSync(INSTALL_TEMPLATE, SETTINGS_PATH);
  console.log(`[install:reset] Wrote fresh install settings to ${SETTINGS_PATH}`);

  const locked: string[] = [];
  if (sqliteFromCurrent) {
    locked.push(...removeSqliteInstallFiles('previous install', sqliteFromCurrent).locked);
  }
  locked.push(...removeSqliteInstallFiles('default path', DEFAULT_SQLITE_INSTALL_PATH).locked);
  const uniqueLocked = [...new Set(locked)];

  console.log('[install:reset] Next: npm run restart (or npm run dev)');
  console.log('[install:reset] Open http://localhost:3000/install (hard refresh if the page was already open).');
  console.log('[install:reset] The wizard will configure the database, schema, and admin account.');
  if (uniqueLocked.length > 0) {
    console.warn('[install:reset] SQLite files were still locked by a running server:');
    for (const filePath of uniqueLocked) {
      console.warn(`[install:reset]   ${filePath}`);
    }
    console.warn('[install:reset] npm run restart stops the process and deletes leftover SQLite files before the wizard starts.');
  }
};

main();
