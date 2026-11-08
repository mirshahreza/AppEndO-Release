import { describe, expect, it, vi } from 'vitest';

const listPageModuleFiles = vi.fn();
vi.mock('../../../../core/platform-registry/PlatformRegistryFileStore', () => ({
  listPageModuleFiles: () => listPageModuleFiles(),
}));

import { resolveAccessAssistantEligibility } from '../accessAssistant.service';

describe('resolveAccessAssistantEligibility — edit component', () => {
  it('enables edit for designer pages with a pinned component path', () => {
    listPageModuleFiles.mockReturnValue([
      {
        pageKey: 'vx-members-all',
        loaderKind: 'designer',
        loaderRef: 'general/vx-members-all@v39',
      },
    ]);

    const result = resolveAccessAssistantEligibility('vx-members-all');
    expect(result.editComponent).toEqual({
      enabled: true,
      componentSlug: 'vx-members-all',
    });
  });

  it('enables edit for package pages using the shared Client Components slug', () => {
    listPageModuleFiles.mockReturnValue([
      {
        pageKey: 'vx-member-dossier-view',
        loaderKind: 'package',
        loaderRef: 'vertical:vx-member-dossier-view',
      },
    ]);

    const result = resolveAccessAssistantEligibility('vx-member-dossier-view');
    expect(result.editComponent).toEqual({
      enabled: true,
      componentSlug: 'member-dossier',
    });
  });

  it('disables edit for core modules', () => {
    listPageModuleFiles.mockReturnValue([
      {
        pageKey: 'users',
        loaderKind: 'core',
        loaderRef: 'users',
      },
    ]);

    const result = resolveAccessAssistantEligibility('users');
    expect(result.editComponent).toEqual({
      enabled: false,
      reason: 'Core module — edit in codebase.',
    });
  });
});
