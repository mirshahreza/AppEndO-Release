/**
 * p-89 WFM-07 — `evidence-hash-archive`
 * file.write sample → file.read → crypto.hash → file.write sidecar JSON.
 * Run: `npx tsx scripts/seed-workflow-machines/evidence-hash-archive.ts`
 */
import { initPrismaControlPlane } from '../../src/server/db/prismaControlPlane';
import { SETTINGS_PATH } from '../../src/server/config/settingsFile';
import { registerCoreActionPack } from '../../src/server/domain/workflow/actions/corePack';
import { startWorkflowInstance } from '../../src/server/domain/workflow/engine/startService';
import type { WorkflowModel } from '../../src/server/domain/workflow/awm/types';
import {
  baseModel, endNode, actionNode, unconditionalEdge, lit, workflowInputPath,
  workflowVariable, nodeOutput,
} from '../../src/server/domain/workflow/engine/__tests__/fixtures';
import { ACTION, NO_RETRY, templateInput, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd } from './_seedHelpers';

const KEY = 'evidence-hash-archive';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'Evidence hash archive',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: {
          caseRef: { type: 'string' },
          evidenceText: { type: 'string' },
        },
        required: ['caseRef', 'evidenceText'],
      },
    },
    variables: [
      { key: 'evidencePath', schema: { type: 'INLINE', schema: {} } },
      { key: 'digest', schema: { type: 'INLINE', schema: {} } },
      { key: 'sidecarBody', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('write-evidence', {
        actionRef: ACTION('file.write'),
        input: {
          type: 'OBJECT',
          fields: {
            path: { type: 'EXPRESSION', expression: lit('workspace/evidence-case.txt') },
            content: { type: 'EXPRESSION', expression: workflowInputPath(['evidenceText']) },
          },
        },
        outputAssignments: [{ targetVariableKey: 'evidencePath', value: nodeOutput('write-evidence', ['path']) }],
        retryPolicy: NO_RETRY,
      }),
      actionNode('read-evidence', {
        actionRef: ACTION('file.read'),
        input: {
          type: 'OBJECT',
          fields: { path: { type: 'EXPRESSION', expression: workflowVariable('evidencePath') } },
        },
        retryPolicy: NO_RETRY,
      }),
      actionNode('hash-evidence', {
        actionRef: ACTION('crypto.hash'),
        input: {
          type: 'OBJECT',
          fields: {
            data: { type: 'EXPRESSION', expression: nodeOutput('read-evidence', ['content']) },
            algorithm: { type: 'EXPRESSION', expression: lit('sha256') },
          },
        },
        outputAssignments: [{ targetVariableKey: 'digest', value: nodeOutput('hash-evidence', ['digest']) }],
        retryPolicy: NO_RETRY,
      }),
      actionNode('sidecar-json', {
        actionRef: ACTION('text.template'),
        input: templateInput('{"caseRef":"{{caseRef}}","path":"{{path}}","sha256":"{{digest}}"}', {
          caseRef: workflowInputPath(['caseRef']),
          path: workflowVariable('evidencePath'),
          digest: workflowVariable('digest'),
        }),
        outputAssignments: [{ targetVariableKey: 'sidecarBody', value: nodeOutput('sidecar-json', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      actionNode('write-sidecar', {
        actionRef: ACTION('file.write'),
        input: {
          type: 'OBJECT',
          fields: {
            path: { type: 'EXPRESSION', expression: lit('workspace/evidence-case.sha256.json') },
            content: { type: 'EXPRESSION', expression: workflowVariable('sidecarBody') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-archived', {
        type: 'OBJECT',
        fields: {
          outcome: { type: 'EXPRESSION', expression: lit('ARCHIVED') },
          digest: { type: 'EXPRESSION', expression: workflowVariable('digest') },
        },
      }),
    ],
    edges: [
      unconditionalEdge('e1', 'write-evidence', 'read-evidence'),
      unconditionalEdge('e2', 'read-evidence', 'hash-evidence'),
      unconditionalEdge('e3', 'hash-evidence', 'sidecar-json'),
      unconditionalEdge('e4', 'sidecar-json', 'write-sidecar'),
      unconditionalEdge('e5', 'write-sidecar', 'end-archived'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'write-evidence' },
  });
}

async function main() {
  await initPrismaControlPlane(SETTINGS_PATH);
  registerCoreActionPack();
  const { revisionId } = await ensurePublished(KEY, buildModel());
  const user = await pickUnlockedUser();
  if (!user) throw new Error('no user');
  const { instance } = await startWorkflowInstance({
    workflowRevisionId: revisionId,
    input: { caseRef: 'CASE-42', evidenceText: 'Signed retention attestation for CASE-42.' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-07');
  await assertEnd(instance.id, 'end-archived');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
