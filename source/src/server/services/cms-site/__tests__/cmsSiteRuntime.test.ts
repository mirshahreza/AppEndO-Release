import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../domain/package-domain/installStateRepository', () => ({
  isPluginRuntimeEnabled: vi.fn(),
}));

import { isPluginRuntimeEnabled } from '../../../domain/package-domain/installStateRepository';
import { isCmsRuntimeEnabled, requireCmsPackage } from '../cmsSiteRuntime';

describe('CMS public site runtime gate', () => {
  it('404s APIs when the CMS package is not installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(false);
    expect(isCmsRuntimeEnabled()).toBe(false);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    requireCmsPackage({} as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when the CMS package is installed', () => {
    vi.mocked(isPluginRuntimeEnabled).mockReturnValue(true);
    expect(isCmsRuntimeEnabled()).toBe(true);
    const next = vi.fn();
    requireCmsPackage({} as never, { status: vi.fn(), json: vi.fn() } as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
