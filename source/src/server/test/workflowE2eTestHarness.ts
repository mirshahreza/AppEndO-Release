import { Pool } from 'pg';
import { toPgPoolConfig } from '../config/env';
import { initControlPlanePool, closeControlPlanePool } from '../db/controlPlane';
import { bindPrismaToPgPool, closePrismaControlPlane } from '../db/prismaControlPlane';
import {
  createWorkflowDefinition,
  type CreateWorkflowDefinitionInput,
} from '../domain/workflow/workflowDefinitionRepository';

export { isDatabaseReachable } from './authE2eTestHarness';

/** Minimal workflow definition fixture for real-DB workflow tests. */
export function createTestWorkflowDefinitionInput(
  input: Pick<CreateWorkflowDefinitionInput, 'key' | 'draftDefinitionJson'>,
): CreateWorkflowDefinitionInput {
  return {
    scopeKey: 'global',
    creationMode: 'NEW',
    ...input,
  };
}

export async function createTestWorkflowDefinition(
  input: Pick<CreateWorkflowDefinitionInput, 'key' | 'draftDefinitionJson'>,
) {
  return createWorkflowDefinition(createTestWorkflowDefinitionInput(input));
}

/**
 * Minimal real-DB bootstrap for Workflow Slice 1 storage-invariant tests — Workflow tables are
 * Prisma-native (`prisma db push`), so unlike `authE2eTestHarness`'s `bootstrapAuthE2eEnvironment`
 * this skips `ensureControlPlaneInitialized`/settings-cache bootstrap (legacy raw-SQL DDL for
 * `base_*` tables) and only binds a pooled Prisma client.
 */
export async function bootstrapWorkflowE2eEnvironment(): Promise<{ pool: Pool }> {
  const pool = new Pool(toPgPoolConfig());
  initControlPlanePool(pool);
  await pool.query('SELECT 1');
  await bindPrismaToPgPool(pool);
  return { pool };
}

export async function shutdownWorkflowE2eEnvironment(pool: Pool): Promise<void> {
  await closePrismaControlPlane();
  await closeControlPlanePool(pool);
}
