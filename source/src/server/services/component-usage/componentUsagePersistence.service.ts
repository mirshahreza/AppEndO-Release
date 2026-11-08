import { createDbBatchQueue, type DbBatchQueue } from '../../../core/logging/DbBatchQueue';
import { DEFAULT_DB_BATCH_SETTINGS, normalizeDbBatchSettings } from '../../../core/logging/logPersistenceConfig';
import type { ComponentUsageHitKind } from '../../../shared/api/contracts/component-usage/hit';
import {
  getComponentUsageSummaryModel,
} from '../../domain/component-usage/componentUsageSequelizeModels';

export type ComponentUsageDelta = {
  componentName: string;
  kind: ComponentUsageHitKind;
  delta: number;
  lastHitAt: Date;
};

const coalesceMap = new Map<string, ComponentUsageDelta>();

let batcher: DbBatchQueue<ComponentUsageDelta> | null = null;

const coalesceKey = (componentName: string, kind: ComponentUsageHitKind): string => `${kind}\0${componentName}`;

const drainCoalesceIntoQueue = (): void => {
  if (!batcher || coalesceMap.size === 0) {
    return;
  }
  for (const delta of coalesceMap.values()) {
    batcher.enqueue(delta);
  }
  coalesceMap.clear();
};

const upsertUsageDelta = async (delta: ComponentUsageDelta): Promise<void> => {
  const Model = getComponentUsageSummaryModel();
  const now = new Date();
  const [row, created] = await Model.findOrCreate({
    where: {
      componentName: delta.componentName,
      kind: delta.kind,
    },
    defaults: {
      hitCount: delta.delta,
      lastHitAt: delta.lastHitAt,
      createdAt: now,
      updatedAt: now,
      createdBy: null,
      updatedBy: null,
    },
  });

  if (created) {
    return;
  }

  const previousLastHit = row.lastHitAt instanceof Date ? row.lastHitAt : new Date(row.lastHitAt);
  const nextLastHit = delta.lastHitAt > previousLastHit ? delta.lastHitAt : previousLastHit;
  const previousCount = Number(row.hitCount) || 0;

  await row.update({
    hitCount: previousCount + delta.delta,
    lastHitAt: nextLastHit,
    updatedAt: now,
  });
};

export const initComponentUsagePersistence = (): void => {
  if (batcher) {
    return;
  }

  const batch = normalizeDbBatchSettings({
    batchSize: DEFAULT_DB_BATCH_SETTINGS.batchSize,
    flushIntervalMs: 500,
    maxQueueSize: DEFAULT_DB_BATCH_SETTINGS.maxQueueSize,
  });

  batcher = createDbBatchQueue<ComponentUsageDelta>({
    batchSize: batch.batchSize,
    flushIntervalMs: batch.flushIntervalMs,
    maxQueueSize: batch.maxQueueSize,
    errorLabel: 'ComponentUsagePersistence',
    insertBatch: async (entries) => {
      for (const entry of entries) {
        await upsertUsageDelta(entry);
      }
    },
  });
  batcher.start();

  const coalesceTimer = setInterval(() => {
    drainCoalesceIntoQueue();
  }, 250);
  coalesceTimer.unref?.();
};

export const shutdownComponentUsagePersistence = async (): Promise<void> => {
  drainCoalesceIntoQueue();
  if (batcher) {
    await batcher.shutdown();
    batcher = null;
  }
  coalesceMap.clear();
};

export const flushComponentUsagePersistence = async (): Promise<void> => {
  drainCoalesceIntoQueue();
  await batcher?.flush();
};

export const recordComponentUsageHit = (input: {
  componentName: string;
  kind: ComponentUsageHitKind;
}): void => {
  const componentName = input.componentName.trim();
  if (!componentName || !batcher) {
    return;
  }

  const key = coalesceKey(componentName, input.kind);
  const now = new Date();
  const existing = coalesceMap.get(key);
  if (existing) {
    existing.delta += 1;
    existing.lastHitAt = now;
    return;
  }

  coalesceMap.set(key, {
    componentName,
    kind: input.kind,
    delta: 1,
    lastHitAt: now,
  });
};

export const lookupComponentUsageLastHits = async (
  componentNames: readonly string[],
  kind: ComponentUsageHitKind,
): Promise<Map<string, string | null>> => {
  const uniqueNames = [...new Set(componentNames.map((name) => name.trim()).filter(Boolean))];
  const result = new Map<string, string | null>();
  for (const name of uniqueNames) {
    result.set(name, null);
  }
  if (uniqueNames.length === 0) {
    return result;
  }

  const Model = getComponentUsageSummaryModel();
  const rows = await Model.findAll({
    where: {
      kind,
      componentName: uniqueNames,
    },
    attributes: ['componentName', 'lastHitAt'],
  });

  for (const row of rows) {
    const lastHit = row.lastHitAt instanceof Date ? row.lastHitAt : new Date(row.lastHitAt);
    result.set(row.componentName, lastHit.toISOString());
  }

  return result;
};
