import { describe, expect, it } from 'vitest';
import {
  defaultComponentAlonePortal,
  defaultHomePortal,
  defaultStudioPortal,
} from '../../../../shared/api/contracts/platform/experienceManifest';
import { BUILTIN_FILTER_ALL, BUILTIN_FILTER_NO, BUILTIN_FILTER_YES } from '../../../../shared/lib/builtInFilter';
import { filterPortals, portalIsBuiltIn, portalMatchesSearch } from '../portalListFilters';

const customPortal = {
  segment: 'my-portal',
  name: 'My Portal',
  shellKey: 'landing-shell',
  entryMode: 'shell' as const,
  enabled: true,
  pages: [],
};

describe('portalListFilters', () => {
  const portals = [
    defaultHomePortal(),
    defaultStudioPortal(),
    defaultComponentAlonePortal(),
    customPortal,
  ];

  it('treats studio and component-alone as built-in and home as not built-in', () => {
    expect(portalIsBuiltIn(defaultHomePortal())).toBe(false);
    expect(portalIsBuiltIn(defaultStudioPortal())).toBe(true);
    expect(portalIsBuiltIn(defaultComponentAlonePortal())).toBe(true);
    expect(portalIsBuiltIn(customPortal)).toBe(false);
  });

  it('shows custom and builtin portals when BuiltIn filter is All', () => {
    expect(filterPortals(portals, { builtInFilter: BUILTIN_FILTER_ALL, query: '' }).map((item) => item.segment))
      .toEqual(['home', 'studio', 'component-alone', 'my-portal']);
  });

  it('hides builtin portals when Not BuiltIn is selected', () => {
    expect(filterPortals(portals, { builtInFilter: BUILTIN_FILTER_NO, query: '' }).map((item) => item.segment))
      .toEqual(['home', 'my-portal']);
  });

  it('shows only builtin portals when BuiltIn is selected', () => {
    expect(filterPortals(portals, { builtInFilter: BUILTIN_FILTER_YES, query: '' }).map((item) => item.segment))
      .toEqual(['studio', 'component-alone']);
  });

  it('matches name, segment, and shell key in search', () => {
    expect(portalMatchesSearch(customPortal, 'portal')).toBe(true);
    expect(portalMatchesSearch(customPortal, 'LANDING')).toBe(true);
    expect(portalMatchesSearch(customPortal, 'missing')).toBe(false);
    expect(filterPortals(portals, { builtInFilter: BUILTIN_FILTER_ALL, query: 'studio' }).map((item) => item.segment))
      .toEqual(['studio']);
  });
});
