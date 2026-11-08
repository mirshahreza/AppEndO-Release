/**
 * p-89 WFM-17 — `cms-settings-change-cab`
 * Load CMS settings → ADMIN CAB approve → cms.settings-update (TTL patch).
 * Run: `npx tsx scripts/seed-workflow-machines/cms-settings-change-cab.ts`
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

const KEY = 'cms-settings-change-cab';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS settings change CAB',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          publicCacheTtlSeconds: { type: 'integer' },
          actorUserId: { type: 'integer' },
        },
        required: ['publicCacheTtlSeconds', 'actorUserId'],
      },
    },
    variables: [
      { key: 'currentTtl', schema: { type: 'INLINE', schema: {} } },
      { key: 'newTtl', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('load-settings', {
        actionRef: ACTION('cms.settings-get'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'currentTtl', value: nodeOutput('load-settings', ['publicCacheTtlSeconds']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      workItemNode('cab-approve', {
        workItemType: 'APPROVAL',
        assignment: { strategy: 'ROLE', roleId: 'ADMIN' },
        allowedOutcomes: ['APPROVE', 'REJECT'],
        title: lit('CAB: approve CMS public cache TTL change'),
        input: {
          type: 'OBJECT',
          fields: {
            currentTtl: { type: 'EXPRESSION', expression: workflowVariable('currentTtl') },
            proposedTtl: { type: 'EXPRESSION', expression: workflowInputPath(['publicCacheTtlSeconds']) },
          },
        },
      }),
      actionNode('apply-settings', {
        actionRef: ACTION('cms.settings-update'),
        input: {
          type: 'OBJECT',
          fields: {
            publicCacheTtlSeconds: { type: 'EXPRESSION', expression: workflowInputPath(['publicCacheTtlSeconds']) },
            actorUserId: { type: 'EXPRESSION', expression: workflowInputPath(['actorUserId']) },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'newTtl', value: nodeOutput('apply-settings', ['publicCacheTtlSeconds']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      endNode('end-applied', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('APPLIED') },
          publicCacheTtlSeconds: { type: 'EXPRESSION', expression: workflowVariable('newTtl') },
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
      endNode('end-apply-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('APPLY_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-load-err', 'load-settings', 'end-load-failed'),
      unconditionalEdge('e-load-wi', 'load-settings', 'cab-approve'),
      workItemOutcomeEdge('e-approve', 'cab-approve', 'apply-settings', 'APPROVE'),
      workItemOutcomeEdge('e-reject', 'cab-approve', 'end-rejected', 'REJECT'),
      errorEdge('e-apply-err', 'apply-settings', 'end-apply-failed'),
      unconditionalEdge('e-apply-done', 'apply-settings', 'end-applied'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-settings' },
  });
}

async function readTtl(): Promise<number> {
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
    const row = await pool.query<{ ttl: number }>(
      `SELECT public_cache_ttl_seconds::int AS ttl FROM cms_settings WHERE id = 1`,
    );
    const ttl = row.rows[0]?.ttl;
    if (typeof ttl !== 'number') throw new Error('cms_settings missing');
    return ttl;
  } finally {
    await pool.end();
  }
}

async function main() {
  await bootWorkflowMachineSeed();
  const current = await readTtl();
  const proposed = current === 300 ? 301 : 300;
  console.log(`[seed] CAB TTL ${current} → ${proposed}`);
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const admin = (await pickRoleMembers('ADMIN', 1))[0];
  const user = await pickUnlockedUser();
  if (!admin || !user) throw new Error('need ADMIN + user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { publicCacheTtlSeconds: proposed, actorUserId: admin.userId },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-17');
  const wi = await dispatchUntilKey(instance.id, 'cab-approve', 'seed-wfm-17');
  if (!wi) throw new Error('cab-approve missing');
  await completeWi(wi.id, admin.userId, 'APPROVE');
  await drainAutomated(instance.id, 'seed-wfm-17');
  await assertEnd(instance.id, 'end-applied');
  const after = await readTtl();
  if (after !== proposed) throw new Error(`expected ttl ${proposed}, got ${after}`);
  console.log(`[seed] cms_settings.public_cache_ttl_seconds = ${after}`);
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
