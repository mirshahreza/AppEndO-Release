import { describe, expect, it } from 'vitest';
import {
  isClientComponentEditSlug,
  resolvePackagePageKeyToEditSlug,
} from '../clientComponentEditSlug';

describe('clientComponentEditSlug', () => {
  it('rejects package loader ref shapes', () => {
    expect(isClientComponentEditSlug('portalx:extx-member-dossier-view')).toBe(false);
  });

  it('maps dossier view/edit routes to one layout slug', () => {
    expect(resolvePackagePageKeyToEditSlug('extx-member-dossier-view')).toBe('member-dossier');
    expect(resolvePackagePageKeyToEditSlug('extx-member-dossier-edit')).toBe('member-dossier');
    expect(resolvePackagePageKeyToEditSlug('extx-targhin-requests')).toBe('targhin-requests');
  });
});
