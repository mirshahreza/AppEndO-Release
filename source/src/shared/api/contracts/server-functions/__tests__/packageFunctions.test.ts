import { describe, expect, it } from 'vitest';
import { isPackageServerFunction } from '../packageFunctions';

describe('isPackageServerFunction', () => {
  it('detects package API catalog entries by id prefix', () => {
    expect(isPackageServerFunction({
      id: 'pkg-api-pkg-test-get-test-1',
      folder: 'packages/pkg-test',
    })).toBe(true);
  });

  it('detects package API catalog entries by folder prefix', () => {
    expect(isPackageServerFunction({
      id: 'custom-id',
      folder: 'packages/demo-pack',
    })).toBe(true);
  });

  it('returns false for platform built-ins', () => {
    expect(isPackageServerFunction({
      id: 'sys-get-api-users',
      folder: 'users',
    })).toBe(false);
  });
});
