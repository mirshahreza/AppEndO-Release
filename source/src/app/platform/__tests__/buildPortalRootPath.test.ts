import { describe, expect, it } from 'vitest';
import { STUDIO_PORTAL_SEGMENT, ROOT_PORTAL_SEGMENT } from '../../../shared/api/contracts/platform/mountConstants';
import { buildPortalRootPath } from '../platformConfigHelpers';

describe('buildPortalRootPath', () => {
  it('maps home application to mount root', () => {
    expect(buildPortalRootPath('/studio', ROOT_PORTAL_SEGMENT)).toBe('/studio');
    expect(buildPortalRootPath('/us', ROOT_PORTAL_SEGMENT)).toBe('/us');
  });

  it('maps studio application on studio mount to mount root', () => {
    expect(buildPortalRootPath('/studio', STUDIO_PORTAL_SEGMENT)).toBe('/studio');
    expect(buildPortalRootPath('/studio', 'studio')).toBe('/studio');
  });

  it('maps studio application on culture mount to culture studio path', () => {
    expect(buildPortalRootPath('/us', STUDIO_PORTAL_SEGMENT)).toBe('/us/studio');
    expect(buildPortalRootPath('/ir', 'studio')).toBe('/ir/studio');
  });

  it('maps non-studio portal segments under mount prefix', () => {
    expect(buildPortalRootPath('/us', 'designer')).toBe('/us/designer');
    expect(buildPortalRootPath('/studio', 'designer')).toBe('/studio/designer');
  });
});
