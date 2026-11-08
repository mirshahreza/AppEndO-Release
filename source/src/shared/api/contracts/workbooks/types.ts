import type { FunctionAccessControl } from '../server-functions/accessControl';
import type { WorkbookAccessPermission, WorkbookViewerRole } from './access';

export type WorkbookSheetCellValue = {
  v?: unknown;
  m?: string;
  f?: string;
  bl?: number;
  bg?: string;
  ct?: { fa?: string; t?: string };
};

export type WorkbookSheetCell = {
  r: number;
  c: number;
  v: WorkbookSheetCellValue;
};

export type WorkbookSheet = {
  name: string;
  id?: string;
  order?: number;
  status?: number;
  row?: number;
  column?: number;
  celldata?: WorkbookSheetCell[];
};

export type WorkbookSharedMember = {
  key: string;
  userId: number;
  username: string;
  displayName: string;
  avatar: string | null;
};

export type WorkbookRecord = {
  id: string;
  name: string;
  note: string | null;
  sheets: WorkbookSheet[];
  ownerUserId: number;
  createdAt: string;
  createdBy: number | null;
  createdByUsername: string | null;
  updatedAt: string;
  updatedBy: number | null;
  updatedByUsername: string | null;
  accessControl: FunctionAccessControl;
  accessPermission: WorkbookAccessPermission;
  viewerRole: WorkbookViewerRole;
  sharedMembers: WorkbookSharedMember[];
};

export type WorkbookListItem = Omit<WorkbookRecord, 'sheets' | 'sharedMembers'>;

export const emptyWorkbookSheets = (): WorkbookSheet[] => ([
  {
    id: 'sheet-1',
    name: 'Sheet1',
    order: 0,
    status: 1,
    row: 200,
    column: 50,
    celldata: [],
  },
]);
