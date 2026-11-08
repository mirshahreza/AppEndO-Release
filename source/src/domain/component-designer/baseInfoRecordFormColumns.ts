import type { PayloadFieldTransform } from './types';

export const BASE_INFO_RECORD_FORM_PALETTE_ID = 'form.base-info-record';

export type BaseInfoRecordFormColumn = {
  column: string;
  payloadTransform?: PayloadFieldTransform;
  createOnly?: boolean;
};

export const BASE_INFO_RECORD_FORM_COLUMNS: readonly BaseInfoRecordFormColumn[] = [
  { column: 'isActive', payloadTransform: 'boolean' },
  { column: 'parentId' },
  { column: 'childDigits', createOnly: true },
  { column: 'title' },
  { column: 'titleEn' },
  { column: 'titleFa' },
  { column: 'titleAr' },
  { column: 'shortName' },
  { column: 'note' },
  { column: 'noteEn' },
  { column: 'noteFa' },
  { column: 'noteAr' },
  { column: 'viewOrder' },
  { column: 'value' },
  { column: 'metadata' },
  { column: 'uiColor', payloadTransform: 'nullableString' },
  { column: 'uiHtml', payloadTransform: 'nullableString' },
] as const;

export const baseInfoRecordHiddenFieldName = (nodeId: string, column: string): string => (
  `${nodeId}__${column}`
);

export const readBaseInfoRecordFormProp = (
  props: Record<string, unknown>,
  key: 'baseInfoRecordFixedParentId' | 'baseInfoRecordParentLabel' | 'baseInfoRecordDataSourceRef',
): string => {
  const value = props[key];
  return typeof value === 'string' ? value.trim() : '';
};
