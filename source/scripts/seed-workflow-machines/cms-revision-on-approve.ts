/**
 * p-89 WFM-13 — `cms-revision-on-approve`
 * Load content → ADMIN approve → cms.revision-create snapshot.
 * Run: `npx tsx scripts/seed-workflow-machines/cms-revision-on-approve.ts`
 */
import { Pool } from 'pg';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, workflowVariable, nodeOutput, errorEdge,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'cms-revision-on-approve';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS revision on approve',
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
      { key: 'revisionId', schema: { type: 'INLINE', schema: {} } },
      { key: 'revisionNo', schema: { type: 'INLINE', schema: {} } },
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
      workItemNode('editor-approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve CMS content revision snapshot'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            title: { type: 'EXPRESSION', expression: workflowVariable('title') },
          },
        },
      }),
      actionNode('create-revision', {
        actionRef: ACTION('cms.revision-create'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'revisionId', value: nodeOutput('create-revision', ['id']) },
          { targetVariableKey: 'revisionNo', value: nodeOutput('create-revision', ['revisionNo']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      endNode('end-revisioned', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('REVISION_CREATED') },
          contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
          revisionId: { type: 'EXPRESSION', expression: workflowVariable('revisionId') },
          revisionNo: { type: 'EXPRESSION', expression: workflowVariable('revisionNo') },
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
      endNode('end-revision-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REVISION_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-content', 'end-load-failed'),
      unconditionalEdge('e-load-wi', 'load-content', 'editor-approve'),
      workItemOutcomeEdge('e-approve', 'editor-approve', 'create-revision', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'editor-approve', 'end-rejected', 'REJECT'),
      errorEdge('e-rev-err', 'create-revision', 'end-revision-failed'),
      unconditionalEdge('e-rev-done', 'create-revision', 'end-revisioned'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-content' },
  });
}

async function pickContentId(): Promise<number> {
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
    const row = await pool.query<{ id: string }>(`SELECT id::text AS id FROM cms_contents ORDER BY id ASC LIMIT 1`);
    const id = row.rows[0]?.id ? Number(row.rows[0].id) : null;
    if (!id) throw new Error('no cms_contents');
    return id;
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  const contentId = await pickContentId();
  console.log(`[seed] revision snapshot for cms_contents#${contentId}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { contentId, actorUserId: admin.userId },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-13');
  const wi = await dispatchUntilKey(instance.id, 'editor-approve', 'seed-wfm-13');
  if (!wi) throw new Error('editor-approve missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-13');
  await assertEnd(instance.id, 'end-revisioned');
  console.log(`[seed] revision created for cms_contents#${contentId}.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
