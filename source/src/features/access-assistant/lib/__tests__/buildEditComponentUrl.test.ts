import { describe, expect, it } from 'vitest';
import {
  buildEditComponentUrl,
  isClientComponentEditSlug,
  resolveStudioMountPrefix,
} from '../buildEditComponentUrl';

describe('buildEditComponentUrl', () => {
  it('resolves studio mount prefix from culture paths', () => {
    expect(resolveStudioMountPrefix('/iq/studio/hawiety/members-all/view/1')).toBe('/iq/studio');
  });

  it('builds a canonical edit URL for designer slugs', () => {
    expect(buildEditComponentUrl('/iq/studio/hwy-members-all', 'hwy-members-all')).toBe(
      '/iq/studio/client-components/edit/hwy-members-all',
    );
  });

  it('rejects package loader refs masquerading as component slugs', () => {
    expect(isClientComponentEditSlug('hawiety:hwy-member-dossier-view')).toBe(false);
    expect(buildEditComponentUrl('/iq/studio', 'hawiety:hwy-member-dossier-view')).toBeNull();
  });
});
