import { describe, expect, it } from 'vitest';
import {
  appendPackageLibrariesFieldErrors,
  isCoreLibraryPackage,
  isCoreLibrarySpecifier,
  isNpmPackageName,
  libraryVersionSatisfies,
} from '../developerLibraries';

describe('developerLibraries', () => {
  it('treats locked platform packages as core', () => {
    expect(isCoreLibraryPackage('react')).toBe(true);
    expect(isCoreLibraryPackage('xlsx')).toBe(false);
    expect(isCoreLibrarySpecifier('react/jsx-runtime')).toBe(true);
    expect(isCoreLibrarySpecifier('xlsx')).toBe(false);
  });

  it('accepts scoped npm names', () => {
    expect(isNpmPackageName('@heroui/react')).toBe(true);
    expect(isNpmPackageName('xlsx')).toBe(true);
    expect(isNpmPackageName('React')).toBe(false);
  });

  it('satisfies caret, tilde, and exact ranges', () => {
    expect(libraryVersionSatisfies('0.18.5', '^0.18.0')).toBe(true);
    expect(libraryVersionSatisfies('1.0.0', '^0.18.0')).toBe(false);
    expect(libraryVersionSatisfies('0.18.9', '~0.18.5')).toBe(true);
    expect(libraryVersionSatisfies('0.19.0', '~0.18.5')).toBe(false);
    expect(libraryVersionSatisfies('0.18.5', '0.18.5')).toBe(true);
    expect(libraryVersionSatisfies('0.18.5')).toBe(true);
  });

  it('reports duplicate library names', () => {
    const errors: string[] = [];
    appendPackageLibrariesFieldErrors(
      [{ name: 'xlsx' }, { name: 'xlsx', versionRange: '^0.18.5' }],
      errors,
    );
    expect(errors.some((item) => item.includes('duplicated'))).toBe(true);
  });
});
