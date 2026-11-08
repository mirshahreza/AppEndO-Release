export const PACKAGE_DB_BLOB_INDEX_ENTRY = 'db/blobs/index.json';
export const PACKAGE_DB_BLOB_FILES_PREFIX = 'db/blobs/files/';

const BLOB_TOKEN_PATTERN = /\{\{package_blob:([a-zA-Z0-9_./=-]+)\}\}/g;

export type SqlDialectFamily = 'postgres' | 'sqlserver' | 'mysql' | 'sqlite' | 'unknown';

export type PackageDbBlobIndexItem = {
  entry: string;
  table: string;
  column: string;
  key: Record<string, string>;
  byteLength: number;
};

export type PackageDbBlobIndex = {
  version: 1;
  blobs: PackageDbBlobIndexItem[];
};

export type TableFkEdge = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
};

export function isBinaryColumnType(dataType: string): boolean {
  const normalized = dataType.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('bytea')) return true;
  if (normalized.includes('varbinary')) return true;
  if (normalized.includes('longblob') || normalized.includes('mediumblob') || normalized.includes('tinyblob')) {
    return true;
  }
  if (/(^|\s)blob(\s|$|\()/.test(normalized)) return true;
  if (/^binary(\s*\(|$)/.test(normalized)) return true;
  if (normalized === 'image' || normalized.startsWith('image(')) return true;
  return false;
}

export function dialectFamilyFromDataSourceType(sourceType: string): SqlDialectFamily {
  const normalized = sourceType.trim().toLowerCase();
  if (normalized.includes('postgres')) return 'postgres';
  if (normalized.includes('sql server') || normalized.includes('mssql')) return 'sqlserver';
  if (normalized.includes('mysql') || normalized.includes('mariadb')) return 'mysql';
  if (normalized.includes('sqlite')) return 'sqlite';
  return 'unknown';
}

export function sqlBinaryLiteral(bytes: Buffer, dialect: SqlDialectFamily): string {
  const hex = bytes.toString('hex');
  if (dialect === 'sqlserver') return `0x${hex}`;
  if (dialect === 'mysql') return `UNHEX('${hex}')`;
  if (dialect === 'sqlite') return `X'${hex}'`;
  return `decode('${hex}', 'hex')`;
}

export function packageBlobToken(entry: string): string {
  return `{{package_blob:${entry}}}`;
}

export function blobFileEntryForKey(table: string, column: string, keyFingerprint: string): string {
  const safe = `${table}_${column}_${keyFingerprint}`.replace(/[^a-zA-Z0-9._=-]/g, '_').slice(0, 120);
  return `${PACKAGE_DB_BLOB_FILES_PREFIX}${safe}.bin`;
}

export function fingerprintRowKey(key: Record<string, string>): string {
  return Object.keys(key).sort().map((name) => `${name}=${key[name]}`).join('&')
    .replace(/[^a-zA-Z0-9._=-]/g, '_')
    .slice(0, 80) || 'row';
}

export function decodeBinaryColumnValue(value: unknown): Buffer | null {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === 'object' && value !== null && Array.isArray((value as { data?: unknown }).data)) {
    const data = (value as { data: unknown[] }).data;
    if (data.every((item) => typeof item === 'number')) {
      return Buffer.from(data as number[]);
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('\\x')) return Buffer.from(trimmed.slice(2), 'hex');
    if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return Buffer.from(trimmed.slice(2), 'hex');
  }
  return null;
}

export function expandPackageBlobTokens(
  sql: string,
  blobsByEntry: ReadonlyMap<string, Buffer>,
  dialect: SqlDialectFamily,
): string {
  BLOB_TOKEN_PATTERN.lastIndex = 0;
  return sql.replace(BLOB_TOKEN_PATTERN, (_full, entry: string) => {
    const bytes = blobsByEntry.get(entry);
    if (!bytes) {
      throw new Error(`Package blob "${entry}" is missing from the ZIP.`);
    }
    return sqlBinaryLiteral(bytes, dialect);
  });
}

export function collectPackageBlobTokens(sql: string): string[] {
  const entries: string[] = [];
  const seen = new Set<string>();
  BLOB_TOKEN_PATTERN.lastIndex = 0;
  for (const match of sql.matchAll(BLOB_TOKEN_PATTERN)) {
    const entry = match[1];
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    entries.push(entry);
  }
  return entries;
}

export function topologicalSortTables(tables: readonly string[], edges: readonly TableFkEdge[]): string[] {
  const selected = new Set(tables.map((table) => table.trim()).filter(Boolean));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const table of selected) {
    incoming.set(table, 0);
    outgoing.set(table, []);
  }

  for (const edge of edges) {
    if (!selected.has(edge.fromTable) || !selected.has(edge.toTable)) continue;
    if (edge.fromTable === edge.toTable) continue;
    outgoing.get(edge.toTable)!.push(edge.fromTable);
    incoming.set(edge.fromTable, (incoming.get(edge.fromTable) ?? 0) + 1);
  }

  const queue = [...selected].filter((table) => (incoming.get(table) ?? 0) === 0).sort();
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const next of outgoing.get(current) ?? []) {
      const remaining = (incoming.get(next) ?? 1) - 1;
      incoming.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
    queue.sort();
  }

  for (const table of selected) {
    if (!ordered.includes(table)) ordered.push(table);
  }
  return ordered;
}

export function sortRowsParentsFirst(
  rows: Array<Record<string, unknown>>,
  idColumn: string,
  parentColumn: string,
): Array<Record<string, unknown>> {
  const remaining = [...rows];
  const placed = new Set<string>();
  const ordered: Array<Record<string, unknown>> = [];

  while (remaining.length > 0) {
    const readyIndex = remaining.findIndex((row) => {
      const parent = row[parentColumn];
      if (parent === null || parent === undefined || String(parent) === '') return true;
      return placed.has(String(parent));
    });
    if (readyIndex < 0) {
      ordered.push(...remaining);
      break;
    }
    const [row] = remaining.splice(readyIndex, 1);
    if (!row) break;
    ordered.push(row);
    placed.add(String(row[idColumn] ?? ''));
  }
  return ordered;
}

export function sqlInList(values: unknown[], quoteValue: (value: unknown) => string): string {
  if (values.length === 0) return '(NULL)';
  return `(${values.map((value) => quoteValue(value)).join(', ')})`;
}

export function serializePackageDbBlobIndex(index: PackageDbBlobIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function parsePackageDbBlobIndex(raw: string): PackageDbBlobIndex {
  const parsed = JSON.parse(raw) as PackageDbBlobIndex;
  if (parsed?.version !== 1 || !Array.isArray(parsed.blobs)) {
    throw new Error('Package blob index is invalid.');
  }
  return parsed;
}

export type CapturedPackageBlob = {
  entry: string;
  table: string;
  column: string;
  key: Record<string, string>;
  contentBase64: string;
  byteLength: number;
};

export function mergeCapturedPackageBlobs(blobs: readonly CapturedPackageBlob[]): CapturedPackageBlob[] {
  const byEntry = new Map<string, CapturedPackageBlob>();
  for (const blob of blobs) {
    if (!blob.entry) continue;
    byEntry.set(blob.entry, blob);
  }
  return [...byEntry.values()];
}

export function buildPackageDbBlobIndex(blobs: readonly CapturedPackageBlob[]): PackageDbBlobIndex {
  return {
    version: 1,
    blobs: blobs.map((blob) => ({
      entry: blob.entry,
      table: blob.table,
      column: blob.column,
      key: blob.key,
      byteLength: blob.byteLength,
    })),
  };
}
