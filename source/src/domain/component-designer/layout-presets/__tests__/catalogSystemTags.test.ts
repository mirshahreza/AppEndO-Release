import { describe, expect, it } from 'vitest';
import {
  CATALOG_BUILTIN_FILTER_NO,
  CATALOG_BUILTIN_FILTER_OPTIONS,
  CATALOG_BUILTIN_FILTER_YES,
  CATALOG_KIND_FILTER_OPTIONS,
  CATALOG_TAG_BUILTIN,
  CATALOG_TAG_CUSTOM,
  CATALOG_TAG_SHELL,
  CATALOG_TAG_TEMPLATE,
  DEFAULT_CATALOG_BUILTIN_FILTER,
  DEFAULT_CATALOG_KIND_FILTER,
  catalogItemMatchesBuiltInFilter,
  catalogItemMatchesKindFilter,
  catalogSearchTags,
  catalogSystemTags,
} from '../catalogSystemTags';

describe('catalogSystemTags', () => {
  it('tags built-in starters as builtin + template', () => {
    expect(catalogSystemTags({
      name: 'blog-list',
      folder: 'templates',
      isBuiltIn: true,
    })).toEqual([CATALOG_TAG_BUILTIN, CATALOG_TAG_TEMPLATE]);
  });

  it('tags built-in shells as builtin + shell', () => {
    expect(catalogSystemTags({
      name: 'app-shell',
      folder: 'general',
      isBuiltIn: true,
    })).toEqual([CATALOG_TAG_BUILTIN, CATALOG_TAG_SHELL]);
  });

  it('tags saved drafts as custom without operator tags', () => {
    const item = {
      name: 'home-hero',
      folder: 'general',
      isBuiltIn: false,
      tags: ['cms', 'custom'],
    };

    expect(catalogSystemTags(item)).toEqual([CATALOG_TAG_CUSTOM]);
    expect(catalogSearchTags(item)).toEqual([CATALOG_TAG_CUSTOM]);
  });

  it('treats installed package UI as custom with no package-source tag', () => {
    expect(catalogSystemTags({
      name: 'cms-contents-list',
      folder: 'general',
      isBuiltIn: false,
      isPackageComponent: true,
    })).toEqual([CATALOG_TAG_CUSTOM]);
    expect(catalogSearchTags({
      name: 'cms-contents-list',
      folder: 'general',
      isBuiltIn: false,
      isPackageComponent: true,
    })).toEqual([CATALOG_TAG_CUSTOM]);
  });

  it('defaults the kind filter to All and keeps BuiltIn out of type options', () => {
    expect(DEFAULT_CATALOG_KIND_FILTER).toBe('');
    expect(DEFAULT_CATALOG_BUILTIN_FILTER).toBe('');
    expect(CATALOG_KIND_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      CATALOG_TAG_CUSTOM,
      CATALOG_TAG_SHELL,
      CATALOG_TAG_TEMPLATE,
    ]);
    expect(CATALOG_BUILTIN_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      CATALOG_BUILTIN_FILTER_YES,
      CATALOG_BUILTIN_FILTER_NO,
    ]);

    const custom = { name: 'home-hero', folder: 'general', isBuiltIn: false };
    const template = { name: 'blog-list', folder: 'templates', isBuiltIn: true };
    const shell = { name: 'app-shell', folder: 'general', isBuiltIn: true };
    const packaged = {
      name: 'cms-home',
      folder: 'general',
      isBuiltIn: false,
      isPackageComponent: true,
    };

    expect(catalogItemMatchesKindFilter(custom, DEFAULT_CATALOG_KIND_FILTER)).toBe(true);
    expect(catalogItemMatchesKindFilter(template, DEFAULT_CATALOG_KIND_FILTER)).toBe(true);
    expect(catalogItemMatchesKindFilter(shell, DEFAULT_CATALOG_KIND_FILTER)).toBe(true);
    expect(catalogItemMatchesKindFilter(packaged, DEFAULT_CATALOG_KIND_FILTER)).toBe(true);
  });

  it('matches catalog kind filter by type only (BuiltIn is a separate origin filter)', () => {
    const custom = { name: 'home-hero', folder: 'general', isBuiltIn: false };
    const template = { name: 'blog-list', folder: 'templates', isBuiltIn: true };
    const shell = { name: 'app-shell', folder: 'general', isBuiltIn: true };
    const packaged = {
      name: 'cms-home',
      folder: 'general',
      isBuiltIn: false,
      isPackageComponent: true,
    };

    expect(catalogItemMatchesKindFilter(custom, CATALOG_TAG_CUSTOM)).toBe(true);
    expect(catalogItemMatchesKindFilter(packaged, CATALOG_TAG_CUSTOM)).toBe(true);
    expect(catalogItemMatchesKindFilter(template, CATALOG_TAG_CUSTOM)).toBe(false);
    expect(catalogItemMatchesKindFilter(shell, CATALOG_TAG_CUSTOM)).toBe(false);

    expect(catalogItemMatchesKindFilter(template, CATALOG_TAG_TEMPLATE)).toBe(true);
    expect(catalogItemMatchesKindFilter(shell, CATALOG_TAG_SHELL)).toBe(true);
    expect(catalogItemMatchesKindFilter(custom, CATALOG_TAG_TEMPLATE)).toBe(false);

    expect(catalogItemMatchesBuiltInFilter(template, DEFAULT_CATALOG_BUILTIN_FILTER)).toBe(true);
    expect(catalogItemMatchesBuiltInFilter(custom, DEFAULT_CATALOG_BUILTIN_FILTER)).toBe(true);
    expect(catalogItemMatchesBuiltInFilter(template, CATALOG_BUILTIN_FILTER_YES)).toBe(true);
    expect(catalogItemMatchesBuiltInFilter(custom, CATALOG_BUILTIN_FILTER_YES)).toBe(false);
    expect(catalogItemMatchesBuiltInFilter(template, CATALOG_BUILTIN_FILTER_NO)).toBe(false);
    expect(catalogItemMatchesBuiltInFilter(custom, CATALOG_BUILTIN_FILTER_NO)).toBe(true);
    expect(catalogItemMatchesBuiltInFilter(packaged, CATALOG_BUILTIN_FILTER_NO)).toBe(true);

    expect(catalogItemMatchesKindFilter(custom, `${CATALOG_TAG_CUSTOM},${CATALOG_TAG_TEMPLATE}`)).toBe(true);
    expect(catalogItemMatchesKindFilter(template, `${CATALOG_TAG_CUSTOM},${CATALOG_TAG_TEMPLATE}`)).toBe(true);
    expect(catalogItemMatchesKindFilter(shell, `${CATALOG_TAG_CUSTOM},${CATALOG_TAG_TEMPLATE}`)).toBe(false);
  });
});
