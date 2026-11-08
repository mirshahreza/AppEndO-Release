import { describe, expect, it } from 'vitest';
import {
  evaluatePageEditLockForFile,
  extractExplicitPageKeysFromPrompt,
  isOperatorPageEditLockMetaPath,
} from '../operatorPageEditLock';
import type { PageEditLockManifest } from '../operatorPageEditLock';

const sampleManifest: PageEditLockManifest = {
  version: '1',
  generatedAt: '2026-11-04T00:00:00.000Z',
  policy: 'all-locked',
  pageCount: 2,
  pages: [
    {
      pageKey: 'users',
      label: 'Users',
      routePattern: 'users',
      searchRoots: ['src/features/users'],
      source: 'feature-graph',
    },
    {
      pageKey: 'hwy-geo-responsibility-candidate-interview',
      label: 'Interview pipeline',
      routePattern: 'candidate-pipeline/interview',
      searchRoots: ['src/features/hwy-geo-responsibility'],
      source: 'package-ui',
    },
  ],
};

describe('operatorPageEditLock', () => {
  it('detects explicit page keys in operator prompt', () => {
    const keys = extractExplicitPageKeysFromPrompt(
      'Please fix pageKey users grid sorting',
      sampleManifest,
    );
    expect(keys).toContain('users');
  });

  it('locks page-scoped files until prompt names the page', () => {
    const locked = evaluatePageEditLockForFile({
      filePath: 'src/features/users/UsersPage.tsx',
      promptText: 'fix hwy interview pipeline',
      manifest: sampleManifest,
    });
    expect(locked.locked).toBe(true);
    expect(locked.pageKey).toBe('users');

    const unlocked = evaluatePageEditLockForFile({
      filePath: 'src/features/users/UsersPage.tsx',
      promptText: 'fix the users page grid',
      manifest: sampleManifest,
    });
    expect(unlocked.locked).toBe(false);
    expect(unlocked.reason).toBe('explicit-in-prompt');
  });

  it('allows lock metadata paths', () => {
    expect(isOperatorPageEditLockMetaPath('src/config/operatorPageEditLocks.ts')).toBe(true);
  });
});
