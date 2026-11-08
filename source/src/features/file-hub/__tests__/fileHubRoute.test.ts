import { describe, expect, it } from 'vitest';
import type { FileHubConnectionPublic } from '../../../shared/api/contracts/file-hub/types';
import {
  buildFileHubEditRelativePath,
  buildFileHubListRelativePath,
  findFileHubConnectionByEditSlug,
  parseFileHubEditSlug,
  resolveFileHubItemLabelFromEditSlug,
} from '../fileHubRoute';

const sample: FileHubConnectionPublic = {
  id: 'conn-1',
  key: 'edge-files',
  name: 'Edge Files',
  protocol: 'sftp',
  host: '10.0.0.12',
  port: 22,
  username: 'deploy',
  authMethod: 'password',
  hasPassword: true,
  hasPrivateKey: false,
  hasPassphrase: false,
  initialPath: '/var/www',
  tags: [],
  note: '',
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  createdBy: 'admin',
  updatedBy: 'admin',
};

describe('fileHubRoute', () => {
  it('builds list and edit deep links', () => {
    expect(buildFileHubListRelativePath()).toBe('sftp');
    expect(buildFileHubEditRelativePath(sample)).toBe('sftp/edit/edge-files');
  });

  it('parses edit slugs from nested suffixes', () => {
    expect(parseFileHubEditSlug('studio/file-hub/edit/edge-files')).toBe('edge-files');
    expect(parseFileHubEditSlug('studio/sftp/edit/edge-files')).toBe('edge-files');
    expect(parseFileHubEditSlug('edit/edge-files')).toBe('edge-files');
    expect(parseFileHubEditSlug('file-hub')).toBeNull();
    expect(parseFileHubEditSlug('sftp')).toBeNull();
    expect(findFileHubConnectionByEditSlug([sample], 'edge-files')?.id).toBe('conn-1');
    expect(resolveFileHubItemLabelFromEditSlug('edge-files')).toBe('edge-files');
  });
});
