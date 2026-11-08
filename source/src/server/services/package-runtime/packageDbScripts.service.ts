import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createEdgeDbQueryExecutor } from '../../../core/database/EdgeDbRouter';
import type { PackageManifest } from '../../../core/packages/PackageManifestValidator';
import { isVerticalAppManifest } from '../../../core/packages/PackageManifestValidator';
import { selectDbObjectsForRecordChoice } from '../../../core/packages/packageDbObjectInstallMode';
import { packageDirs, readPackageIndex } from '../../../core/packages/PackageFileStore';
import {
  PACKAGE_DB_BLOB_FILES_PREFIX,
  dialectFamilyFromDataSourceType,
  expandPackageBlobTokens,
} from '../../../core/packages/packageDbBlobPayload';
import {
  rewriteUnquotedBooleanKeywords,
  splitSqlGoBatches,
  wrapSqlServerIdentityInserts,
} from '../../../core/packages/packageDbScriptSql';
import {
  PACKAGE_HID_REWRITE_ENTRY,
  applyHidRewriteMap,
  parsePackageHidRewriteIndex,
  planBaseInfoHidRewrite,
  type PackageHidRewriteIndex,
} from '../../../core/packages/packageSeedHidRewrite';
import { calculateBaseInfoHierarchicalId } from '../../domain/base-info/baseInfoHid';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';

export type PluginDbScriptResult =
  | { ok: true; executedScripts: string[] }
  | { ok: false; error: string; details?: string[] };

export type PackageDbScriptRecordChoice = {
  includeOptionalRecords?: boolean;
};

function normalizeZipEntryName(entryName: string): string {
  return entryName.replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveArtifactPath(packageId: string, version: string): string | null {
  const index = readPackageIndex();
  const entry = index.packages.find((pkg) => pkg.packageId === packageId);
  const versionEntry = entry?.versions.find((item) => item.version === version);
  if (!versionEntry?.artifactPath) return null;
  return path.join(packageDirs.root, versionEntry.artifactPath.replace(/\\/g, '/'));
}

function resolveTargetDataSourceId(targetDataSource: string): string {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  if (targetDataSource && targetDataSource !== 'default') {
    const match = sources.find((source) => source.id === targetDataSource);
    if (match) return match.id;
  }
  return sources.find((source) => source.isDefault)?.id || sources[0]?.id || 'default';
}

export function readSqlFromArtifact(
  artifactPath: string,
  scriptPath: string,
): string | null {
  const zip = new AdmZip(artifactPath);
  const normalized = normalizeZipEntryName(scriptPath);
  const entry = zip.getEntries().find((item) => normalizeZipEntryName(item.entryName) === normalized);
  if (!entry || entry.isDirectory) return null;
  return entry.getData().toString('utf8');
}

export function loadBlobsFromArtifact(artifactPath: string): Map<string, Buffer> {
  const zip = new AdmZip(artifactPath);
  const blobs = new Map<string, Buffer>();
  for (const entry of zip.getEntries()) {
    const name = normalizeZipEntryName(entry.entryName);
    if (!name.startsWith(PACKAGE_DB_BLOB_FILES_PREFIX) || entry.isDirectory) continue;
    blobs.set(name, entry.getData());
  }
  return blobs;
}

export function loadHidRewriteIndexFromArtifact(artifactPath: string): PackageHidRewriteIndex | null {
  const raw = readSqlFromArtifact(artifactPath, PACKAGE_HID_REWRITE_ENTRY);
  if (!raw?.trim()) return null;
  try {
    return parsePackageHidRewriteIndex(raw);
  } catch {
    return null;
  }
}

function quoteIdentifier(sourceType: string, name: string): string {
  if (sourceType === 'MySQL') return `\`${name}\``;
  if (sourceType === 'SQL Server') return `[${name}]`;
  return `"${name}"`;
}

async function planHidMapForDestination(
  hidIndex: PackageHidRewriteIndex | null,
  dataSourceId: string,
): Promise<Record<string, string>> {
  if (!hidIndex?.rows.length) return {};
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.id === dataSourceId)
    ?? sources.find((item) => item.isDefault);
  const sourceType = source?.type ?? 'PostgreSQL';
  const execute = createEdgeDbQueryExecutor({
    getDataSources: () => sources,
  });
  try {
    const quotedTable = quoteIdentifier(sourceType, 'base_info');
    const quotedId = quoteIdentifier(sourceType, 'id');
    const quotedTitle = quoteIdentifier(sourceType, 'title');
    const result = await execute(
      `SELECT ${quotedId} AS id, ${quotedTitle} AS title FROM ${quotedTable}`,
      [],
      { dataSourceId },
    );
    const existingById = new Map<string, string>();
    for (const row of result.data) {
      if (!row || typeof row !== 'object') continue;
      const record = row as Record<string, unknown>;
      const id = String(record.id ?? '').trim();
      if (!id) continue;
      existingById.set(id, String(record.title ?? '').trim());
    }
    const taken = new Set(existingById.keys());
    return planBaseInfoHidRewrite(hidIndex.rows, existingById, async (parentId) => {
      const id = await calculateBaseInfoHierarchicalId({
        parentId,
        idExists: async (candidate) => taken.has(candidate),
      });
      taken.add(id);
      return id;
    });
  } catch {
    return {};
  }
}

function dialectForDataSource(dataSourceId: string) {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((item) => item.id === dataSourceId)
    ?? sources.find((item) => item.isDefault);
  return dialectFamilyFromDataSourceType(source?.type ?? '');
}

export function expandPackageDbScriptSql(
  sql: string,
  blobs: ReadonlyMap<string, Buffer>,
  dialect: ReturnType<typeof dialectFamilyFromDataSourceType>,
  hidMap: Record<string, string> = {},
): string {
  const expanded = expandPackageBlobTokens(sql.trim(), blobs, dialect);
  return applyHidRewriteMap(expanded, hidMap);
}

async function listSqlServerIdentityTables(
  execute: ReturnType<typeof createEdgeDbQueryExecutor>,
  dataSourceId: string,
): Promise<Set<string>> {
  try {
    const result = await execute<{ table_name: string }>(
      'SELECT OBJECT_NAME(object_id) AS table_name FROM sys.identity_columns',
      [],
      { dataSourceId },
    );
    return new Set(
      result.data
        .map((row) => String(row.table_name ?? '').trim())
        .filter(Boolean),
    );
  } catch {
    return new Set();
  }
}

function collectSqlFailureLines(error: unknown): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== 'string') return;
    for (const part of value.split(/\r?\n/)) {
      const trimmed = part.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      lines.push(trimmed);
    }
  };

  const walk = (value: unknown, depth: number) => {
    if (!value || depth > 5) return;
    if (value instanceof Error) {
      add(value.message);
      walk((value as Error & { cause?: unknown }).cause, depth + 1);
      walk((value as { originalError?: unknown }).originalError, depth + 1);
      const preceding = (value as { precedingErrors?: unknown }).precedingErrors;
      if (Array.isArray(preceding)) {
        for (const item of preceding) walk(item, depth + 1);
      }
      return;
    }
    if (typeof value !== 'object') {
      add(value);
      return;
    }
    const record = value as Record<string, unknown>;
    add(record.message);
    if (typeof record.number === 'number' && typeof record.lineNumber === 'number') {
      add(`SQL ${record.number} at line ${record.lineNumber}`);
    } else if (typeof record.number === 'number') {
      add(`SQL error ${record.number}`);
    } else if (typeof record.lineNumber === 'number') {
      add(`Line ${record.lineNumber}`);
    }
    walk(record.info, depth + 1);
    walk(record.cause, depth + 1);
    walk(record.originalError, depth + 1);
  };

  walk(error, 0);
  return lines.length > 0 ? lines : ['SQL execution failed.'];
}

async function executeSqlScript(
  sql: string,
  dataSourceId: string,
  blobs: ReadonlyMap<string, Buffer>,
  hidMap: Record<string, string>,
): Promise<void> {
  const trimmed = sql.trim();
  if (!trimmed) return;

  const dialect = dialectForDataSource(dataSourceId);
  const expanded = rewriteUnquotedBooleanKeywords(
    expandPackageDbScriptSql(trimmed, blobs, dialect, hidMap),
    dialect,
  );
  const execute = createEdgeDbQueryExecutor({
    getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
  });

  for (const batch of splitSqlGoBatches(expanded)) {
    let toRun = batch;
    if (dialect === 'sqlserver') {
      const identityTables = await listSqlServerIdentityTables(execute, dataSourceId);
      toRun = wrapSqlServerIdentityInserts(batch, identityTables);
    }
    await execute(toRun, [], { dataSourceId });
  }
}

export async function runPackageInstallDbScripts(
  packageId: string,
  version: string,
  manifest: PackageManifest,
  targetDataSource: string,
  recordChoice: PackageDbScriptRecordChoice = {},
): Promise<PluginDbScriptResult> {
  const dbObjects = selectDbObjectsForRecordChoice(
    manifest.capabilities.db_objects,
    recordChoice.includeOptionalRecords !== false,
  );
  if (dbObjects.length === 0) {
    return { ok: true, executedScripts: [] };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.` };
  }

  const dataSourceId = resolveTargetDataSourceId(targetDataSource);
  const blobs = loadBlobsFromArtifact(artifactPath);
  const hidMap = await planHidMapForDestination(loadHidRewriteIndexFromArtifact(artifactPath), dataSourceId);
  const executedScripts: string[] = [];
  const details: string[] = [];

  for (const obj of dbObjects) {
    const objDataSource = obj.targetDataSource?.trim() || dataSourceId;
    const installSql = readSqlFromArtifact(artifactPath, obj.installScript);
    if (!installSql) {
      details.push(`Install script "${obj.installScript}" is missing from artifact.`);
      break;
    }

    try {
      await executeSqlScript(installSql, objDataSource, blobs, hidMap);
      executedScripts.push(obj.installScript);
    } catch (error: unknown) {
      details.push(`Install script "${obj.installScript}" failed.`);
      details.push(...collectSqlFailureLines(error));
      break;
    }

    if (obj.seedScript) {
      const seedSql = readSqlFromArtifact(artifactPath, obj.seedScript);
      if (!seedSql) {
        details.push(`Seed script "${obj.seedScript}" is missing from artifact.`);
        break;
      }
      try {
        await executeSqlScript(seedSql, objDataSource, blobs, hidMap);
        executedScripts.push(obj.seedScript);
      } catch (error: unknown) {
        details.push(`Seed script "${obj.seedScript}" failed.`);
        details.push(...collectSqlFailureLines(error));
        break;
      }
    }
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'One or more package database scripts failed.',
      details,
    };
  }

  return { ok: true, executedScripts };
}

export async function runPluginUninstallDbScripts(
  packageId: string,
  version: string,
  manifest: PackageManifest,
  targetDataSource: string,
  recordChoice: PackageDbScriptRecordChoice = {},
): Promise<PluginDbScriptResult> {
  const dbObjects = [...selectDbObjectsForRecordChoice(
    manifest.capabilities.db_objects,
    recordChoice.includeOptionalRecords !== false,
  )].reverse();
  if (dbObjects.length === 0) {
    return { ok: true, executedScripts: [] };
  }

  const artifactPath = resolveArtifactPath(packageId, version);
  if (!artifactPath || !fs.existsSync(artifactPath)) {
    return { ok: false, error: `Artifact for package "${packageId}"@${version} was not found.` };
  }

  const dataSourceId = resolveTargetDataSourceId(targetDataSource);
  const blobs = loadBlobsFromArtifact(artifactPath);
  const hidMap = await planHidMapForDestination(loadHidRewriteIndexFromArtifact(artifactPath), dataSourceId);
  const executedScripts: string[] = [];
  const details: string[] = [];

  for (const obj of dbObjects) {
    if (!obj.uninstallScript) continue;
    const objDataSource = obj.targetDataSource?.trim() || dataSourceId;
    const uninstallSql = readSqlFromArtifact(artifactPath, obj.uninstallScript);
    if (!uninstallSql) {
      details.push(`Uninstall script "${obj.uninstallScript}" is missing from artifact.`);
      continue;
    }

    try {
      await executeSqlScript(uninstallSql, objDataSource, blobs, hidMap);
      executedScripts.push(obj.uninstallScript);
    } catch (error: unknown) {
      details.push(`Uninstall script "${obj.uninstallScript}" failed.`);
      details.push(...collectSqlFailureLines(error));
    }
  }

  if (details.length > 0) {
    return {
      ok: false,
      error: 'One or more package database uninstall scripts failed.',
      details,
    };
  }

  return { ok: true, executedScripts };
}

export function manifestHasDbScripts(manifest: PackageManifest): boolean {
  return manifest.capabilities.db_objects.length > 0;
}

export function isVerticalAppDbManifest(manifest: PackageManifest): boolean {
  return isVerticalAppManifest(manifest);
}
