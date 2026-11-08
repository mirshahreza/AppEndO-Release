import type { BaseInfoLocaleTexts } from '../../../lib/baseInfoCultureTranslations';

export type BaseInfoEditForm = {
  parentId: string;
  childDigits: string;
  title: string;
  shortName: string;
  note: string;
  locales: BaseInfoLocaleTexts;
  viewOrder: string;
  value: string;
  metadata: string;
  uiColor: string;
  uiHtml: string;
  isActive: boolean;
};

export const EMPTY_BASE_INFO_EDIT_FORM: BaseInfoEditForm = {
  parentId: '',
  childDigits: '3',
  title: '',
  shortName: '',
  note: '',
  locales: {},
  viewOrder: '',
  value: '',
  metadata: '',
  uiColor: '',
  uiHtml: '',
  isActive: true,
};
