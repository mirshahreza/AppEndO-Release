import { mapBaseInfoListRowToFormRecord } from './baseInfoFormRowMap';
import {
  EMPTY_BASE_INFO_EDIT_FORM,
  type BaseInfoEditForm,
} from '../api/contracts/base-info/editForm';

const readStringField = (value: unknown, fallback = ''): string => (
  value === undefined || value === null ? fallback : String(value)
);

export const mapRecordToBaseInfoEditForm = (
  record: Record<string, unknown> | null | undefined,
  defaults: Partial<BaseInfoEditForm> = {},
): BaseInfoEditForm => {
  const mapped = record ? mapBaseInfoListRowToFormRecord(record) : {};
  return {
    ...EMPTY_BASE_INFO_EDIT_FORM,
    ...defaults,
    parentId: readStringField(mapped.parentId, defaults.parentId ?? ''),
    childDigits: readStringField(mapped.childDigits, defaults.childDigits ?? '3'),
    title: readStringField(mapped.title),
    titleEn: readStringField(mapped.titleEn),
    titleFa: readStringField(mapped.titleFa),
    titleAr: readStringField(mapped.titleAr),
    shortName: readStringField(mapped.shortName),
    note: readStringField(mapped.note),
    noteEn: readStringField(mapped.noteEn),
    noteFa: readStringField(mapped.noteFa),
    noteAr: readStringField(mapped.noteAr),
    viewOrder: readStringField(mapped.viewOrder),
    value: readStringField(mapped.value),
    metadata: readStringField(mapped.metadata),
    uiColor: readStringField(mapped.uiColor),
    uiHtml: readStringField(mapped.uiHtml),
    isActive: mapped.isActive === undefined
      ? (defaults.isActive ?? EMPTY_BASE_INFO_EDIT_FORM.isActive)
      : Boolean(mapped.isActive),
  };
};
