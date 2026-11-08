import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';

let tmpDir = '';
let origCwd = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'component-designer-publish-'));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.resetModules();
});

describe('designer publish coordinator', () => {
  it('publishes, pins loader ref, and supports rollback', async () => {
    const { saveDesignerDraft } = await import('../draftCoordinator.service');
    const {
      publishDesignerComponent,
      rollbackDesignerPublishedVersion,
    } = await import('../publishCoordinator.service');
    const { getDesignerPublishEntry } = await import('../../../domain/component-designer/publishIo');

    const state = createInitialDesignerState();
    const saved = saveDesignerDraft({
      name: 'smoke-widget',
      folder: 'general',
      document: state.document,
      bindingDefinitions: state.bindingDefinitions,
      actor: 'admin',
    });

    const firstPublish = publishDesignerComponent(saved.id, 'admin');
    expect(firstPublish.lifecycle).toBe('published');
    expect(firstPublish.publishedVersion).toBe(1);

    const entry = getDesignerPublishEntry('general/smoke-widget');
    expect(entry?.loaderRef).toBe('general/smoke-widget@v1');

    const secondPublish = publishDesignerComponent(saved.id, 'admin');
    expect(secondPublish.publishedVersion).toBe(2);
    expect(getDesignerPublishEntry('general/smoke-widget')?.loaderRef).toBe('general/smoke-widget@v2');

    const rolledBack = rollbackDesignerPublishedVersion(saved.id, 1, 'admin');
    expect(rolledBack.publishedVersion).toBe(1);
    expect(getDesignerPublishEntry('general/smoke-widget')?.loaderRef).toBe('general/smoke-widget@v1');
  });
});
