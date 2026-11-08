/**
 * Seed Data Studio Story markdown for platform control-plane (`base_*`) Edge models.
 *
 * Opt-in maintenance script — does not run on app bootstrap.
 * Import/refresh also fills empty catalog stories automatically.
 *
 * Usage:
 *   npm run control-plane:seed-studio-meta
 */

import { listEdgeModels } from '../../src/server/services/data-api/edgeModelStore';
import { attachStudioMetaForEdgeModel } from '../../src/server/services/data-api/edgeModelStudioMetaAttach';
import {
  BASE_STUDIO_META_OBJECT_NAMES,
  BASE_STUDIO_META_STORIES,
} from '../../src/server/services/data-api/baseModelStudioStories';

const main = (): void => {
  const modelsByName = new Map(
    listEdgeModels()
      .filter((model) => model.objectName?.startsWith('base_'))
      .map((model) => [model.objectName, model] as const),
  );

  const missingModels = BASE_STUDIO_META_OBJECT_NAMES.filter((name) => !modelsByName.has(name));
  if (missingModels.length > 0) {
    console.warn(
      `[control-plane studio-meta] No edge model yet (${missingModels.length}): ${missingModels.join(', ')}`,
    );
    console.warn('[control-plane studio-meta] Import or Sync those tables; Story attaches automatically.');
  }

  const extraModels = [...modelsByName.keys()]
    .filter((name) => !BASE_STUDIO_META_STORIES[name])
    .sort();
  if (extraModels.length > 0) {
    console.warn('[control-plane studio-meta] No story catalog for edge models:', extraModels.join(', '));
  }

  const seeded: string[] = [];
  for (const model of modelsByName.values()) {
    attachStudioMetaForEdgeModel(model);
    seeded.push(`${model.objectName} (${model.id})`);
  }

  console.log(`[control-plane studio-meta] Attached Story catalog for ${seeded.length} base models.`);
  for (const line of seeded) {
    console.log(`  ${line}`);
  }
};

main();
