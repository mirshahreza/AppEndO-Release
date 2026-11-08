import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createInitialDesignerState } from '../../../domain/component-designer/state';
import { ComponentDesignerService } from '../component-designer.service';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'component-designer-service-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('ComponentDesignerService updateDraft', () => {
  it('persists a renamed component name from the update payload', async () => {
    const { saveDesignerDraft } = await import('../component-designer/draftCoordinator.service');
    const { getDesignerDraft, listDesignerDrafts } = await import('../../domain/component-designer/drafts');

    const saved = saveDesignerDraft({
      name: 'original-name',
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
    });

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const result = service.updateDraft(saved.id, {
      name: 'renamed-component',
    }, 'tester@append.os');

    expect(result.body.draft.name).toBe('renamed-component');
    expect(getDesignerDraft(saved.id)?.name).toBe('renamed-component');
    expect(listDesignerDrafts().some((item) => item.name === 'renamed-component')).toBe(true);
  });

  it('saves a built-in component as an editable overlay draft', async () => {
    const { toBuiltInComponentId } = await import('../../../domain/component-designer/layout-presets/builtInComponents');
    const { listDesignerDrafts } = await import('../../domain/component-designer/drafts');

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const builtInId = toBuiltInComponentId('blog-list');
    const result = service.updateDraft(builtInId, {
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
    }, 'tester@append.os');

    expect(result.body.draft.id).not.toBe(builtInId);
    expect(result.body.draft.name).toBe('blog-list');
    expect(listDesignerDrafts().some((item) => item.name === 'blog-list')).toBe(true);

    const second = service.updateDraft(builtInId, {
      tags: ['landing'],
    }, 'tester@append.os');
    expect(second.body.draft.id).toBe(result.body.draft.id);
    expect(second.body.draft.tags).toEqual(['landing']);
  });

  it('saves the built-in app-shell as an overlay under the same name', async () => {
    const { toBuiltInComponentId } = await import('../../../domain/component-designer/layout-presets/builtInComponents');
    const { listDesignerDrafts } = await import('../../domain/component-designer/drafts');

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const builtInId = toBuiltInComponentId('app-shell');
    const result = service.updateDraft(builtInId, {
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
    }, 'tester@append.os');

    expect(result.body.draft.id).not.toBe(builtInId);
    expect(result.body.draft.name).toBe('app-shell');
    expect(result.body.draft.isBuiltIn).not.toBe(true);
    expect(listDesignerDrafts().some((item) => item.name === 'app-shell' && item.id !== builtInId)).toBe(true);
  });

  it('renames a built-in app-shell overlay without hanging on the builtin id', async () => {
    const { toBuiltInComponentId } = await import('../../../domain/component-designer/layout-presets/builtInComponents');
    const { listDesignerDrafts } = await import('../../domain/component-designer/drafts');

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const builtInId = toBuiltInComponentId('app-shell');
    const overlay = service.updateDraft(builtInId, {
      tags: ['shell'],
    }, 'tester@append.os');

    expect(overlay.body.draft.id).not.toBe(builtInId);
    expect(overlay.body.draft.name).toBe('app-shell');

    const renamed = service.updateDraft(builtInId, {
      name: 'renamed-app-shell',
    }, 'tester@append.os');

    expect(renamed.body.draft.id).toBe(overlay.body.draft.id);
    expect(renamed.body.draft.name).toBe('renamed-app-shell');
    expect(listDesignerDrafts().some((item) => item.id === builtInId)).toBe(false);
  });

  it('persists catalog tags from a tags-only update', async () => {
    const { saveDesignerDraft } = await import('../component-designer/draftCoordinator.service');
    const { getDesignerDraft, listDesignerDrafts } = await import('../../domain/component-designer/drafts');

    const saved = saveDesignerDraft({
      name: 'tagged-component',
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
    });

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const updated = service.updateDraft(saved.id, {
      tags: ['billing', 'crm'],
    }, 'tester@append.os');

    expect(updated.body.draft.tags).toEqual(['billing', 'crm']);
    expect(getDesignerDraft(saved.id)?.tags).toEqual(['billing', 'crm']);
    expect(listDesignerDrafts().find((item) => item.id === saved.id)?.tags).toEqual(['billing', 'crm']);

    const cleared = service.updateDraft(saved.id, {
      tags: [],
    }, 'tester@append.os');

    expect(cleared.body.draft.tags).toEqual([]);
    expect(getDesignerDraft(saved.id)?.tags ?? []).toEqual([]);
    expect(listDesignerDrafts().find((item) => item.id === saved.id)?.tags ?? []).toEqual([]);
  });
});

describe('ComponentDesignerService getDraft publish lookup', () => {
  it('resolves folder/name@vN via publish-index draftId (not sanitized path)', async () => {
    const { saveDesignerDraft } = await import('../component-designer/draftCoordinator.service');
    const { publishDesignerComponent } = await import('../component-designer/publishCoordinator.service');

    const saved = saveDesignerDraft({
      id: 'draft-cms-contents-list',
      name: 'cms-contents-list',
      folder: 'cms',
      document: createInitialDesignerState().document,
      bindingDefinitions: {},
    });
    const published = publishDesignerComponent(saved.id, 'tester');
    expect(published.loaderRef).toBe('general/cms-contents-list@v1');

    const service = new ComponentDesignerService({ serverPort: 3001 });
    const result = service.getDraft('cms/cms-contents-list@v1');
    expect(result.body.draft.id).toBe('draft-cms-contents-list');
    expect(result.body.draft.name).toBe('cms-contents-list');
  });
});
