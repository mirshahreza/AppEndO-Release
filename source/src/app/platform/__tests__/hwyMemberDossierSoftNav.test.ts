import { describe, expect, it } from 'vitest';
import { isHwyMemberDossierSoftNavigation } from '../hwyMemberDossierSoftNav';
import { isShellSoftNavigation } from '../shellSoftNavigation';

describe('hwyMemberDossierSoftNav', () => {
  it('soft-nav when the same member dossier section changes in view mode', () => {
    expect(isHwyMemberDossierSoftNavigation(
      '/iq/hawiety/members-all/view/852317',
      '/iq/hawiety/members-all/view/852317/kasb',
    )).toBe(true);
    expect(isHwyMemberDossierSoftNavigation(
      '/iq/hawiety/members-all/view/852317/files',
      '/iq/hawiety/members-all/view/852317/notes',
    )).toBe(true);
  });

  it('soft-nav when the same member dossier section changes in edit mode', () => {
    expect(isHwyMemberDossierSoftNavigation(
      '/iq/hawiety/members-all/edit/42',
      '/iq/hawiety/members-all/edit/42/files',
    )).toBe(true);
  });

  it('does not soft-nav across members, modes, or leaving the dossier', () => {
    expect(isHwyMemberDossierSoftNavigation(
      '/iq/hawiety/members-all/view/1/kasb',
      '/iq/hawiety/members-all/view/2/kasb',
    )).toBe(false);
    expect(isHwyMemberDossierSoftNavigation(
      '/iq/hawiety/members-all/view/42',
      '/iq/hawiety/members-all/edit/42',
    )).toBe(false);
    expect(isHwyMemberDossierSoftNavigation(
      '/iq/hawiety/members-all',
      '/iq/hawiety/members-all/view/42',
    )).toBe(false);
  });

  it('is included in shell soft navigation', () => {
    expect(isShellSoftNavigation(
      '/iq/hawiety/members-all/view/99/notes',
      '/iq/hawiety/members-all/view/99/kasb',
    )).toBe(true);
  });
});
