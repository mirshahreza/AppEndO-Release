import type { ExecuteDataSourceQueryResult } from '../../shared/api/contracts/data-sources/executeQuery';

const isRecordRow = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export function getSqlConsoleResultRecords(
  result: ExecuteDataSourceQueryResult | null,
): Record<string, unknown>[] {
  if (!result?.data?.length) {
    return [];
  }
  return result.data.filter(isRecordRow);
}

export function sqlConsoleResultExportFilename(tabName: string): string {
  const trimmed = tabName.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  return trimmed.length > 0 ? trimmed : 'query-results';
}
