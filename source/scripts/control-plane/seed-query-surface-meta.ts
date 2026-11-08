/**
 * Merge query-surface defaults (searchRole, filterRole, named presets) into every Edge model studio-meta.
 *
 *   npx tsx scripts/control-plane/seed-query-surface-meta.ts
 */

import { buildQuerySurfaceStudioMetaUpsert } from '../../src/server/domain/data-api/mergeQuerySurfaceStudioMeta';
import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import {
  getEdgeModelStudioMeta,
  upsertEdgeModelStudioMeta,
} from '../../src/server/services/data-api/edgeModelStudioMetaStore';
import { ensureEdgeModelStudioMetaStoreDirs } from '../../src/server/services/data-api/edgeModelStudioMetaStore';

const main = (): void => {
  ensureEdgeModelStudioMetaStoreDirs();
  const models = listEdgeModels();
  let updated = 0;
  for (const model of models) {
    const meta = getEdgeModelStudioMeta(model.id);
    const patch = buildQuerySurfaceStudioMetaUpsert(model, meta);
    upsertEdgeModelStudioMeta(model.id, patch);
    updated += 1;
    console.log(`[query-surface-meta] ${model.objectName} (${model.id})`);
  }
  console.log(`[query-surface-meta] Updated ${updated} models.`);
};

main();
