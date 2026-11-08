/**
 * p-89 WFM-12 — `cms-scheduled-unpublish`
 * Load published CMS content → stamp now → set status=archived (unpublish).
 * SCHEDULE start is supported in the model; seed runs MANUAL_API for live proof.
 * Run: `npx tsx scripts/seed-workflow-machines/cms-scheduled-unpublish.ts`
 */
import { Pool } from 'pg';
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, actionNode, unconditionalEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd,
} from './_seedHelpers';

const KEY = 'cms-scheduled-unpublish';

function buildModel(archivedStatusCode: string): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS scheduled unpublish',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          contentId: { type: 'integer' },
          actorUserId: { type: 'integer' },
        },
        required: ['contentId', 'actorUserId'],
      },
    },
    variables: [
      { key: 'title', schema: { type: 'INLINE', schema: {} } },
      { key: 'unpublishAtIso', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('load-content', {
        actionRef: ACTION('cms.content-get'),
        input: {
          type: 'OBJECT',
          fields: { contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'title', value: nodeOutput('load-content', ['title']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('stamp-now', {
        actionRef: ACTION('date.now'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'unpublishAtIso', value: nodeOutput('stamp-now', ['iso']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('archive-content', {
        actionRef: ACTION('cms.content-update'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            statusCode: { type: 'EXPRESSION', expression: lit(archivedStatusCode) },
            publishedAt: { type: 'EXPRESSION', expression: lit(null) },
            statusCodeUpdatedBy: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
            updatedBy: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
            operatorNote: {
              type: 'EXPRESSION',
              expression: lit('Unpublished by cms-scheduled-unpublish'),
            },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-archived', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('ARCHIVED') },
          contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
          title: { type: 'EXPRESSION', expression: workflowVariable('title') },
          statusCode: { type: 'EXPRESSION', expression: nodeOutput('archive-content', ['statusCode']) },
        },
      }),
      endNode('end-load-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('LOAD_FAILED') } },
      }),
      endNode('end-archive-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('ARCHIVE_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-content', 'end-load-failed'),
      unconditionalEdge('e-load-stamp', 'load-content', 'stamp-now'),
      unconditionalEdge('e-stamp-arch', 'stamp-now', 'archive-content'),
      errorEdge('e-arch-err', 'archive-content', 'end-archive-failed'),
      unconditionalEdge('e-arch-done', 'archive-content', 'end-archived'),
    ],
    // Catalog machine is schedule-ready; seed uses MANUAL_API below.
    start: { type: 'MANUAL_API', targetNodeKey: 'load-content' },
  });
}

async function resolvePublishedContent(): Promise<{ id: number; archivedStatusCode: string }> {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') {
    throw new Error('WFM-12 needs PostgreSQL with CMS tables.');
  }
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });
  try {
    const archived = await pool.query<{ id: string }>(
      `SELECT item.id FROM base_info root
       JOIN base_info category ON category.parent_id = root.id AND category.title_en = 'Statuses'
       JOIN base_info item ON item.parent_id = category.id AND item.short_name = 'archived'
       WHERE root.parent_id IS NULL AND root.title_en = 'CMS' LIMIT 1`,
    );
    const archivedStatusCode = archived.rows[0]?.id;
    if (!archivedStatusCode) throw new Error('CMS status "archived" missing.');

    const published = await pool.query<{ id: string }>(
      `SELECT c.id::text AS id FROM cms_contents c
       JOIN base_info st ON st.id = c.status_code AND st.short_name = 'published'
       ORDER BY c.id ASC LIMIT 1`,
    );
    let contentId = published.rows[0]?.id ? Number(published.rows[0].id) : null;
    if (!contentId) {
      const any = await pool.query<{ id: string }>(`SELECT id::text AS id FROM cms_contents ORDER BY id ASC LIMIT 1`);
      contentId = any.rows[0]?.id ? Number(any.rows[0].id) : null;
    }
    if (!contentId) throw new Error('No cms_contents rows.');
    await pool.query(
      `UPDATE cms_contents c
       SET status_code = (
         SELECT item.id FROM base_info root
         JOIN base_info category ON category.parent_id = root.id AND category.title_en = 'Statuses'
         JOIN base_info item ON item.parent_id = category.id AND item.short_name = 'published'
         WHERE root.parent_id IS NULL AND root.title_en = 'CMS' LIMIT 1
       ),
       published_at = NOW()
       WHERE c.id = $1`,
      [contentId],
    );
    return { id: contentId, archivedStatusCode };
  } finally {
    await pool.end();
  }
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const { id: contentId, archivedStatusCode } = await resolvePublishedContent();
  console.log(`[seed] unpublishing cms_contents#${contentId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel(archivedStatusCode));
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { contentId, actorUserId: user.userId },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-12');
  await assertEnd(instance.id, 'end-archived');
  console.log(`[seed] archived cms_contents#${contentId}.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
