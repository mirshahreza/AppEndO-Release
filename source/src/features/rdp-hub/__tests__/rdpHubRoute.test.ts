import { describe, expect, it } from 'vitest';
import type { RdpHubConnectionPublic } from '../../../shared/api/contracts/rdp-hub/types';
import {
  buildRdpHubEditRelativePath,
  buildRdpHubListRelativePath,
  findRdpHubConnectionByEditSlug,
  parseRdpHubEditSlug,
  resolveRdpHubItemLabelFromEditSlug,
} from '../rdpHubRoute';

const sample: RdpHubConnectionPublic = {
  id: 'conn-1',
  key: 'win-jump',
  name: 'Win Jump',
  host: '10.0.0.20',
  port: 3389,
  username: 'Administrator',
  domain: 'CORP',
  security: 'nla',
  ignoreCert: true,
  hasPassword: true,
  tags: [],
  note: '',
  createdAt: '2026-08-14T00:00:00.000Z',
  updatedAt: '2026-08-14T00:00:00.000Z',
  createdBy: 'admin',
  updatedBy: 'admin',
};

describe('rdpHubRoute', () => {
  it('builds list and edit deep links', () => {
    expect(buildRdpHubListRelativePath()).toBe('rdp');
    expect(buildRdpHubEditRelativePath(sample)).toBe('rdp/edit/win-jump');
  });

  it('parses edit slugs from nested suffixes', () => {
    expect(parseRdpHubEditSlug('studio/rdp-hub/edit/win-jump')).toBe('win-jump');
    expect(parseRdpHubEditSlug('studio/rdp/edit/win-jump')).toBe('win-jump');
    expect(parseRdpHubEditSlug('edit/win-jump')).toBe('win-jump');
    expect(parseRdpHubEditSlug('rdp-hub')).toBeNull();
    expect(parseRdpHubEditSlug('rdp')).toBeNull();
    expect(findRdpHubConnectionByEditSlug([sample], 'win-jump')?.id).toBe('conn-1');
    expect(resolveRdpHubItemLabelFromEditSlug('win-jump')).toBe('win-jump');
  });
});
