import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { ChangeGraphCheckpoint } from '../../api/contracts/appendoo/changeGraphCheckpoint.types';
import type { ChangeGraphCheckpointBacking } from './changeGraphCheckpointBackingStore';
import { MemoryChangeGraphCheckpointBacking } from './changeGraphCheckpointBackingStore';
import { parseChangeGraphCheckpoint } from './changeGraphCheckpointValidation';

const DEFAULT_CHECKPOINT_DB_PATH = 'workspace/appendoo/checkpoints/checkpoints.db';

let sharedDb: Database.Database | null = null;
let sharedDbPath: string | null = null;

export const resolveCheckpointDbPath = (): string => {
  const configured = process.env.APPENDOO_CHECKPOINT_DB_PATH?.trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }
  return path.join(process.cwd(), DEFAULT_CHECKPOINT_DB_PATH);
};

const openSharedDb = (): Database.Database => {
  const dbPath = resolveCheckpointDbPath();
  if (sharedDb && sharedDbPath === dbPath) {
    return sharedDb;
  }

  if (sharedDb) {
    sharedDb.close();
    sharedDb = null;
    sharedDbPath = null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const BetterSqlite3 = require('better-sqlite3') as typeof import('better-sqlite3').default;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  sharedDb = new BetterSqlite3(dbPath);
  sharedDbPath = dbPath;
  sharedDb.pragma('journal_mode = WAL');
  sharedDb.pragma('busy_timeout = 5000');
  sharedDb.exec(`
    CREATE TABLE IF NOT EXISTS change_graph_checkpoints (
      change_graph_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      saved_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_change_graph_checkpoints_saved_at
      ON change_graph_checkpoints (saved_at);
  `);
  return sharedDb;
};

export const closeSharedCheckpointDb = (): void => {
  if (sharedDb) {
    sharedDb.close();
    sharedDb = null;
    sharedDbPath = null;
  }
};

/** AE-7.8/7.9 — SQLite checkpoint provider (APPENDOO_CHECKPOINT_BACKING=sqlite). */
export class SqliteChangeGraphCheckpointBacking implements ChangeGraphCheckpointBacking {
  private memory = new MemoryChangeGraphCheckpointBacking();

  private getDb(): Database.Database {
    return openSharedDb();
  }

  save(checkpoint: ChangeGraphCheckpoint): ChangeGraphCheckpoint {
    this.memory.save(checkpoint);
    this.getDb().prepare(`
      INSERT INTO change_graph_checkpoints (change_graph_id, payload, saved_at)
      VALUES (?, ?, ?)
      ON CONFLICT(change_graph_id) DO UPDATE SET
        payload = excluded.payload,
        saved_at = excluded.saved_at
    `).run(checkpoint.changeGraphId, JSON.stringify(checkpoint), checkpoint.savedAt);
    return checkpoint;
  }

  read(changeGraphId: string): ChangeGraphCheckpoint | undefined {
    const cached = this.memory.read(changeGraphId);
    if (cached) {
      return cached;
    }

    const row = this.getDb().prepare(
      'SELECT payload FROM change_graph_checkpoints WHERE change_graph_id = ?',
    ).get(changeGraphId) as { payload: string } | undefined;

    if (!row) {
      return undefined;
    }

    const parsed = parseChangeGraphCheckpoint(JSON.parse(row.payload));
    if (!parsed) {
      return undefined;
    }

    this.memory.save(parsed);
    return parsed;
  }

  clear(changeGraphId: string): void {
    this.memory.clear(changeGraphId);
    this.getDb().prepare('DELETE FROM change_graph_checkpoints WHERE change_graph_id = ?').run(changeGraphId);
  }

  resetForTests(): void {
    this.memory.resetForTests();
    if (sharedDb) {
      sharedDb.exec('DELETE FROM change_graph_checkpoints');
      closeSharedCheckpointDb();
    }
  }
}
