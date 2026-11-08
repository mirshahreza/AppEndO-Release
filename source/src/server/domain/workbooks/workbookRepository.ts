import { randomUUID } from 'node:crypto';
import { Op, QueryTypes } from 'sequelize';
import { HttpError } from '../../errors/HttpError';
import type { FunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import { normalizeFunctionAccessControl } from '../../../shared/api/contracts/server-functions/accessControl';
import {
  DEFAULT_WORKBOOK_ACCESS_PERMISSION,
  PRIVATE_WORKBOOK_ACCESS_CONTROL,
  isWorkbookAccessPermission,
  resolveWorkbookViewerRole,
  type WorkbookAccessPermission,
  type WorkbookViewerRole,
} from '../../../shared/api/contracts/workbooks/access';
import type {
  WorkbookListItem,
  WorkbookRecord,
  WorkbookSharedMember,
  WorkbookSheet,
} from '../../../shared/api/contracts/workbooks/types';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { getWorkbookModel, type WorkbookRow } from './workbookSequelizeModel';

const toStoredSheets = (sheets: WorkbookSheet[]): WorkbookSheet[] =>
  sheets.map((sheet, index) => ({
    id: sheet.id,
    name: sheet.name,
    order: sheet.order ?? index,
    status: sheet.status,
    row: sheet.row,
    column: sheet.column,
    celldata: Array.isArray(sheet.celldata) ? sheet.celldata : [],
  }));

const parseSheets = (raw: string): WorkbookSheet[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as WorkbookSheet[] : [];
  } catch {
    return [];
  }
};

const toIso = (value: Date | string | null | undefined): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value ?? '');
};

export const asWorkbookUserId = (value: unknown): number => {
  if (value == null || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const asUserId = (value: unknown): number | null => {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const readWorkbookAccessControl = (raw: string | null | undefined): FunctionAccessControl => {
  if (!raw?.trim()) {
    return PRIVATE_WORKBOOK_ACCESS_CONTROL;
  }
  try {
    return normalizeFunctionAccessControl(JSON.parse(raw) as Partial<FunctionAccessControl>);
  } catch {
    return PRIVATE_WORKBOOK_ACCESS_CONTROL;
  }
};

export const readWorkbookAccessPermission = (raw: string | null | undefined): WorkbookAccessPermission => (
  isWorkbookAccessPermission(raw) ? raw : DEFAULT_WORKBOOK_ACCESS_PERMISSION
);

const loadActorUsernamesByWorkbookId = async (
  workbookIds: string[],
): Promise<Map<string, { createdByUsername: string | null; updatedByUsername: string | null }>> => {
  const ids = [...new Set(workbookIds.filter((id) => id.trim()))];
  if (ids.length === 0) {
    return new Map();
  }
  const placeholders = ids.map((_, index) => `:wb${index}`).join(', ');
  const replacements = Object.fromEntries(ids.map((id, index) => [`wb${index}`, id]));
  const rows = await getControlPlaneSequelize().query<{
    id: string;
    created_by_username?: string | null;
    updated_by_username?: string | null;
    createdByUsername?: string | null;
    updatedByUsername?: string | null;
  }>(
    `SELECT w.id,
            creator.username AS created_by_username,
            editor.username AS updated_by_username
     FROM base_workbooks w
     LEFT JOIN base_users creator ON creator.id = w.created_by
     LEFT JOIN base_users editor ON editor.id = w.updated_by
     WHERE w.id IN (${placeholders})`,
    { replacements, type: QueryTypes.SELECT },
  );
  return new Map(rows.map((row) => {
    const created = String(row.created_by_username ?? row.createdByUsername ?? '').trim();
    const updated = String(row.updated_by_username ?? row.updatedByUsername ?? '').trim();
    return [String(row.id), {
      createdByUsername: created || null,
      updatedByUsername: updated || null,
    }];
  }));
};

const redactedAccessControl = (acl: FunctionAccessControl): FunctionAccessControl => (
  normalizeFunctionAccessControl({
    accessMode: acl.accessMode,
    allowRoles: [],
    allowUsers: [],
    denyRoles: [],
    denyUsers: [],
  })
);

const mapRow = (
  row: WorkbookRow,
  viewer: { isOwner: boolean; permission: WorkbookAccessPermission },
): Omit<WorkbookRecord, 'createdByUsername' | 'updatedByUsername'> => {
  const accessControl = readWorkbookAccessControl(row.accessControl);
  const accessPermission = readWorkbookAccessPermission(row.accessPermission);
  const viewerRole: WorkbookViewerRole = resolveWorkbookViewerRole(viewer.isOwner, viewer.permission);
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    sheets: parseSheets(row.sheetsJson),
    ownerUserId: asWorkbookUserId(row.ownerUserId),
    createdAt: toIso(row.createdAt),
    createdBy: asUserId(row.createdBy),
    updatedAt: toIso(row.updatedAt),
    updatedBy: asUserId(row.updatedBy),
    accessControl: viewer.isOwner ? accessControl : redactedAccessControl(accessControl),
    accessPermission: viewer.isOwner ? accessPermission : viewer.permission,
    viewerRole,
    sharedMembers: [],
  };
};

const withActorUsernames = async (
  record: Omit<WorkbookRecord, 'createdByUsername' | 'updatedByUsername'>,
): Promise<WorkbookRecord> => {
  const names = (await loadActorUsernamesByWorkbookId([record.id])).get(record.id);
  return {
    ...record,
    createdByUsername: names?.createdByUsername ?? null,
    updatedByUsername: names?.updatedByUsername ?? null,
  };
};

const toRecord = async (
  row: WorkbookRow,
  viewer: { isOwner: boolean; permission: WorkbookAccessPermission },
): Promise<WorkbookRecord> => withActorUsernames(mapRow(row, viewer));

const toListItem = (record: WorkbookRecord): WorkbookListItem => {
  const { sheets: _sheets, sharedMembers: _members, ...rest } = record;
  return rest;
};

const ownerWhere = (ownerUserId: number) => ({ ownerUserId });

const ownerViewer = { isOwner: true, permission: 'edit' as const };

export async function listWorkbooks(ownerUserId: number): Promise<WorkbookListItem[]> {
  const rows = await getWorkbookModel().findAll({
    where: ownerWhere(ownerUserId),
    order: [['updatedAt', 'DESC']],
  });
  const mapped = rows.map((row) => mapRow(row.get({ plain: true }), ownerViewer));
  const usernames = await loadActorUsernamesByWorkbookId(mapped.map((row) => row.id));
  return mapped.map((row) => {
    const names = usernames.get(row.id);
    return toListItem({
      ...row,
      createdByUsername: names?.createdByUsername ?? null,
      updatedByUsername: names?.updatedByUsername ?? null,
    });
  });
}

export async function listCandidateSharedWorkbooks(): Promise<Array<{
  row: WorkbookRow;
  accessControl: FunctionAccessControl;
  accessPermission: WorkbookAccessPermission;
}>> {
  const rows = await getWorkbookModel().findAll({
    where: {
      accessControl: { [Op.ne]: null },
    },
    order: [['updatedAt', 'DESC']],
  });
  return rows.map((item) => {
    const row = item.get({ plain: true });
    return {
      row,
      accessControl: readWorkbookAccessControl(row.accessControl),
      accessPermission: readWorkbookAccessPermission(row.accessPermission),
    };
  });
}

export async function getWorkbookRowById(id: string): Promise<WorkbookRow | null> {
  const row = await getWorkbookModel().findByPk(id);
  return row ? row.get({ plain: true }) : null;
}

export async function getWorkbook(id: string, ownerUserId: number): Promise<WorkbookRecord> {
  const row = await getWorkbookModel().findOne({
    where: { id, ...ownerWhere(ownerUserId) },
  });
  if (!row) {
    throw new HttpError(404, 'Workbook not found.');
  }
  return toRecord(row.get({ plain: true }), ownerViewer);
}

export async function getWorkbookForViewer(
  row: WorkbookRow,
  viewer: { isOwner: boolean; permission: WorkbookAccessPermission },
  sharedMembers: WorkbookSharedMember[] = [],
): Promise<WorkbookRecord> {
  const record = await toRecord(row, viewer);
  return {
    ...record,
    sharedMembers: viewer.isOwner ? sharedMembers : [],
  };
}

export async function createWorkbook(input: {
  name: string;
  note?: string | null;
  sheets: WorkbookSheet[];
  ownerUserId: number;
}): Promise<WorkbookRecord> {
  const now = new Date();
  const row = await getWorkbookModel().create({
    id: randomUUID(),
    name: input.name,
    note: input.note ?? null,
    sheetsJson: JSON.stringify(toStoredSheets(input.sheets)),
    ownerUserId: input.ownerUserId,
    accessControl: JSON.stringify(PRIVATE_WORKBOOK_ACCESS_CONTROL),
    accessPermission: DEFAULT_WORKBOOK_ACCESS_PERMISSION,
    createdAt: now,
    createdBy: input.ownerUserId,
    updatedAt: now,
    updatedBy: input.ownerUserId,
  });
  return toRecord(row.get({ plain: true }), ownerViewer);
}

export async function updateWorkbook(input: {
  id: string;
  actorUserId: number | null;
  name?: string;
  note?: string | null;
  sheets?: WorkbookSheet[];
  allowRename: boolean;
}): Promise<WorkbookRecord> {
  const existing = await getWorkbookRowById(input.id);
  if (!existing) {
    throw new HttpError(404, 'Workbook not found.');
  }
  const isOwner = asWorkbookUserId(existing.ownerUserId) === input.actorUserId;
  const [count] = await getWorkbookModel().update(
    {
      name: input.allowRename ? (input.name?.trim() || existing.name) : existing.name,
      note: input.allowRename
        ? (input.note === undefined ? existing.note : input.note)
        : existing.note,
      sheetsJson: JSON.stringify(toStoredSheets(input.sheets ?? parseSheets(existing.sheetsJson))),
      updatedAt: new Date(),
      updatedBy: input.actorUserId && input.actorUserId > 0 ? input.actorUserId : existing.updatedBy,
    },
    { where: { id: input.id } },
  );
  if (!count) {
    throw new HttpError(404, 'Workbook not found.');
  }
  const updated = await getWorkbookRowById(input.id);
  if (!updated) {
    throw new HttpError(404, 'Workbook not found.');
  }
  return toRecord(updated, {
    isOwner,
    permission: isOwner ? 'edit' : readWorkbookAccessPermission(updated.accessPermission),
  });
}

export async function updateWorkbookAccess(input: {
  id: string;
  ownerUserId: number;
  accessControl: FunctionAccessControl;
  accessPermission: WorkbookAccessPermission;
}): Promise<WorkbookRecord> {
  await getWorkbook(input.id, input.ownerUserId);
  const [count] = await getWorkbookModel().update(
    {
      accessControl: JSON.stringify(normalizeFunctionAccessControl(input.accessControl)),
      accessPermission: input.accessPermission,
      updatedAt: new Date(),
      updatedBy: input.ownerUserId,
    },
    { where: { id: input.id, ownerUserId: { [Op.eq]: input.ownerUserId } } },
  );
  if (!count) {
    throw new HttpError(404, 'Workbook not found.');
  }
  return getWorkbook(input.id, input.ownerUserId);
}

export async function deleteWorkbook(id: string, ownerUserId: number): Promise<void> {
  await getWorkbook(id, ownerUserId);
  await getWorkbookModel().destroy({ where: { id, ...ownerWhere(ownerUserId) } });
}
