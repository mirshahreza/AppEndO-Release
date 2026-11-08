import { describe, expect, it } from 'vitest';
import { apiPathFromResourceUrl, isHttpApiRequestPath } from '../httpApiPath';

describe('httpApiPath', () => {
  it('accepts real API paths only', () => {
    expect(isHttpApiRequestPath('/api/boot')).toBe(true);
    expect(isHttpApiRequestPath('/api/data-api/models')).toBe(true);
    expect(isHttpApiRequestPath('/src/shared/api/client.ts')).toBe(false);
    expect(isHttpApiRequestPath('/src/shared/api/queries/pwa.ts')).toBe(false);
  });

  it('ignores Vite module URLs that contain /api/ in the path segment', () => {
    expect(apiPathFromResourceUrl('http://127.0.0.1:3000/src/shared/api/client.ts')).toBeNull();
    expect(apiPathFromResourceUrl('http://127.0.0.1:3000/api/boot')).toBe('/api/boot');
  });
});
