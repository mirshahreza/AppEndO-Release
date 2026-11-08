/**
 * Data API · HWY Member directory · list
 *
 * Definition : ea_a140003600ded4e4
 * Operation  : op_list_pur3ks (GET /api/hwy/member-directory)
 * Model      : VwHwyMembers (em_5f3a30c99bb3420e)
 *
 * Runtime: production traffic uses DataApiExecutor — shared logic lives in
 * `executeHwyMemberDirectoryList` (listScope, fast path, institute column).
 */

import { executeHwyMemberDirectoryList } from '@/server/domain/hwy/executeHwyMemberDirectoryList';
import { getEdgeApiDefinitionById } from '@/server/services/data-api/edgeApiStore';
import { resolvePublishedEdgeModel } from '@/server/services/data-api/dataApiPublishedRuntime';

const EDGE_API_DEFINITION_ID = 'ea_a140003600ded4e4';
const EDGE_MODEL_ID = 'em_5f3a30c99bb3420e';
const LIST_OPERATION_ID = 'op_list_pur3ks';

export default async function handler(req: { query?: Record<string, unknown> }, res: {
  status: (code: number) => { json: (body: unknown) => unknown };
  json: (body: unknown) => unknown;
}) {
  try {
    const definition = getEdgeApiDefinitionById(EDGE_API_DEFINITION_ID);
    const operation = definition?.operations.find((item) => item.id === LIST_OPERATION_ID && item.enabled);
    if (!definition || !operation) {
      return res.status(500).json({ success: false, message: 'Member directory list operation is not configured.' });
    }
    const { Model: ModelCtor, model, source } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
    const query = req.query ?? {};

    const payload = await executeHwyMemberDirectoryList({
      operation,
      model,
      source,
      ModelCtor,
      query,
      req,
      edgeModelId: EDGE_MODEL_ID,
    });
    return res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid member list scope.';
    if (message.includes('Unknown Hawiety member list scope')) {
      return res.status(400).json({ success: false, message });
    }
    throw error;
  }
}
