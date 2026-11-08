import { describe, expect, it } from 'vitest';
import { catalogTagsSearchHaystack, collectCatalogTagSuggestions, normalizeCatalogTags, parseCatalogTagInput } from '../catalogTags';
import {
  readServerFunctionCatalogTags,
  withServerFunctionCatalogTags,
} from '../serverFunctionCatalogTags';

describe('normalizeCatalogTags', () => {
  it('trims, dedupes case-insensitively, and caps length', () => {
    expect(normalizeCatalogTags(['  Orders ', 'orders', 'Billing', '', 12])).toEqual(['Orders', 'Billing']);
  });
});

describe('parseCatalogTagInput', () => {
  it('returns null for blank input', () => {
    expect(parseCatalogTagInput('   ')).toBeNull();
  });
});

describe('collectCatalogTagSuggestions', () => {
  it('uniques, sorts, and ignores empty tags across records', () => {
    expect(collectCatalogTagSuggestions([
      { tags: ['CRM', 'billing'] },
      { tags: ['crm', 'Portal'] },
      { tags: [] },
      {},
    ])).toEqual(['billing', 'CRM', 'Portal']);
  });
});

describe('serverFunctionCatalogTags', () => {
  it('reads and writes catalogTags without touching apiDoc.tags', () => {
    const next = withServerFunctionCatalogTags(
      { apiDoc: { tags: ['openapi'] }, catalogTags: ['old'] },
      ['crm', 'CRM'],
    );
    expect(next.apiDoc?.tags).toEqual(['openapi']);
    expect(readServerFunctionCatalogTags(next)).toEqual(['crm']);
    expect(catalogTagsSearchHaystack(next.catalogTags)).toContain('crm');
  });
});
