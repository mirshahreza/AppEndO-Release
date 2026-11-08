import { describe, expect, it } from 'vitest';
import { buildRemoteHubEditRelativePath } from '../remoteHubDeepLink';

describe('remoteHubDeepLink', () => {
  it('builds nested editor paths for each hub', () => {
    expect(buildRemoteHubEditRelativePath('ssh-hub', 'edge-db')).toBe('ssh/edit/edge-db');
    expect(buildRemoteHubEditRelativePath('file-hub', 'prod-sftp')).toBe('sftp/edit/prod-sftp');
    expect(buildRemoteHubEditRelativePath('rdp-hub', 'win-box')).toBe('rdp/edit/win-box');
  });
});
