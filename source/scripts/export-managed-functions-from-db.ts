/**
 * One-time export: base_managed_functions (PostgreSQL) → workspace/server-functions/custom split files
 *
 * Run only when migrating an existing database that still has the legacy table.
 * Greenfield installs do not need this script.
 */

import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { toPgPoolConfig } from '../src/server/config/env';
import {
  buildFunctionMetadataFileName,
  buildFunctionSourceFileName,
  buildManagedFunctionId,
} from '../src/core/functions/functionNaming';
import { atomicWriteText } from '../src/core/runtime/RuntimeFileStore';
import { runtimeDirs } from '../src/core/runtime/runtimePaths';
import { ensureFunctionStoreDirs, listManagedFunctionsFromStore } from '../src/core/functions/FunctionFileStore';

type LegacyRow = {
  id: string;
  name: string;
  folder: string;
  method: string;
  path: string;
  code: string;
  language: string | null;
  test_payload: string | null;
  runtime_version: string | null;
  memory_limit: number | null;
  timeout_ms: number | null;
  cache_enabled: boolean | null;
  cache_ttl_ms: number | null;
  cache_by_param: boolean | null;
  cache_by_user: boolean | null;
  created_at: string | Date;
  updated_at: string | Date;
  created_by: string | null;
  updated_by: string | null;
};

const main = async () => {
  const pool = new Pool(toPgPoolConfig());

  try {
    await pool.query('SELECT 1');

    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'base_managed_functions'
      ) AS exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      console.log('[functions:export-db] Legacy table base_managed_functions not found — nothing to export.');
      return;
    }

    const result = await pool.query<LegacyRow>(`
      SELECT id, name, folder, method, path, code, language, test_payload, runtime_version,
             memory_limit, timeout_ms, cache_enabled, cache_ttl_ms, cache_by_param, cache_by_user,
             created_at, updated_at, created_by::text, updated_by::text
      FROM base_managed_functions
      ORDER BY created_at ASC
    `);

    ensureFunctionStoreDirs();

    let exported = 0;
    let skipped = 0;

    for (const row of result.rows) {
      const language = row.language === 'js' ? 'js' : 'ts';
      const metadataFile = buildFunctionMetadataFileName(row.folder, row.name);
      const sourceFile = buildFunctionSourceFileName(row.folder, row.name, language);
      const metadataPath = path.join(process.cwd(), 'workspace/server-functions/custom', metadataFile);
      if (fs.existsSync(metadataPath)) {
        skipped += 1;
        continue;
      }

      const metadata = {
        schema: 'append-server-function-metadata',
        schemaVersion: '2.0.0',
        id: buildManagedFunctionId(row.folder, row.name),
        name: row.name,
        folder: row.folder,
        method: String(row.method).toUpperCase(),
        path: row.path,
        sourceFile,
        language,
        testPayload: row.test_payload ?? '{}',
        runtimeVersion: row.runtime_version ?? 'v20.x',
        memoryLimit: row.memory_limit ?? 128,
        timeoutMs: row.timeout_ms ?? 1500,
        cacheEnabled: Boolean(row.cache_enabled),
        cacheTtlMs: row.cache_ttl_ms ?? 180000,
        cacheByParam: Boolean(row.cache_by_param),
        cacheByUser: Boolean(row.cache_by_user),
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        createdBy: row.created_by,
        updatedBy: row.updated_by,
      };

      atomicWriteText(
        path.join(process.cwd(), 'workspace/server-functions/custom', sourceFile),
        row.code,
        runtimeDirs.workspaceTemp,
      );
      atomicWriteText(metadataPath, JSON.stringify(metadata, null, 2), runtimeDirs.workspaceTemp);
      exported += 1;
    }

    if (exported > 0) {
      listManagedFunctionsFromStore();
    }

    console.log(`[functions:export-db] Done. exported=${exported} skipped=${skipped} total=${result.rows.length}`);
  } finally {
    await pool.end();
  }
};

main().catch((error) => {
  console.error('[functions:export-db] failed:', error?.message || error);
  process.exit(1);
});
