import type { CaptureCmsModuleResult } from './packageDbCaptureClient';

export function joinCapturedSqlParts(...parts: Array<string | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter(Boolean).join('\n\n');
}

export function cmsModuleCaptureSummary(result: CaptureCmsModuleResult): string {
  const pieces = [
    result.schemaInstallSql.trim() ? 'schema' : null,
    result.vocabRowCount > 0 ? `${result.vocabRowCount} vocab row(s)` : null,
    result.contentRowCount > 0 ? `${result.contentRowCount} content row(s)` : null,
    result.contentBlobs.length > 0 ? `${result.contentBlobs.length} file(s)` : null,
  ].filter(Boolean);
  const warningNote = result.warnings[0] ? ` · ${result.warnings[0]}` : '';
  if (pieces.length === 0) {
    return `No CMS schema or rows were packed${warningNote}.`;
  }
  return `Packed CMS ${pieces.join(' · ')}${warningNote}.`;
}
