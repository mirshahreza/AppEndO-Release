/**
 * p-89 WFM-18 — `cms-digest-email`
 * cms.settings-get + content titles via data.db-query → template → FOR_EACH email to ADMIN.
 * Run: `npx tsx scripts/seed-workflow-machines/cms-digest-email.ts`
 */
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { getDataSourcesFromSettings } from '../../src/server/db/dataSourcesStore';
import { listNodeInstancesForInstance } from '../../src/server/domain/workflow/workflowNodeInstanceRepository';
import {
  baseModel, endNode, actionNode, unconditionalEdge, forEachNode,
  decisionNode, decisionEdge, decisionDefaultEdge,
  lit, workflowInputPath, nodeOutput, currentItem, errorEdge, workflowVariable,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import {
  ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd,
  bootWorkflowMachineSeed, templateInput,
} from './_seedHelpers';

const KEY = 'cms-digest-email';

function buildModel(dataSourceId: string): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CMS digest email',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: { roleName: { type: 'string' } },
        required: ['roleName'],
      },
    },
    variables: [
      { key: 'contentCount', schema: { type: 'INLINE', schema: {} } },
      { key: 'cacheTtl', schema: { type: 'INLINE', schema: {} } },
      { key: 'body', schema: { type: 'INLINE', schema: {} } },
      { key: 'emails', schema: { type: 'INLINE', schema: {} } },
      { key: 'memberCount', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('load-settings', {
        actionRef: ACTION('cms.settings-get'),
        input: { type: 'OBJECT', fields: {} },
        outputAssignments: [
          { targetVariableKey: 'cacheTtl', value: nodeOutput('load-settings', ['publicCacheTtlSeconds']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('query-contents', {
        actionRef: ACTION('data.db-query'),
        config: {
          type: 'OBJECT',
          fields: {
            dataSourceId: { type: 'EXPRESSION', expression: lit(dataSourceId) },
          },
        },
        input: {
          type: 'OBJECT',
          fields: {
            sql: {
              type: 'EXPRESSION',
              expression: lit('SELECT id::text AS id, title FROM cms_contents ORDER BY id ASC LIMIT 20'),
            },
            params: { type: 'EXPRESSION', expression: lit([]) },
          },
        },
        outputAssignments: [
          { targetVariableKey: 'contentCount', value: nodeOutput('query-contents', ['count']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('build-body', {
        actionRef: ACTION('text.template'),
        input: templateInput(
          'CMS digest: {{contentCount}} content(s). Public cache TTL={{cacheTtl}}s.',
          {
            contentCount: workflowVariable('contentCount'),
            cacheTtl: workflowVariable('cacheTtl'),
          },
        ),
        outputAssignments: [
          { targetVariableKey: 'body', value: nodeOutput('build-body', ['text']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      actionNode('load-members', {
        actionRef: ACTION('identity.role-members'),
        input: {
          type: 'OBJECT',
          fields: { roleName: { type: 'EXPRESSION', expression: workflowInputPath(['roleName']) } },
        },
        outputAssignments: [
          { targetVariableKey: 'emails', value: nodeOutput('load-members', ['emails']) },
          { targetVariableKey: 'memberCount', value: nodeOutput('load-members', ['count']) },
        ],
        retryPolicy: NO_RETRY,
      }),
      decisionNode('d-has-emails', 'EXACT_ONE'),
      forEachNode('send-each', {
        items: nodeOutput('load-members', ['emails']),
        actionRef: ACTION('communication.email-send'),
        input: {
          type: 'OBJECT',
          fields: {
            to: { type: 'EXPRESSION', expression: currentItem() },
            subject: { type: 'EXPRESSION', expression: lit('CMS content digest') },
            text: { type: 'EXPRESSION', expression: workflowVariable('body') },
          },
        },
        maxConcurrency: 2,
        joinMode: 'ALL',
        retryPolicy: NO_RETRY,
      }),
      endNode('end-sent', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('SENT') },
          contentCount: { type: 'EXPRESSION', expression: workflowVariable('contentCount') },
          memberCount: { type: 'EXPRESSION', expression: workflowVariable('memberCount') },
        },
      }),
      endNode('end-no-emails', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('NO_EMAILS') } },
      }),
      endNode('end-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('FAILED') } },
      }),
      endNode('end-send-failed', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('SEND_FAILED') } },
      }),
    ],
    edges: [
      errorEdge('e-settings-err', 'load-settings', 'end-failed'),
      unconditionalEdge('e-settings-q', 'load-settings', 'query-contents'),
      errorEdge('e-query-err', 'query-contents', 'end-failed'),
      unconditionalEdge('e-query-body', 'query-contents', 'build-body'),
      errorEdge('e-body-err', 'build-body', 'end-failed'),
      unconditionalEdge('e-body-members', 'build-body', 'load-members'),
      errorEdge('e-members-err', 'load-members', 'end-failed'),
      unconditionalEdge('e-members-dec', 'load-members', 'd-has-emails'),
      decisionEdge('e-has-emails', 'd-has-emails', 'send-each', {
        op: 'GT',
        left: workflowVariable('memberCount'),
        right: lit(0),
      }),
      decisionDefaultEdge('e-no-emails', 'd-has-emails', 'end-no-emails'),
      errorEdge('e-send-err', 'send-each', 'end-send-failed'),
      unconditionalEdge('e-send-done', 'send-each', 'end-sent'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'load-settings' },
  });
}

async function main() {
  await bootWorkflowMachineSeed();
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const source = sources.find((s) => s.isDefault) ?? sources[0];
  if (!source || source.type !== 'PostgreSQL') throw new Error('need PostgreSQL data source');
  const { revisionId } = await ensurePublished(KEY, buildModel(source.id));
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { roleName: 'ADMIN' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-18');
  const nodes = await listNodeInstancesForInstance(instance.id);
  if (nodes.some((n) => n.semanticNodeKey === 'end-sent' && n.status === 'SUCCEEDED')) {
    console.log('[seed] CMS digest emailed.');
    return;
  }
  if (nodes.some((n) => n.semanticNodeKey === 'end-send-failed' && n.status === 'SUCCEEDED')) {
    console.log('[seed] CMS digest built + FOR_EACH ran; SMTP timed out — machine published (env gap).');
    process.exitCode = 2;
    return;
  }
  await assertEnd(instance.id, 'end-sent');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
