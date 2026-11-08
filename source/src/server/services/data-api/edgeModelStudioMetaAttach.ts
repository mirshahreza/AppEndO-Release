import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import {
  MODEL_STORY_EXTENSION_KEY,
  isModelStoryEmpty,
  readModelStoryFromExtensions,
} from '../../../shared/lib/edgeModelStory';
import { BASE_STUDIO_META_STORIES } from './baseModelStudioStories';
import {
  bindEdgeModelStudioMeta,
  getEdgeModelStudioMeta,
  upsertEdgeModelStudioMeta,
} from './edgeModelStudioMetaStore';
import {
  getPlatformHistoryMark,
  isHistoryUnmarked,
} from '../../domain/record-events/platformHistoryMarks';

/**
 * Reattach parked studio-meta for this schema object, then fill empty Story
 * and empty history marks from the platform catalogs. Operator edits always win.
 */
export const attachStudioMetaForEdgeModel = (
  model: Pick<EdgeModelDefinition, 'id' | 'dataSourceId' | 'objectType' | 'objectName'>,
): void => {
  bindEdgeModelStudioMeta(model);
  const catalog = BASE_STUDIO_META_STORIES[model.objectName];
  const mark = getPlatformHistoryMark(model.objectName);
  const meta = getEdgeModelStudioMeta(model.id);

  if (catalog && isModelStoryEmpty(readModelStoryFromExtensions(meta.extensions))) {
    upsertEdgeModelStudioMeta(model.id, {
      extensions: {
        [MODEL_STORY_EXTENSION_KEY]: catalog,
      },
    });
  }

  const latest = getEdgeModelStudioMeta(model.id);
  if (mark && isHistoryUnmarked(latest)) {
    const columnMeta = [...latest.columnMeta];
    for (const [columnName, history] of Object.entries(mark.columns)) {
      if (columnName.includes('.')) continue;
      const index = columnMeta.findIndex((item) => item.columnName === columnName);
      if (index === -1) {
        columnMeta.push({ columnName, history });
      } else {
        columnMeta[index] = { ...columnMeta[index], history };
      }
    }
    const associationMeta = [...latest.associationMeta];
    for (const [relationKey, history] of Object.entries(mark.associations)) {
      const index = associationMeta.findIndex((item) => item.relationKey === relationKey);
      if (index === -1) {
        associationMeta.push({ relationKey, history });
      } else {
        associationMeta[index] = { ...associationMeta[index], history };
      }
    }
    upsertEdgeModelStudioMeta(model.id, {
      history: mark.history,
      columnMeta,
      associationMeta,
    });
  }
};
