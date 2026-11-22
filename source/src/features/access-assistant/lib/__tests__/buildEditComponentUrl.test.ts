import { describe, expect, it } from 'vitest';
import {
  buildEditComponentUrl,
  isClientComponentEditSlug,
  resolveStudioMountPrefix,
} from '../buildEditComponentUrl';

describe('buildEditComponentUrl', () => {
  it('resolves studio mount prefix from culture paths', () => {
    expect(resolveStudioMountPrefix('/iq/studio/portalx/members-all/view/1')).toBe('/iq/studio');
  });

  it('builds a canonical edit URL for designer slugs', () => {
    expect(buildEditComponentUrl('/iq/studio/extx-members-all', 'extx-members-all')).toBe(
      '/iq/studio/client-components/edit/extx-members-all',
    );
  });

  it('rejects package loader refs masquerading as component slugs', () => {
    expect(isClientComponentEditSlug('portalx:extx-member-dossier-view')).toBe(false);
    expect(buildEditComponentUrl('/iq/studio', 'portalx:extx-member-dossier-view')).toBeNull();
  });
});
