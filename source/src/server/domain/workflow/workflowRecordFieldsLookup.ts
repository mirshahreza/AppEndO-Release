import { getEdgeApiDefinitionByKey } from '../../services/data-api/edgeApiStore';
import { getEdgeModelById } from '../../services/data-api/edgeModelStore';

export type WorkflowRecordFieldDescriptor = {
  field: string;
  name: string;
  dataType: string;
  allowNull: boolean;
};

/**
 * p-99/WFT-5 — the one concrete "dynamic schema" case a Reality Audit actually found in this
 * codebase: `data.record-create`/`-update`/`-upsert`'s `fields` input is a blind JSON object today
 * because its real shape depends entirely on which Data API (and therefore which EdgeModel) the
 * author picks in `configSchema.apiKey` — there is no single static schema to author. AppEndO's CMS
 * was the plan's original guess for this (n8n's resourceMapper is usually pitched against a CRM/
 * spreadsheet-shaped target), but `cms_contents` turned out to be one fixed table, not a real
 * per-content-type custom-fields system — Data API/EdgeModel is the genuinely dynamic target.
 * The primary key column is excluded — `data.record-update`/`-upsert` already have their own
 * dedicated `pk`/`uniqueField` input, and `data.record-create`'s primary key is normally
 * auto-generated, not author-supplied.
 */
export function listWorkflowRecordFieldsForEdgeApiKey(edgeApiKey: string): WorkflowRecordFieldDescriptor[] | null {
  const api = getEdgeApiDefinitionByKey(edgeApiKey.trim());
  if (!api) return null;
  const model = getEdgeModelById(api.edgeModelId);
  if (!model) return null;

  return model.columns
    .filter((column) => !column.isPrimaryKey)
    .map((column) => ({
      field: column.field,
      name: column.name,
      dataType: column.dataType,
      allowNull: column.allowNull,
    }));
}
