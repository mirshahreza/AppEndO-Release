export type { BaseInfoRow } from '@/src/shared/api/contracts/base-info/types';
import type { BaseInfoRow } from '@/src/shared/api/contracts/base-info/types';
import type { BaseTreeGridRow } from '@/src/components/ui/BaseTreeGrid';

export type BaseInfoEditForm = {
  parentId: string;
  childDigits: string;
  title: string;
  titleEn: string;
  titleFa: string;
  titleAr: string;
  shortName: string;
  note: string;
  noteEn: string;
  noteFa: string;
  noteAr: string;
  viewOrder: string;
  value: string;
  metadata: string;
  uiColor: string;
  uiHtml: string;
  isActive: boolean;
};

export type TreeDisplayRow = {
  id: string;
  depth: number;
  row: BaseInfoRow;
};

export type BaseInfoTreeRow = BaseTreeGridRow & {
  row: BaseInfoRow;
};
