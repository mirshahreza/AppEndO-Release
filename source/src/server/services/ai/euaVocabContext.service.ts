import { parseBaseInfoSemanticContent, mergeBaseInfoSemanticContent } from '../../../shared/lib/baseInfoSemanticContent';
import type {
  EuaVocabSemanticContextPatchRequest,
  EuaVocabSemanticContextRecord,
} from '../../../shared/api/contracts/ai/euaSemanticValidation';
import { getBaseInfoNodeForForm, updateBaseInfoNode } from '../../domain/base-info/treeRepository';
import { HttpError } from '../../errors/HttpError';
import { invalidateBaseInfoOptionsCache } from '../baseInfoOptionsCache';

const toRecord = (row: {
  id: string;
  parentId: string | null;
  title: string;
  note: string | null;
  metadata: string | null;
}): EuaVocabSemanticContextRecord => {
  const semantic = parseBaseInfoSemanticContent(row.note, row.metadata);
  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title?.trim() || row.id,
    userGuidance: semantic.userGuidance,
    semanticRubric: semantic.semanticRubric,
  };
};

export class EuaVocabContextService {
  async getRecord(id: string): Promise<EuaVocabSemanticContextRecord> {
    const trimmedId = id.trim();
    if (!trimmedId) {
      throw new HttpError(400, 'Record id is required.');
    }

    const row = await getBaseInfoNodeForForm(trimmedId);
    if (!row) {
      throw new HttpError(404, `Base Info record not found (${trimmedId}).`);
    }

    return toRecord(row);
  }

  async patchSemanticContext(
    id: string,
    body: EuaVocabSemanticContextPatchRequest,
    actorId: number | null,
  ): Promise<EuaVocabSemanticContextRecord> {
    const trimmedId = id.trim();
    if (!trimmedId) {
      throw new HttpError(400, 'Record id is required.');
    }

    const current = await getBaseInfoNodeForForm(trimmedId);
    if (!current) {
      throw new HttpError(404, `Base Info record not found (${trimmedId}).`);
    }

    const expectedParentId = body.expectedParentId?.trim();
    if (expectedParentId && current.parentId !== expectedParentId) {
      throw new HttpError(403, 'This record is not under the expected vocabulary parent.');
    }

    const merged = mergeBaseInfoSemanticContent(current.metadata, {
      userGuidance: typeof body.userGuidance === 'string' ? body.userGuidance : '',
      semanticRubric: typeof body.semanticRubric === 'string' ? body.semanticRubric : '',
    });

    await updateBaseInfoNode([
      current.title,
      current.shortName,
      current.viewOrder,
      merged.note || null,
      merged.metadata || null,
      current.value,
      current.isActive,
      current.uiColor,
      current.uiHtml,
      null,
      actorId,
      trimmedId,
    ]);

    invalidateBaseInfoOptionsCache();

    const refreshed = await getBaseInfoNodeForForm(trimmedId);
    if (!refreshed) {
      throw new HttpError(500, 'Failed to reload updated record.');
    }

    return toRecord(refreshed);
  }
}
