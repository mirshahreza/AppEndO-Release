import { describe, expect, it } from 'vitest';
import type { DesignerDocument } from '../../../domain/component-designer/types';
import {
  buildDesignerShellEntry,
  isDesignerShellEntry,
  parseDesignerShellEntry,
  resolveCanonicalDesignerDraftFolder,
  resolveLayoutKeyFromShellEntry,
  resolveShellEntryForLayoutKey,
} from '../designerShellEntry';
import {
  BUILT_IN_SITE_SHELL_ENTRY,
  LEGACY_CORE_SITE_SHELL_ENTRY,
} from '../../api/contracts/platform/mountConstants';
import {
  documentHasShellRouteOutletSlot,
  ensureShellRouteOutletSlot,
} from '../shellRouteOutlet';

describe('resolveCanonicalDesignerDraftFolder', () => {
  it('flattens every folder to general', () => {
    expect(resolveCanonicalDesignerDraftFolder(undefined)).toBe('general');
    expect(resolveCanonicalDesignerDraftFolder('')).toBe('general');
    expect(resolveCanonicalDesignerDraftFolder('cms')).toBe('general');
    expect(resolveCanonicalDesignerDraftFolder('Landing Pages')).toBe('general');
    expect(resolveCanonicalDesignerDraftFolder('portal-layouts')).toBe('general');
    expect(resolveCanonicalDesignerDraftFolder('Portal-Layouts')).toBe('general');
  });
});

describe('designerShellEntry', () => {
  it('builds and parses designer shell entries', () => {
    expect(buildDesignerShellEntry('my-portal')).toBe('designer:portal-layouts/my-portal');
    expect(buildDesignerShellEntry('my-portal', 3)).toBe('designer:portal-layouts/my-portal@v3');
    expect(parseDesignerShellEntry('designer:portal-layouts/my-portal')).toEqual({
      shellKey: 'my-portal',
      publishedVersion: null,
    });
    expect(parseDesignerShellEntry('designer:portal-layouts/my-portal@v3')).toEqual({
      shellKey: 'my-portal',
      publishedVersion: 3,
    });
    expect(isDesignerShellEntry('designer:portal-layouts/my-portal')).toBe(true);
    expect(parseDesignerShellEntry('core:AdminLayout')).toBeNull();
  });

  it('round-trips core and designer layout picker values to shell entries', () => {
    expect(resolveShellEntryForLayoutKey(LEGACY_CORE_SITE_SHELL_ENTRY)).toBe(BUILT_IN_SITE_SHELL_ENTRY);
    expect(resolveShellEntryForLayoutKey('site')).toBe(BUILT_IN_SITE_SHELL_ENTRY);
    expect(resolveShellEntryForLayoutKey('home-shell')).toBe(BUILT_IN_SITE_SHELL_ENTRY);
    expect(resolveShellEntryForLayoutKey('site-shell')).toBe(BUILT_IN_SITE_SHELL_ENTRY);
    expect(resolveShellEntryForLayoutKey('landing')).toBe('designer:portal-layouts/landing');
    expect(resolveLayoutKeyFromShellEntry(LEGACY_CORE_SITE_SHELL_ENTRY, 'home-shell')).toBe('site-shell');
    expect(resolveLayoutKeyFromShellEntry(BUILT_IN_SITE_SHELL_ENTRY, 'home-shell')).toBe('site-shell');
    expect(resolveLayoutKeyFromShellEntry('designer:portal-layouts/landing', 'home-shell')).toBe('landing');
    expect(resolveLayoutKeyFromShellEntry('designer:portal-layouts/home-shell', 'home-shell')).toBe('site-shell');
    expect(resolveLayoutKeyFromShellEntry('', 'home-shell')).toBe('home-shell');
  });
});

describe('shellRouteOutlet', () => {
  it('injects route-outlet slot into legacy workspace placeholders', () => {
    const document: DesignerDocument = {
      schemaVersion: '1.0.0',
      id: 'draft-1',
      name: 'my-portal',
      rootNodeId: 'root',
      nodes: {
        root: {
          id: 'root',
          type: 'root',
          parentId: null,
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: ['workspace-container'],
        },
        'workspace-container': {
          id: 'workspace-container',
          type: 'container',
          parentId: 'root',
          order: 0,
          props: {},
          layout: {},
          binding: {},
          children: ['workspace-text'],
        },
        'workspace-text': {
          id: 'workspace-text',
          type: 'text',
          parentId: 'workspace-container',
          order: 0,
          props: { text: 'Workspace' },
          layout: {},
          binding: {},
          children: [],
        },
      },
      metadata: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      diagnostics: [],
    };

    expect(documentHasShellRouteOutletSlot(document)).toBe(false);
    const patched = ensureShellRouteOutletSlot(document);
    expect(documentHasShellRouteOutletSlot(patched)).toBe(true);
    expect(patched.nodes['workspace-text']).toBeUndefined();
  });
});
