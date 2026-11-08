import { describe, expect, it } from 'vitest';
import {
  draftCompanionTsxPath,
  draftExportFilePath,
  draftJsonPath,
  draftSnapshotDirectory,
  sanitizeComponentFileBaseName,
  sanitizeDraftFolderName,
} from '../draftFolderPaths';

describe('draftFolderPaths', () => {
  it('sanitizes folder names for cross-platform filesystem safety', () => {
    expect(sanitizeDraftFolderName('Dashboard Widgets')).toBe('dashboard-widgets');
    expect(sanitizeDraftFolderName('Forms: Sales/Reports *draft*')).toBe('forms-salesreports-draft');
    expect(sanitizeDraftFolderName('')).toBe('general');
    expect(sanitizeDraftFolderName('   ')).toBe('general');
  });

  it('sanitizes component names for filesystem-safe draft artifacts', () => {
    expect(sanitizeComponentFileBaseName('Customer Summary')).toBe('Customer-Summary');
    expect(sanitizeComponentFileBaseName('Widget: Sales/Report *draft*')).toBe('Widget-SalesReport-draft');
  });

  it('builds every draft path under the general folder', () => {
    expect(draftJsonPath('test1', 'erfan')).toMatch(/drafts[\\/]+general[\\/]+test1\.json$/);
    expect(draftCompanionTsxPath('Customer Summary', 'landing')).toMatch(/drafts[\\/]+general[\\/]+Customer-Summary\.tsx$/);
    expect(draftExportFilePath('Widget.tsx', 'landing')).toMatch(/exports[\\/]+general[\\/]+Widget\.tsx$/);
    expect(draftSnapshotDirectory('draft-abc', 'landing')).toMatch(/snapshots[\\/]+general[\\/]+draft-abc$/);
  });
});
