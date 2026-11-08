/**
 * p-89 WFM-14 — `cms-asset-attach-on-approve`
 * Write a small file in FileManager → ADMIN WI → file.read → cms.asset-create.
 * Run: `npx tsx scripts/seed-workflow-machines/cms-asset-attach-on-approve.ts`
 */
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import {
  baseModel, endNode, actionNode, unconditionalEdge, workItemNode, workItemOutcomeEdge,
  lit, workflowInputPath, nodeOutput, errorEdge, workflowVariable,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, pickRoleMembers,
  dispatchUntilKey, completeWi, drainAutomated, assertEnd, bootWorkflowMachineSeed,
} from './_seedHelpers';

const KEY = 'cms-asset-attach-on-approve';
const FILE_PATH = 'workspace/wfm-14-asset.txt';
const FILE_BODY = 'WFM-14 CMS asset attachment payload\n';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS asset attach on approve',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          contentId: { type: 'integer' },
          actorUserId: { type: 'integer' },
          filePath: { type: 'string' },
          fileName: { type: 'string' },
          fileMime: { type: 'string' },
        },
        required: ['contentId', 'actorUserId', 'filePath', 'fileName', 'fileMime'],
      },
    },
    variables: [
      { key: 'title', schema: { type: 'INLINE', schema: {} } },
      { key: 'fileBase64', schema: { type: 'INLINE', schema: {} } },
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
      actionNode('stage-file', {
        actionRef: ACTION('file.write'),
        input: {
          type: 'OBJECT',
          fields: {
            path: { type: 'EXPRESSION', expression: workflowInputPath(['filePath']) },
            content: { type: 'EXPRESSION', expression: lit(FILE_BODY) },
            encoding: { type: 'EXPRESSION', expression: lit('utf8') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      workItemNode('editor-approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('Approve CMS asset attachment'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            title: { type: 'EXPRESSION', expression: workflowVariable('title') },
            fileName: { type: 'EXPRESSION', expression: workflowInputPath(['fileName']) },
          },
        },
      }),
      actionNode('read-file', {
        actionRef: ACTION('file.read'),
        input: {
          type: 'OBJECT',
          fields: {
            path: { type: 'EXPRESSION', expression: workflowInputPath(['filePath']) },
            encoding: { type: 'EXPRESSION', expression: lit('base64') },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'fileBase64', value: nodeOutput('read-file', ['content']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('attach-asset', {
        actionRef: ACTION('cms.asset-create'),
        input: {
          type: 'OBJECT',
          fields: {
            contentId: { type: 'EXPRESSION', expression: workflowInputPath(['contentId']) },
            fileName: { type: 'EXPRESSION', expression: workflowInputPath(['fileName']) },
            fileMime: { type: 'EXPRESSION', expression: workflowInputPath(['fileMime']) },
            fileBase64: { type: 'EXPRESSION', expression: workflowVariable('fileBase64') },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-attached', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('ATTACHED') },
          assetId: { type: 'EXPRESSION', expression: nodeOutput('attach-asset', ['id']) },
          sha256: { type: 'EXPRESSION', expression: nodeOutput('attach-asset', ['sha256']) },
        },
      }),
      endNode('end-rejected', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('REJECTED') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-content', 'end-failed'),
      unconditionalEdge('e-load-stage', 'load-content', 'stage-file'),
      errorEdge('e-stage-err', 'stage-file', 'end-failed'),
      unconditionalEdge('e-stage-wi', 'stage-file', 'editor-approve'),
      workItemOutcomeEdge('e-approve', 'editor-approve', 'read-file', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'editor-approve', 'end-rejected', 'REJECT'),
      errorEdge('e-read-err', 'read-file', 'end-failed'),
      unconditionalEdge('e-read-attach', 'read-file', 'attach-asset'),
      errorEdge('e-attach-err', 'attach-asset', 'end-failed'),
      unconditionalEdge('e-attach-done', 'attach-asset', 'end-attached'),
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
  const expectedSha = createHash('sha256').update(FILE_BODY, 'utf8').digest('hex');
  console.log(`[seed] attach asset to cms_contents#${contentId} (sha256=${expectedSha.slice(0, 12)}…)`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: {
      contentId,
      actorUserId: admin.userId,
      filePath: FILE_PATH,
      fileName: 'wfm-14-asset.txt',
      fileMime: 'text/plain',
    },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-14');
  const wi = await dispatchUntilKey(instance.id, 'editor-approve', 'seed-wfm-14');
  if (!wi) throw new Error('editor-approve missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-14');
  await assertEnd(instance.id, 'end-attached');
  console.log(`[seed] asset attached to cms_contents#${contentId}.`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
