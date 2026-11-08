import { apiGet, apiPost } from '../../../shared/api/client';

export type CapturableSqlFile = {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
};

export async function fetchCapturableSqlFiles(): Promise<CapturableSqlFile[]> {
  const { data, response } = await apiGet<{
    success?: boolean;
    error?: string;
    files?: CapturableSqlFile[];
  }>('/api/packages/builder/sql-files');

  if (!response.ok || !data?.success || !Array.isArray(data.files)) {
    throw new Error(data?.error || 'Failed to list SQL files.');
  }

  return data.files;
}

export async function fetchCapturableSqlFileContent(relativePath: string): Promise<string> {
  const { data, response } = await apiGet<{
    success?: boolean;
    error?: string;
    content?: string;
  }>(`/api/packages/builder/sql-files/content?path=${encodeURIComponent(relativePath)}`);

  if (!response.ok || !data?.success || typeof data.content !== 'string') {
    throw new Error(data?.error || `Failed to read SQL file "${relativePath}".`);
  }

  return data.content;
}

export type CaptureSeedInsertsInput = {
  dataSourceId: string;
  tableName: string;
  relatedTables?: string[];
  where?: string;
  orderBy?: string;
  limit?: number;
  includeBinary?: boolean;
  includeDescendants?: boolean;
  parentColumn?: string;
};

export type CaptureSeedBlob = {
  entry: string;
  table: string;
  column: string;
  key: Record<string, string>;
  contentBase64: string;
  byteLength: number;
};

export type CaptureHidRow = {
  id: string;
  parentId: string | null;
  title: string;
};

export type CaptureSeedInsertsResult = {
  installSql: string;
  uninstallSql: string;
  rowCount: number;
  columns: string[];
  tables: string[];
  blobs: CaptureSeedBlob[];
  hidRows: CaptureHidRow[];
  warnings: string[];
};

export async function captureSeedInserts(
  input: CaptureSeedInsertsInput,
): Promise<CaptureSeedInsertsResult> {
  const { data, response } = await apiPost<{
    success?: boolean;
    error?: string;
    installSql?: string;
    uninstallSql?: string;
    rowCount?: number;
    columns?: string[];
    tables?: string[];
    blobs?: CaptureSeedBlob[];
    hidRows?: CaptureHidRow[];
    warnings?: string[];
  }>('/api/packages/builder/db-capture/seed', input);

  if (!response.ok || !data?.success || typeof data.installSql !== 'string') {
    throw new Error(data?.error || 'Failed to capture seed data.');
  }

  return {
    installSql: data.installSql,
    uninstallSql: data.uninstallSql ?? '',
    rowCount: data.rowCount ?? 0,
    columns: data.columns ?? [],
    tables: data.tables ?? [],
    blobs: data.blobs ?? [],
    hidRows: data.hidRows ?? [],
    warnings: data.warnings ?? [],
  };
}

export type CaptureCmsModuleResult = {
  schemaInstallSql: string;
  schemaUninstallSql: string;
  vocabInstallSql: string;
  vocabUninstallSql: string;
  vocabHidRows: CaptureHidRow[];
  contentInstallSql: string;
  contentUninstallSql: string;
  contentBlobs: CaptureSeedBlob[];
  vocabRowCount: number;
  contentRowCount: number;
  tables: string[];
  warnings: string[];
};

export async function captureCmsModule(input: {
  dataSourceId: string;
  includeOptionalRecords?: boolean;
}): Promise<CaptureCmsModuleResult> {
  const { data, response } = await apiPost<{
    success?: boolean;
    error?: string;
    schemaInstallSql?: string;
    schemaUninstallSql?: string;
    vocabInstallSql?: string;
    vocabUninstallSql?: string;
    vocabHidRows?: CaptureHidRow[];
    contentInstallSql?: string;
    contentUninstallSql?: string;
    contentBlobs?: CaptureSeedBlob[];
    vocabRowCount?: number;
    contentRowCount?: number;
    tables?: string[];
    warnings?: string[];
  }>('/api/packages/builder/db-capture/cms-module', input);

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || 'Failed to pack the CMS module.');
  }

  return {
    schemaInstallSql: data.schemaInstallSql ?? '',
    schemaUninstallSql: data.schemaUninstallSql ?? '',
    vocabInstallSql: data.vocabInstallSql ?? '',
    vocabUninstallSql: data.vocabUninstallSql ?? '',
    vocabHidRows: data.vocabHidRows ?? [],
    contentInstallSql: data.contentInstallSql ?? '',
    contentUninstallSql: data.contentUninstallSql ?? '',
    contentBlobs: data.contentBlobs ?? [],
    vocabRowCount: data.vocabRowCount ?? 0,
    contentRowCount: data.contentRowCount ?? 0,
    tables: data.tables ?? [],
    warnings: data.warnings ?? [],
  };
}
