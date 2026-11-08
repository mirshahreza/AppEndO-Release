import { describe, expect, it } from 'vitest';
import type { SshHubConnectionPublic } from '../../../shared/api/contracts/ssh-hub/types';
import {
  buildSshHubEditRelativePath,
  buildSshHubListRelativePath,
  findSshHubConnectionByEditSlug,
  parseSshHubEditSlug,
  resolveSshHubItemLabelFromEditSlug,
  shouldLeaveSshHubEditor,
} from '../sshHubRoute';

const sample: SshHubConnectionPublic = {
  id: 'conn-1',
  key: 'edge-db',
  name: 'Edge DB',
  host: '10.0.0.12',
  port: 22,
  username: 'deploy',
  authMethod: 'password',
  hasPassword: true,
  hasPrivateKey: false,
  hasPassphrase: false,
  initialPath: '',
  tags: [],
  note: '',
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  createdBy: 'admin',
  updatedBy: 'admin',
};

describe('sshHubRoute', () => {
  it('builds list and edit deep links', () => {
    expect(buildSshHubListRelativePath()).toBe('ssh');
    expect(buildSshHubEditRelativePath(sample)).toBe('ssh/edit/edge-db');
  });

  it('parses edit slugs from nested suffixes', () => {
    expect(parseSshHubEditSlug('studio/ssh-hub/edit/edge-db')).toBe('edge-db');
    expect(parseSshHubEditSlug('studio/ssh/edit/edge-db')).toBe('edge-db');
    expect(parseSshHubEditSlug('edit/edge-db')).toBe('edge-db');
    expect(parseSshHubEditSlug('ssh-hub')).toBeNull();
    expect(parseSshHubEditSlug('ssh')).toBeNull();
    expect(findSshHubConnectionByEditSlug([sample], 'edge-db')?.id).toBe('conn-1');
    expect(resolveSshHubItemLabelFromEditSlug('edge-db')).toBe('edge-db');
  });

  it('does not leave the editor while the catalog is still loading', () => {
    expect(shouldLeaveSshHubEditor({
      editSlug: 'hwy',
      isCatalogPending: true,
      connections: [],
    })).toBe(false);
    expect(shouldLeaveSshHubEditor({
      editSlug: 'hwy',
      isCatalogPending: false,
      connections: [],
    })).toBe(true);
    expect(shouldLeaveSshHubEditor({
      editSlug: 'edge-db',
      isCatalogPending: false,
      connections: [sample],
    })).toBe(false);
  });
});
