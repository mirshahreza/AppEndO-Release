import { describe, expect, it } from 'vitest';
import {
  buildEditComponentUrl,
  isClientComponentEditSlug,
  resolveStudioMountPrefix,
} from '../buildEditComponentUrl';

describe('buildEditComponentUrl', () => {
  it('resolves studio mount prefix from culture paths', () => {
    expect(resolveStudioMountPrefix('/iq/studio/vertical/members-all/view/1')).toBe('/iq/studio');
  });

  it('builds a canonical edit URL for designer slugs', () => {
    expect(buildEditComponentUrl('/iq/studio/vx-members-all', 'vx-members-all')).toBe(
      '/iq/studio/client-components/edit/vx-members-all',
    );
  });

  it('rejects package loader refs masquerading as component slugs', () => {
    expect(isClientComponentEditSlug('vertical:vx-member-dossier-view')).toBe(false);
    expect(buildEditComponentUrl('/iq/studio', 'vertical:vx-member-dossier-view')).toBeNull();
  });
});
