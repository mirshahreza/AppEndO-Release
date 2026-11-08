import type { BaseInfoEditForm } from '../api/contracts/base-info/editForm';
import { mapBaseInfoListRowToFormRecord } from './baseInfoFormRowMap';

const isBaseInfoVocabListRow = (row: Record<string, unknown>): boolean => {
  const hasParent = row.parentId !== undefined || row.parent_id !== undefined;
  const hasVocabTitle = row.title !== undefined
    || row.shortName !== undefined
    || row.short_name !== undefined;
  const looksLikePackageRow = row.titleAr !== undefined
    || row.code !== undefined && row.title === undefined && !hasParent;
  if (looksLikePackageRow && !hasParent) {
    return false;
  }
  return hasParent && hasVocabTitle;
};

/** Grid row → region detail seed (Edit modal). Base-info vocab lists keep legacy field normalization. */
export const mapGridRowToRegionSeedRecord = (
  row: Record<string, unknown>,
): Record<string, unknown> | BaseInfoEditForm => {
  if (isBaseInfoVocabListRow(row)) {
    return mapBaseInfoListRowToFormRecord(row);
  }
  return { ...row };
};
