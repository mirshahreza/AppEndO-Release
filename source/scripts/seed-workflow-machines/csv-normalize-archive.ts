/**
 * p-89 WFM-08 — `csv-normalize-archive`
 * CSV text in input → data.csv-parse → data.csv-stringify → file.write.
 * Run: `npx tsx scripts/seed-workflow-machines/csv-normalize-archive.ts`
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
import { ACTION, NO_RETRY, ensurePublished, pickUnlockedUser, drainAutomated, assertEnd } from './_seedHelpers';

const KEY = 'csv-normalize-archive';

function buildModel(): WorkflowModel {
  return baseModel({
    key: KEY,
    name: 'CSV normalize archive',
    inputSchema: {
      type: 'INLINE',
      schema: {
        type: 'object',
        properties: { csvText: { type: 'string' } },
        required: ['csvText'],
      },
    },
    variables: [
      { key: 'records', schema: { type: 'INLINE', schema: {} } },
      { key: 'normalizedCsv', schema: { type: 'INLINE', schema: {} } },
    ],
    nodes: [
      actionNode('parse-csv', {
        actionRef: ACTION('data.csv-parse'),
        input: {
          type: 'OBJECT',
          fields: { text: { type: 'EXPRESSION', expression: workflowInputPath(['csvText']) } },
        },
        outputAssignments: [{ targetVariableKey: 'records', value: nodeOutput('parse-csv', ['records']) }],
        retryPolicy: NO_RETRY,
      }),
      actionNode('stringify-csv', {
        actionRef: ACTION('data.csv-stringify'),
        input: {
          type: 'OBJECT',
          fields: { records: { type: 'EXPRESSION', expression: workflowVariable('records') } },
        },
        outputAssignments: [{ targetVariableKey: 'normalizedCsv', value: nodeOutput('stringify-csv', ['text']) }],
        retryPolicy: NO_RETRY,
      }),
      actionNode('write-csv', {
        actionRef: ACTION('file.write'),
        input: {
          type: 'OBJECT',
          fields: {
            path: { type: 'EXPRESSION', expression: lit('workspace/normalized-batch.csv') },
            content: { type: 'EXPRESSION', expression: workflowVariable('normalizedCsv') },
          },
        },
        retryPolicy: NO_RETRY,
      }),
      endNode('end-normalized', {
        type: 'OBJECT',
        fields: { outcome: { type: 'EXPRESSION', expression: lit('NORMALIZED') } },
      }),
    ],
    edges: [
      unconditionalEdge('e1', 'parse-csv', 'stringify-csv'),
      unconditionalEdge('e2', 'stringify-csv', 'write-csv'),
      unconditionalEdge('e3', 'write-csv', 'end-normalized'),
    ],
    start: { type: 'MANUAL_API', targetNodeKey: 'parse-csv' },
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
    input: { csvText: 'name,note\r\n"Doe, John","He said ""hi"""\r\nJane,plain\r\n' },
    startedByType: 'USER',
    startedById: user.userId,
  });
  console.log(`[seed] instance #${instance.id}`);
  await drainAutomated(instance.id, 'seed-wfm-08');
  await assertEnd(instance.id, 'end-normalized');
}

main().catch((e) => { console.error('[seed] failed:', e); process.exitCode = 1; });
