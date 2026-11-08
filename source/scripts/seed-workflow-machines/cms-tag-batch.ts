/**
 * p-89 WFM-15 — `cms-tag-batch`
 * FOR_EACH tagCodes → cms.tag-link on a real cms_contents row.
 * Run: `npx tsx scripts/seed-workflow-machines/cms-tag-batch.ts`
 */
import { Pool } from 'pg';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  baseModel, endNode, actionNode, unconditionalEdge, forEachNode,
  lit, workflowInputPath, currentItem, errorEdge, nodeOutput,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd,
  bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'cms-tag-batch';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS tag batch',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          contentId: { type: 'integer' },
          tagCodes: { type: 'array', items: { type: 'string' } },
        },
        required: ['contentId', 'tagCodes'],
      },
    },
    nodes: [
      actionNode('load-content', {
        actionRef: ACTION('cms.content-get'),
        input: {
          type: 'OBJECT',
          fields: { contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) } },
        },
        retryPolicy: NO_RETRY,
      }),
      forEachNode('link-tags', {
        items: workflowInputPath(['tagCodes']),
        actionRef: ACTION('cms.tag-link'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            tagCode: { type: 'EXPRESSION', expression: currentItem() },
          },
        },
        maxConcurrency: 2,
        joinMode: 'ALL',
        retryPolicy: NO_RETRY,
      }),
      endNode('end-tagged', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('TAGGED') },
          contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
          title: { type: 'EXPRESSION', expression: nodeOutput('load-content', ['title']) },
        },
      }),
      endNode('end-load-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('LOAD_FAILED') } },
      }),
      endNode('end-tag-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('TAG_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-content', 'end-load-failed'),
      unconditionalEdge('e-load-tags', 'load-content', 'link-tags'),
      errorEdge('e-tag-err', 'link-tags', 'end-tag-failed'),
      unconditionalEdge('e-tag-done', 'link-tags', 'end-tagged'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-content' },
  });
}

async function resolveContentAndTags(): Promise<{ contentId: number; tagCodes: string[] }> {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') throw new Error('need PostgreSQL CMS');
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });
  try {
    const content = await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM cms_contents ORDER BY id ASC LIMIT 1`,
    );
    const contentId = content.rows[0]?.id ? Number(content.rows[0].id) : null;
    if (!contentId) throw new Error('no cms_contents');

    const tags = await pool.query<{ id: string }>(
      `SELECT item.id
       FROM base_info root
       JOIN base_info category ON category.parent_id = root.id AND category.title_en = 'Content Tags'
       JOIN base_info item ON item.parent_id = category.id
       WHERE root.parent_id IS NULL AND root.title_en = 'CMS'
       ORDER BY item.view_order ASC
       LIMIT 2`,
    );
    const tagCodes = tags.rows.map((r) => r.id);
    if (tagCodes.length === 0) throw new Error('CMS Content Tags missing — run CMS Phase 1 seed.');
    return { contentId, tagCodes };
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  const { contentId, tagCodes } = await resolveContentAndTags();
  console.log(`[seed] linking tags ${tagCodes.join(', ')} → cms_contents#${contentId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { contentId, tagCodes },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-15');
  await assertEnd(instance.id, 'end-tagged');
  console.log(`[seed] tags linked on cms_contents#${contentId}.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
