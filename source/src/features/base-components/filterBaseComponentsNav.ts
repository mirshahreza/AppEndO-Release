import { BASE_COMPONENTS_BY_ID } from './catalog/baseComponentCatalog';
import { getBaseComponentsSectionDescription } from './baseComponentsSectionDescriptions';
import {
  BASE_COMPONENTS_SECTION_GROUPS,
  BASE_COMPONENTS_SECTIONS,
  getBaseComponentsSectionGroup,
  type BaseComponentsSectionEntry,
  type BaseComponentsSectionGroup,
} from './baseComponentsSections';

export type BaseComponentsNavGroup = {
  group: BaseComponentsSectionGroup;
  sections: BaseComponentsSectionEntry[];
};

const SECTION_SEARCH_HAYSTACK = new Map<string, string>(
  BASE_COMPONENTS_SECTIONS.map((section) => [section.id, buildSectionSearchHaystack(section)]),
);

export function normalizeBaseComponentsSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function filterBaseComponentsNav(query: string): BaseComponentsNavGroup[] {
  const tokens = normalizeBaseComponentsSearchQuery(query).split(/\s+/).filter(Boolean);

  return BASE_COMPONENTS_SECTION_GROUPS.flatMap((group) => {
    const sections = BASE_COMPONENTS_SECTIONS.filter((section) => {
      if (section.group !== group.id) {
        return false;
      }
      if (tokens.length === 0) {
        return true;
      }
      const haystack = SECTION_SEARCH_HAYSTACK.get(section.id) ?? '';
      return tokens.every((token) => haystack.includes(token));
    });

    return sections.length > 0 ? [{ group, sections }] : [];
  });
}

function buildSectionSearchHaystack(section: BaseComponentsSectionEntry): string {
  const catalog = BASE_COMPONENTS_BY_ID.get(section.id);
  const parts = [
    section.id,
    section.id.replaceAll('-', ' '),
    section.label,
    getBaseComponentsSectionGroup(section.group).label,
    getBaseComponentsSectionDescription(section.id),
    catalog?.family,
    ...(catalog?.publicExportIds ?? []),
    ...(catalog?.useWhen ?? []),
    ...(catalog?.anatomy.required ?? []),
    ...(catalog?.anatomy.optional ?? []),
  ];

  return parts.filter(Boolean).join(' ').toLowerCase();
}
