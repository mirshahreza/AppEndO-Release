import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { MODEL_STORY_EXTENSION_KEY, readModelStoryFromExtensions } from '../../../../shared/lib/edgeModelStory';

const { testDir, models } = vi.hoisted(() => {
  const nodePath = require('node:path') as typeof import('node:path');
  const nodeOs = require('node:os') as typeof import('node:os');
  const dir = nodePath.join(nodeOs.tmpdir(), `appendo-studio-meta-test-${process.pid}`);
  return {
    testDir: dir,
    models: new Map<string, EdgeModelDefinition>(),
  };
});

vi.mock('../../../../core/runtime/runtimePaths', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../core/runtime/runtimePaths')>();
  return {
    ...actual,
    runtimeDirs: {
      ...actual.runtimeDirs,
      edgeModelStudioMeta: testDir,
      edgeModelStudioMetaLocks: path.join(testDir, 'locks'),
      workspaceTemp: path.join(testDir, 'temp'),
    },
    EDGE_MODEL_STUDIO_META_INDEX_PATH: path.join(testDir, 'index.json'),
  };
});

vi.mock('../edgeModelStore', () => ({
  getEdgeModelById: (id: string) => models.get(id) ?? null,
}));

import {
  bindEdgeModelStudioMeta,
  getEdgeModelStudioMeta,
  parkEdgeModelStudioMeta,
  retargetEdgeModelStudioMeta,
  studioMetaSchemaKey,
  upsertEdgeModelStudioMeta,
} from '../edgeModelStudioMetaStore';
import { attachStudioMetaForEdgeModel } from '../edgeModelStudioMetaAttach';
import { BASE_STUDIO_META_STORIES } from '../baseModelStudioStories';

const model = (
  id: string,
  objectName: string,
  dataSourceId = 'ds1',
): EdgeModelDefinition => ({
  id,
  dataSourceId,
  schema: null,
  objectName,
  objectType: 'TABLE',
  sequelize: { modelName: objectName, tableName: objectName },
  columns: [],
  primaryKey: 'id',
  associations: [],
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: objectName },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('edgeModelStudioMetaStore schema identity', () => {
  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    models.clear();
  });

  it('parks story on delete and reattaches it to a new model id', () => {
    const first = model('em_old', 'base_users');
    models.set(first.id, first);
    upsertEdgeModelStudioMeta(first.id, {
      extensions: { [MODEL_STORY_EXTENSION_KEY]: '## Purpose\n\nKept story.' },
    });

    parkEdgeModelStudioMeta(first);
    models.delete(first.id);

    const second = model('em_new', 'base_users');
    models.set(second.id, second);
    bindEdgeModelStudioMeta(second);

    const meta = getEdgeModelStudioMeta(second.id);
    expect(readModelStoryFromExtensions(meta.extensions)).toBe('## Purpose\n\nKept story.');
    expect(meta.edgeModelId).toBe('em_new');
  });

  it('retargets duplicate meta onto the kept model', () => {
    const kept = model('em_kept', 'orders');
    const duplicate = model('em_dup', 'orders');
    models.set(kept.id, kept);
    models.set(duplicate.id, duplicate);
    upsertEdgeModelStudioMeta(duplicate.id, {
      extensions: { [MODEL_STORY_EXTENSION_KEY]: '## Purpose\n\nFrom duplicate.' },
    });

    retargetEdgeModelStudioMeta(duplicate.id, kept.id);
    models.delete(duplicate.id);

    expect(readModelStoryFromExtensions(getEdgeModelStudioMeta(kept.id).extensions))
      .toBe('## Purpose\n\nFrom duplicate.');
  });

  it('catalog covers imported extras that previously had no story', () => {
    const required = [
      'base_idea_cards',
      'base_product_ideas',
      'base_workbooks',
      'base_user_notification_digest_items',
      'base_user_notification_preferences',
      'base_sample_mock_statuses',
      'base_sample_mock_details',
      'base_sample_mock_record_tags',
      'base_sample_mock_records',
    ];
    for (const name of required) {
      expect(BASE_STUDIO_META_STORIES[name], name).toContain('## Purpose');
      expect(BASE_STUDIO_META_STORIES[name], name).toMatch(/## (Lifecycle|Rules)/);
    }
  });

  it('attaches platform history marks onto unmarked sample-mock records', () => {
    const row = model('em_sample_mock', 'base_sample_mock_records');
    models.set(row.id, row);
    attachStudioMetaForEdgeModel(row);
    const meta = getEdgeModelStudioMeta(row.id);
    expect(meta.history?.enabled).toBe(true);
    expect(meta.history?.lifecycleField).toBe('status_id');
    expect(meta.columnMeta.find((column) => column.columnName === 'locked')?.history?.track).toBe(true);
    expect(meta.associationMeta.find((item) => item.relationKey === 'tags')?.history?.trackAssignRemove).toBe(true);
  });

  it('fills empty catalog story for base tables and does not overwrite edits', () => {
    const row = model('em_scope', 'base_scope_role_memberships');
    models.set(row.id, row);
    attachStudioMetaForEdgeModel(row);
    const seeded = readModelStoryFromExtensions(getEdgeModelStudioMeta(row.id).extensions);
    expect(seeded.startsWith('## Purpose')).toBe(true);
    expect(seeded).toContain('role');

    upsertEdgeModelStudioMeta(row.id, {
      extensions: { [MODEL_STORY_EXTENSION_KEY]: '## Purpose\n\nOperator edit.' },
    });
    attachStudioMetaForEdgeModel(row);
    expect(readModelStoryFromExtensions(getEdgeModelStudioMeta(row.id).extensions))
      .toBe('## Purpose\n\nOperator edit.');
  });

  it('builds a stable schema key', () => {
    expect(studioMetaSchemaKey({
      dataSourceId: 'ds1',
      objectType: 'TABLE',
      objectName: 'base_users',
    })).toBe('ds1::TABLE::base_users');
  });
});
