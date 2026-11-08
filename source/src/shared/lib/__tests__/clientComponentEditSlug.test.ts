import { describe, expect, it } from 'vitest';
import {
  isClientComponentEditSlug,
  resolvePackagePageKeyToEditSlug,
} from '../clientComponentEditSlug';

describe('clientComponentEditSlug', () => {
  it('rejects package loader ref shapes', () => {
    expect(isClientComponentEditSlug('vertical:vx-member-dossier-view')).toBe(false);
  });

  it('maps dossier view/edit routes to one layout slug', () => {
    expect(resolvePackagePageKeyToEditSlug('vx-member-dossier-view')).toBe('member-dossier');
    expect(resolvePackagePageKeyToEditSlug('vx-member-dossier-edit')).toBe('member-dossier');
    expect(resolvePackagePageKeyToEditSlug('vx-targhin-requests')).toBe('targhin-requests');
  });
});
