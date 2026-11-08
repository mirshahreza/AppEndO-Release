import { describe, expect, it } from 'vitest';
import { BASE_COMPONENTS_NAV_LANDING_SECTION } from '../../../shared/api/contracts/platform/mountConstants';
import {
  BASE_COMPONENTS_NAV_SECTIONS,
  BASE_COMPONENTS_SECTIONS,
  getBaseComponentsSectionGuideHint,
} from '../baseComponentsSections';
import {
  buildBaseComponentsSectionRelativePath,
  DEFAULT_BASE_COMPONENTS_SECTION,
  parseBaseComponentsSectionSlug,
  resolveBaseComponentsRouteSuffix,
  resolveBaseComponentsSectionFromPathSuffix,
} from '../baseComponentsRoute';

describe('baseComponentsRoute', () => {
  it('registers the approved general, shell, and Creative sections', () => {
    const sectionIds = BASE_COMPONENTS_SECTIONS.map((section) => section.id);
    expect(sectionIds).toEqual(expect.arrayContaining([
      'accordion-disclosure',
      'popover-tooltip',
      'where-builder',
      'date-time',
      'file-media-input',
      'loading-error-empty',
      'shell-foundation',
      'shell-navigation',
      'shell-effects',
      'landing-widgets',
      'motion-behaviors',
      'creative-scenes',
      'visual-engines',
      'transfer-list',
      'component-layout',
      'dock-pane',
      'client-component',
      'map',
      'codes',
      'media-players',
      'spreadsheet',
      'crud-set',
      'edit-view',
    ]));
    expect(BASE_COMPONENTS_SECTIONS).toHaveLength(133);
  });

  it('gives every catalog section a page-guide header hint', () => {
    for (const section of BASE_COMPONENTS_SECTIONS) {
      const hint = getBaseComponentsSectionGuideHint(section.id);
      expect(hint.length).toBeGreaterThan(24);
      expect(hint.toLowerCase()).not.toBe(section.label.toLowerCase());
    }
  });

  it('parses known section slugs case-insensitively', () => {
    for (const section of BASE_COMPONENTS_SECTIONS) {
      expect(parseBaseComponentsSectionSlug(section.id)).toBe(section.id);
      expect(parseBaseComponentsSectionSlug(section.id.toUpperCase())).toBe(section.id);
    }
  });

  it('rejects unknown section slugs', () => {
    expect(parseBaseComponentsSectionSlug('missing')).toBeNull();
    expect(parseBaseComponentsSectionSlug('')).toBeNull();
  });

  it('aliases the retired form-fields slug to text-fields', () => {
    expect(parseBaseComponentsSectionSlug('form-fields')).toBe('text-fields');
    expect(parseBaseComponentsSectionSlug('FORM-FIELDS')).toBe('text-fields');
  });

  it('aliases the retired grid-paging slug to grid', () => {
    expect(parseBaseComponentsSectionSlug('grid-paging')).toBe('grid');
    expect(parseBaseComponentsSectionSlug('GRID-PAGING')).toBe('grid');
  });

  it('resolves the default section when the path suffix is empty', () => {
    expect(DEFAULT_BASE_COMPONENTS_SECTION).toBe(BASE_COMPONENTS_NAV_SECTIONS[0]?.id);
    expect(DEFAULT_BASE_COMPONENTS_SECTION).toBe(BASE_COMPONENTS_NAV_LANDING_SECTION);
    expect(resolveBaseComponentsSectionFromPathSuffix(undefined)).toBe('crud-set');
    expect(resolveBaseComponentsSectionFromPathSuffix('')).toBe('crud-set');
  });

  it('strips application and base-components route prefixes from splat suffixes', () => {
    expect(resolveBaseComponentsRouteSuffix('studio/base-components')).toBeUndefined();
    expect(resolveBaseComponentsRouteSuffix('studio/base-components/dialog')).toBe('dialog');
    expect(resolveBaseComponentsRouteSuffix('base-components/create-edit')).toBe('create-edit');
    expect(resolveBaseComponentsRouteSuffix('base-components/dialog')).toBe('dialog');
  });

  it('builds bookmarkable relative paths', () => {
    for (const section of BASE_COMPONENTS_SECTIONS) {
      expect(buildBaseComponentsSectionRelativePath(section.id)).toBe(`base-components/${section.id}`);
    }
  });

  it('includes the studio portal segment for culture mounts', () => {
    expect(buildBaseComponentsSectionRelativePath('dialog', 'us')).toBe('studio/base-components/dialog');
    expect(buildBaseComponentsSectionRelativePath('grid', 'ir')).toBe('studio/base-components/grid');
    expect(buildBaseComponentsSectionRelativePath('date-time', 'us')).toBe('studio/base-components/date-time');
  });
});
