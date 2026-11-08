import { describe, expect, it } from 'vitest';
import {
  isClientComponentEditSlug,
  resolvePackagePageKeyToEditSlug,
} from '../clientComponentEditSlug';

describe('clientComponentEditSlug', () => {
  it('rejects package loader ref shapes', () => {
    expect(isClientComponentEditSlug('hawiety:hwy-member-dossier-view')).toBe(false);
  });

  it('maps dossier view/edit routes to one layout slug', () => {
    expect(resolvePackagePageKeyToEditSlug('hwy-member-dossier-view')).toBe('member-dossier');
    expect(resolvePackagePageKeyToEditSlug('hwy-member-dossier-edit')).toBe('member-dossier');
    expect(resolvePackagePageKeyToEditSlug('hwy-targhin-requests')).toBe('targhin-requests');
  });
});
