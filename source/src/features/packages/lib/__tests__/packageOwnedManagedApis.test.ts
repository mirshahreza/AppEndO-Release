/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  isManagedApiCoveredByPackage,
  managedApiPathMatchesEdgeBasePath,
} from '../packageOwnedManagedApis';

describe('packageOwnedManagedApis', () => {
  it('matches Data API list and item paths to a packed Edge API base path', () => {
    expect(managedApiPathMatchesEdgeBasePath('/api/cms/contents', '/api/cms/contents')).toBe(true);
    expect(managedApiPathMatchesEdgeBasePath('/api/cms/contents/:pk', '/api/cms/contents')).toBe(true);
    expect(managedApiPathMatchesEdgeBasePath('/api/cms/contents-extra', '/api/cms/contents')).toBe(false);
    expect(managedApiPathMatchesEdgeBasePath('/api/cms-site/public', '/api/cms/contents')).toBe(false);
  });

  it('treats packed Edge API operations as already in the package', () => {
    const packed = {
      existingApis: [] as Array<{ id: string; path: string }>,
      packedEdgeApiBasePaths: ['/api/cms/contents', '/api/cms/tags'],
    };
    expect(isManagedApiCoveredByPackage(
      { id: 'cms-contents.cms-contents-list', path: '/api/cms/contents' },
      packed,
    )).toBe(true);
    expect(isManagedApiCoveredByPackage(
      { id: 'cms-contents.cms-contents-getone', path: '/api/cms/contents/:pk' },
      packed,
    )).toBe(true);
    expect(isManagedApiCoveredByPackage(
      { id: 'other.health', path: '/api/other/health' },
      packed,
    )).toBe(false);
  });

  it('matches packed capabilities.apis by id or path', () => {
    const packed = {
      existingApis: [{ id: 'get-demo-health-1', path: '/api/demo/health' }],
      packedEdgeApiBasePaths: [] as string[],
    };
    expect(isManagedApiCoveredByPackage(
      { id: 'get-demo-health-1', path: '/api/demo/health' },
      packed,
    )).toBe(true);
    expect(isManagedApiCoveredByPackage(
      { id: 'fn-live-id', path: '/api/demo/health' },
      packed,
    )).toBe(true);
  });
});
