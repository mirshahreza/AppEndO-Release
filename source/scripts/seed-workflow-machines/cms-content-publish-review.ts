/**
 * p-89 WFM-11 — `cms-content-publish-review`
 * Load draft CMS content → ADMIN Work Item → on APPROVE set status=published (+ publishedAt).
 * Requires CMS Phase 1+2 (cms_contents + published cms-contents Edge API).
 * Run: `npx tsx scripts/seed-workflow-machines/cms-content-publish-review.ts`
 */
import { Pool } from 'pg';
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd,
} from './_seedHelpers';

const KEY = 'cms-content-publish-review';

function buildModel(publishedStatusCode: string): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS content publish review',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          contentId: { type: 'integer' },
          actorUserId: { type: 'integer' },
          reviewerNote: { type: 'string' },
        },
        required: ['contentId', 'actorUserId'],
      },
    },
    variables: [
      { key: 'title', schema: { type: 'INLINE', schema: {} } },
      { key: 'slug', schema: { type: 'INLINE', schema: {} } },
      { key: 'statusCode', schema: { type: 'INLINE', schema: {} } },
      { key: 'publishedAtIso', schema: { type: 'INLINE', schema: {} } },
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
          { targetVariableKey: 'slug', value: nodeOutput('load-content', ['slug']) },
          { targetVariableKey: 'statusCode', value: nodeOutput('load-content', ['statusCode']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('editor-review', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve CMS content for publish'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            title: { type: 'EXPRESSION', expression: workflowVariable('title') },
            slug: { type: 'EXPRESSION', expression: workflowVariable('slug') },
            statusCode: { type: 'EXPRESSION', expression: workflowVariable('statusCode') },
          },
        },
      }),
      actionNode('stamp-now', {
        actionRef: ACTION('date.now'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'publishedAtIso', value: nodeOutput('stamp-now', ['iso']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('publish-content', {
        actionRef: ACTION('cms.content-update'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            statusCode: { type: 'EXPRESSION', expression: lit(publishedStatusCode) },
            publishedAt: { type: 'EXPRESSION', expression: workflowVariable('publishedAtIso') },
            // Workflow ACTION dispatch uses SYSTEM identity; stamp a real user via payload.
            statusCodeUpdatedBy: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
            updatedBy: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        // No outputAssignments: ON_ERROR would otherwise fail resolving statusCode on the error object.
        retryPolicy: NO_RETRY,
      }),
      endNode('end-published', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('PUBLISHED') },
          contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
          statusCode: { type: 'EXPRESSION', expression: nodeOutput('publish-content', ['statusCode']) },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-load-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('LOAD_FAILED') } },
      }),
      endNode('end-publish-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('PUBLISH_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-content', 'end-load-failed'),
      unconditionalEdge('e-load-review', 'load-content', 'editor-review'),
      workItemOutcomeEdge('e-approve', 'editor-review', 'stamp-now', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'editor-review', 'end-rejected', 'REJECT'),
      unconditionalEdge('e-stamp-pub', 'stamp-now', 'publish-content'),
      errorEdge('e-pub-err', 'publish-content', 'end-publish-failed'),
      unconditionalEdge('e-pub-done', 'publish-content', 'end-published'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-content' },
  });
}

async function resolveDraftContent(): Promise<{ id: number; publishedStatusCode: string }> {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') {
    throw new Error('WFM-11 needs a default PostgreSQL data source with CMS tables.');
  }
  const pool = new Pool({
    host: source.host || 'localhost',
    port: Number(source.port) || 5432,
    user: source.username || 'postgres',
    password: source.password || '',
    database: source.database || 'AppEnd',
  });
  try {
    const status = await pool.query<{ id: string }>(
      `SELECT item.id
       FROM base_info root
       JOIN base_info category ON category.parent_id = root.id AND category.title_en = 'Statuses'
       JOIN base_info item ON item.parent_id = category.id AND item.short_name = $1
       WHERE root.parent_id IS NULL AND root.title_en = 'CMS'
       LIMIT 1`,
      ['published'],
    );
    const publishedStatusCode = status.rows[0]?.id;
    if (!publishedStatusCode) throw new Error('CMS status "published" missing in base_info — run CMS Phase 1 seed.');

    const draft = await pool.query<{ id: string }>(
      `SELECT c.id::text AS id
       FROM cms_contents c
       JOIN base_info st ON st.id = c.status_code AND st.short_name = 'draft'
       ORDER BY c.id ASC
       LIMIT 1`,
    );
    let contentId = draft.rows[0]?.id ? Number(draft.rows[0].id) : null;
    if (!contentId) {
      // Prefer known sample slug; create via Action path is covered by live run after ensure.
      const any = await pool.query<{ id: string }>(
        `SELECT id::text AS id FROM cms_contents ORDER BY id ASC LIMIT 1`,
      );
      contentId = any.rows[0]?.id ? Number(any.rows[0].id) : null;
    }
    if (!contentId) throw new Error('No cms_contents rows — run CMS sample seed first.');
    // Force draft so publish is a real write
    await pool.query(
      `UPDATE cms_contents c
       SET status_code = (
         SELECT item.id FROM base_info root
         JOIN base_info category ON category.parent_id = root.id AND category.title_en = 'Statuses'
         JOIN base_info item ON item.parent_id = category.id AND item.short_name = 'draft'
         WHERE root.parent_id IS NULL AND root.title_en = 'CMS' LIMIT 1
       ),
       published_at = NULL
       WHERE c.id = $1`,
      [contentId],
    );
    return { id: contentId, publishedStatusCode };
  } finally {
    await pool.end();
  }
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const { id: contentId, publishedStatusCode } = await resolveDraftContent();
  console.log(`[seed] using cms_contents#${contentId}; publish status=${publishedStatusCode}`);

  const { revisionId } = await ensurePublished(KEY, buildModel(publishedStatusCode));
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + unlocked user');

  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { contentId, actorUserId: admin.userId, reviewerNote: 'WFM-11 live publish review' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-11');

  const wi = await dispatchUntilKey(instance.id, 'editor-review', 'seed-wfm-11');
  if (!wi) throw new Error('editor-review Work Item not waiting');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-11');
  await assertEnd(instance.id, 'end-published');
  console.log(`[seed] published cms_contents#${contentId} via workflow.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
