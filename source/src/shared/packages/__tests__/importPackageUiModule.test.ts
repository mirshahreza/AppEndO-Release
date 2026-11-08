import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { importPackageUiModule } from '../importPackageUiModule';

describe('importPackageUiModule', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('throws the API error body instead of Vite import failures', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'UI module "general/cms-vocab-languages" is not registered for package "cms".' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(importPackageUiModule('/api/packages/cms/ui/general/cms-vocab-languages')).rejects.toThrow(
      'UI module "general/cms-vocab-languages" is not registered for package "cms".',
    );
    expect(fetch).toHaveBeenCalledWith(
      '/api/packages/cms/ui/general/cms-vocab-languages',
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
