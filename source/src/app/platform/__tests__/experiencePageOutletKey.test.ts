import { describe, expect, it } from 'vitest';
import {
  resolveExperiencePageOutletKey,
  resolveShellFormattedRevealResetKey,
} from '../experiencePageOutletKey';

describe('experiencePageOutletKey', () => {
  it('keeps a stable outlet key across dossier section pathnames', () => {
    const pageKey = 'hwy-member-dossier-view';
    const a = resolveExperiencePageOutletKey(pageKey, '/iq/hawiety/members-all/view/852317/files');
    const b = resolveExperiencePageOutletKey(pageKey, '/iq/hawiety/members-all/view/852317/kasb');
    expect(a).toBe(b);
    expect(a).toBe(`${pageKey}:member-dossier:view:852317`);
  });

  it('varies outlet key across members and modes', () => {
    const pageKey = 'hwy-member-dossier-view';
    expect(
      resolveExperiencePageOutletKey(pageKey, '/iq/hawiety/members-all/view/1/kasb'),
    ).not.toBe(
      resolveExperiencePageOutletKey(pageKey, '/iq/hawiety/members-all/view/2/kasb'),
    );
    expect(
      resolveExperiencePageOutletKey('hwy-member-dossier-view', '/iq/hawiety/members-all/view/42'),
    ).not.toBe(
      resolveExperiencePageOutletKey('hwy-member-dossier-edit', '/iq/hawiety/members-all/edit/42'),
    );
  });

  it('uses pathname for non-dossier routes', () => {
    expect(resolveExperiencePageOutletKey('users', '/iq/studio/users')).toBe('users:/iq/studio/users');
  });

  it('stabilizes shell reveal reset key for dossier section swaps', () => {
    expect(
      resolveShellFormattedRevealResetKey('/iq/hawiety/members-all/view/99/notes'),
    ).toBe(
      resolveShellFormattedRevealResetKey('/iq/hawiety/members-all/view/99/kasb'),
    );
  });
});
