import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { applyAdditiveControlPlaneSchema } from '../controlPlaneSchemaPush';

const MINI_SCHEMA = `generator client {
  provider = "prisma-client"
  output   = "./generated"
}

datasource db {
  provider = "sqlite"
}

model BaseWidget {
  id   Int    @id @default(autoincrement())
  name String
  @@map("base_widgets")
}
`;

const MINI_SCHEMA_WITH_NOTE = `generator client {
  provider = "prisma-client"
  output   = "./generated"
}

datasource db {
  provider = "sqlite"
}

model BaseWidget {
  id   Int    @id @default(autoincrement())
  name String
  note String @default("")
  @@map("base_widgets")
}
`;

describe('applyAdditiveControlPlaneSchema preserves unknown tables', () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('leaves a non-Prisma table and its rows intact across greenfield + upgrade sync', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-schema-preserve-'));
    dirs.push(dir);

    const schemaPath = path.join(dir, 'schema.prisma');
    const dbPath = path.join(dir, 'control.db');
    fs.writeFileSync(schemaPath, MINI_SCHEMA, 'utf8');

    const url = `file:${dbPath}`;
    applyAdditiveControlPlaneSchema(url, schemaPath, { provider: 'sqlite' });

    const db = new Database(dbPath);
    try {
      db.exec(`
        CREATE TABLE hwy_members (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
      db.prepare('INSERT INTO hwy_members (id, name) VALUES (?, ?)').run(1, 'keep-me');
      db.prepare('INSERT INTO hwy_members (id, name) VALUES (?, ?)').run(2, 'also-keep');
    } finally {
      db.close();
    }

    applyAdditiveControlPlaneSchema(url, schemaPath, { provider: 'sqlite' });

    fs.writeFileSync(schemaPath, MINI_SCHEMA_WITH_NOTE, 'utf8');
    applyAdditiveControlPlaneSchema(url, schemaPath, { provider: 'sqlite' });

    const verify = new Database(dbPath);
    try {
      const rows = verify.prepare('SELECT id, name FROM hwy_members ORDER BY id').all() as Array<{
        id: number;
        name: string;
      }>;
      expect(rows).toEqual([
        { id: 1, name: 'keep-me' },
        { id: 2, name: 'also-keep' },
      ]);

      const widgets = verify.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'base_widgets'`,
      ).all();
      expect(widgets).toHaveLength(1);

      const columns = verify.prepare('PRAGMA table_info(base_widgets)').all() as Array<{ name: string }>;
      expect(columns.map((column) => column.name)).toContain('note');
    } finally {
      verify.close();
    }
  });
});
