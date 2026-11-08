/**
 * p-89 WFM-16 — `cms-relation-approve`
 * ADMIN WI → cms.relation-create between two real cms_contents rows.
 * Run: `npx tsx scripts/seed-workflow-machines/cms-relation-approve.ts`
 */
import { Pool } from 'pg';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'cms-relation-approve';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS relation approve',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          contentIdA: { type: 'integer' },
          contentIdB: { type: 'integer' },
          note: { type: 'string' },
        },
        required: ['contentIdA', 'contentIdB'],
      },
    },
    nodes: [
      actionNode('load-a', {
        actionRef: ACTION('cms.content-get'),
        input: {
          type: 'OBJECT',
          fields: { contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentIdA']) } },
        },
        retryPolicy: NO_RETRY,
      }),
      actionNode('load-b', {
        actionRef: ACTION('cms.content-get'),
        input: {
          type: 'OBJECT',
          fields: { contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentIdB']) } },
        },
        retryPolicy: NO_RETRY,
      }),
      workItemNode('editor-approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve CMS content relation'),
        input: {
          type: 'OBJECT',
          fields: {
            contentIdA: { type: 'EXPRESSION', expression: workflowInputPath(['contentIdA']) },
            titleA: { type: 'EXPRESSION', expression: nodeOutput('load-a', ['title']) },
            contentIdB: { type: 'EXPRESSION', expression: workflowInputPath(['contentIdB']) },
            titleB: { type: 'EXPRESSION', expression: nodeOutput('load-b', ['title']) },
            note: { type: 'EXPRESSION', expression: workflowInputPath(['note']) },
          },
        },
      }),
      actionNode('create-relation', {
        actionRef: ACTION('cms.relation-create'),
        input: {
          type: 'OBJECT',
          fields: {
            contentIdA: { type: 'EXPRESSION', expression: workflowInputPath(['contentIdA']) },
            contentIdB: { type: 'EXPRESSION', expression: workflowInputPath(['contentIdB']) },
            note: { type: 'EXPRESSION', expression: workflowInputPath(['note']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-related', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('RELATED') },
          relationId: { type: 'EXPRESSION', expression: nodeOutput('create-relation', ['id']) },
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
      endNode('end-create-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('CREATE_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-a-err', 'load-a', 'end-load-failed'),
      unconditionalEdge('e-a-b', 'load-a', 'load-b'),
      errorEdge('e-b-err', 'load-b', 'end-load-failed'),
      unconditionalEdge('e-b-wi', 'load-b', 'editor-approve'),
      workItemOutcomeEdge('e-approve', 'editor-approve', 'create-relation', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'editor-approve', 'end-rejected', 'REJECT'),
      errorEdge('e-rel-err', 'create-relation', 'end-create-failed'),
      unconditionalEdge('e-rel-done', 'create-relation', 'end-related'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-a' },
  });
}

async function pickTwoContents(): Promise<{ a: number; b: number }> {
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
    const rows = await pool.query<{ id: string }>(
      `SELECT id::text AS id FROM cms_contents ORDER BY id ASC LIMIT 2`,
    );
    if (rows.rows.length < 2) throw new Error('need at least 2 cms_contents rows');
    return { a: Number(rows.rows[0]!.id), b: Number(rows.rows[1]!.id) };
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  const { a, b } = await pickTwoContents();
  console.log(`[seed] relating cms_contents#${a} ↔ #${b}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { contentIdA: a, contentIdB: b, note: 'WFM-16 live relation' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-16');
  const wi = await dispatchUntilKey(instance.id, 'editor-approve', 'seed-wfm-16');
  if (!wi) throw new Error('editor-approve missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-16');
  await assertEnd(instance.id, 'end-related');
  console.log('[seed] relation created.');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
