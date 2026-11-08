import { describe, expect, it } from 'vitest';
import {
  buildShellDesignerDraftCreatePayload,
} from '../shellDesignerDraft';
import {
  getComponentAloneShellLayoutRecord,
} from '../../../../domain/component-designer/systemManagedShellLayout';
import {
  isSystemManagedShellLayoutDraft,
  isSystemManagedShellLayoutKey,
  parseShellDesignerComponentPath,
  resolveShellDesignerDraftSummary,
  COMPONENT_ALONE_SHELL_LAYOUT_KEY,
} from '../../../../shared/lib/designerShellEntry';

describe('shellDesignerDraft', () => {
  it('parses shell designer component paths', () => {
    expect(parseShellDesignerComponentPath('portal-layouts/my-portal')).toEqual({
      shellKey: 'my-portal',
      componentPath: 'portal-layouts/my-portal',
    });
    expect(parseShellDesignerComponentPath('general/test-c')).toBeNull();
  });

  it('builds admin-shell draft payloads for shell keys', () => {
    const payload = buildShellDesignerDraftCreatePayload('my-portal');
    expect(payload.folder).toBe('general');
    expect(payload.name).toBe('my-portal');
    expect(payload.document.name).toBe('my-portal');
    expect(payload.document.nodes[payload.document.rootNodeId]?.children?.length).toBeGreaterThan(0);

    const nodes = Object.values(payload.document.nodes);
    const slotIds = nodes
      .filter((node) => node.type === 'system-slot')
      .map((node) => node.props.slotId);
    expect(nodes.some((node) => node.type === 'platform-nav')).toBe(true);
    expect(slotIds).toContain('core.shell.route-outlet');
    expect(slotIds).toContain('core.shell.logo');
    expect(slotIds).toContain('core.shell.header');
  });

  it('builds outlet-only draft payloads for component-alone shell', () => {
    const payload = buildShellDesignerDraftCreatePayload(COMPONENT_ALONE_SHELL_LAYOUT_KEY);
    expect(payload.folder).toBe('general');
    expect(payload.name).toBe(COMPONENT_ALONE_SHELL_LAYOUT_KEY);

    const slotIds = Object.values(payload.document.nodes)
      .filter((node) => node.type === 'system-slot')
      .map((node) => node.props.slotId);
    expect(slotIds).toEqual(['core.shell.route-outlet']);
  });

  it('identifies system-managed shell layouts', () => {
    expect(isSystemManagedShellLayoutKey('component-alone')).toBe(true);
    expect(isSystemManagedShellLayoutKey('my-portal')).toBe(false);
    expect(isSystemManagedShellLayoutDraft({
      name: 'component-alone',
      folder: 'portal-layouts',
    })).toBe(true);
    expect(isSystemManagedShellLayoutDraft({
      name: 'component-alone',
      folder: 'general',
    })).toBe(true);
  });

  it('builds in-memory component-alone shell layout record', () => {
    const record = getComponentAloneShellLayoutRecord();
    expect(record.name).toBe('component-alone');
    expect(record.folder).toBe('general');
    expect(record.document.name).toBe('component-alone');
  });

  it('falls back to app-shell when studio shell draft is missing', () => {
    const items = [
      {
        id: 'draft-app-shell',
        name: 'app-shell',
        folder: 'portal-layouts',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ];

    expect(resolveShellDesignerDraftSummary(items, 'studio')?.name).toBe('app-shell');
    expect(resolveShellDesignerDraftSummary(items, 'studio')?.id).toBe('draft-app-shell');
  });

  it('keeps an exact app-shell match instead of substituting admin-layout', () => {
    const items = [
      {
        id: 'draft-admin-layout',
        name: 'admin-layout',
        folder: 'general',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-03T00:00:00.000Z',
      },
      {
        id: 'builtin-app-shell',
        name: 'app-shell',
        folder: 'general',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ];

    expect(resolveShellDesignerDraftSummary(items, 'app-shell')?.id).toBe('builtin-app-shell');
  });
});
