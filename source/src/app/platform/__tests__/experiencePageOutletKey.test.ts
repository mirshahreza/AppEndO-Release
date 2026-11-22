import { describe, expect, it } from 'vitest';
import {
  resolveExperiencePageOutletKey,
  resolveShellFormattedRevealResetKey,
} from '../experiencePageOutletKey';

describe('experiencePageOutletKey', () => {
  it('keeps a stable outlet key across dossier section pathnames', () => {
    const pageKey = 'extx-member-dossier-view';
    const a = resolveExperiencePageOutletKey(pageKey, '/iq/portalx/members-all/view/852317/files');
    const b = resolveExperiencePageOutletKey(pageKey, '/iq/portalx/members-all/view/852317/kasb');
    expect(a).toBe(b);
    expect(a).toBe(`${pageKey}:member-dossier:view:852317`);
  });

  it('varies outlet key across members and modes', () => {
    const pageKey = 'extx-member-dossier-view';
    expect(
      resolveExperiencePageOutletKey(pageKey, '/iq/portalx/members-all/view/1/kasb'),
    ).not.toBe(
      resolveExperiencePageOutletKey(pageKey, '/iq/portalx/members-all/view/2/kasb'),
    );
    expect(
      resolveExperiencePageOutletKey('extx-member-dossier-view', '/iq/portalx/members-all/view/42'),
    ).not.toBe(
      resolveExperiencePageOutletKey('extx-member-dossier-edit', '/iq/portalx/members-all/edit/42'),
    );
  });

  it('uses pathname for non-dossier routes', () => {
    expect(resolveExperiencePageOutletKey('users', '/iq/studio/users')).toBe('users:/iq/studio/users');
  });

  it('stabilizes shell reveal reset key for dossier section swaps', () => {
    expect(
      resolveShellFormattedRevealResetKey('/iq/portalx/members-all/view/99/notes'),
    ).toBe(
      resolveShellFormattedRevealResetKey('/iq/portalx/members-all/view/99/kasb'),
    );
  });
});
