import type { BaseInfoRow } from '../../shared/api/contracts/base-info/types';
import type { BaseInfoEditForm } from '../../shared/api/contracts/base-info/editForm';
import type { BaseTreeGridRow } from '../../components/ui/BaseTreeGrid';

export type { BaseInfoEditForm };

export type TreeDisplayRow = {
  id: string;
  depth: number;
  row: BaseInfoRow;
};

export type BaseInfoTreeRow = BaseTreeGridRow & {
  row: BaseInfoRow;
};
