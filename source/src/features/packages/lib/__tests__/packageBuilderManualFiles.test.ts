import { describe, expect, it } from 'vitest';
import { createPackageBuilderManualFiles } from '../packageBuilderManualFiles';
import {
  packageWorkspaceAssetUrlToRelativePath,
  toPackageWorkspaceAssetEntry,
  toPackageWorkspaceAssetUrl,
} from '../../../../shared/lib/packageWorkspaceAssets';

describe('package workspace asset paths', () => {
  it('maps workspace relative paths to url and package entry', () => {
    expect(toPackageWorkspaceAssetUrl('brand/logo.png')).toBe('/assets/workspace/brand/logo.png');
    expect(toPackageWorkspaceAssetEntry('brand/logo.png')).toBe('assets/workspace/brand/logo.png');
    expect(packageWorkspaceAssetUrlToRelativePath('/assets/workspace/brand/logo.png')).toBe('brand/logo.png');
  });
});

describe('createPackageBuilderManualFiles', () => {
  it('creates manual file records from workspace paths', () => {
    const files = createPackageBuilderManualFiles(['logo.png'], []);
    expect(files).toEqual([{
      id: expect.any(String),
      workspacePath: 'logo.png',
      fileName: 'logo.png',
      entryPath: 'assets/workspace/logo.png',
    }]);
  });
});
